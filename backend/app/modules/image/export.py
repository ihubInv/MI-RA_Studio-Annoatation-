"""Export annotations while preserving original folder paths when possible."""
from __future__ import annotations

import csv
import io
import json
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.annotation import Annotation
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.repositories.dataset_repo import DatasetItemRepository


def _points(geom: dict[str, Any]) -> list[tuple[float, float]]:
    raw = geom.get("points") or []
    out: list[tuple[float, float]] = []
    if raw and isinstance(raw[0], (int, float)):
        for i in range(0, len(raw) - 1, 2):
            out.append((float(raw[i]), float(raw[i + 1])))
        return out
    for p in raw:
        if isinstance(p, dict):
            out.append((float(p.get("x", 0)), float(p.get("y", 0))))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            out.append((float(p[0]), float(p[1])))
    return out


def _aabb(pts: list[tuple[float, float]]) -> tuple[float, float, float, float] | None:
    if not pts:
        return None
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x, y = min(xs), min(ys)
    return x, y, max(xs) - x, max(ys) - y


def _rotated_corners(x: float, y: float, w: float, h: float, deg: float) -> list[tuple[float, float]]:
    import math

    rad = math.radians(deg)
    cx, cy = x + w / 2, y + h / 2
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    out = []
    for px, py in corners:
        dx, dy = px - cx, py - cy
        out.append((cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a))
    return out


def _bbox(geom: dict[str, Any]) -> tuple[float, float, float, float] | None:
    if geom.get("r") is not None and geom.get("x") is not None and geom.get("y") is not None and geom.get("w") is None:
        r = float(geom["r"])
        return float(geom["x"]) - r, float(geom["y"]) - r, r * 2, r * 2
    if geom.get("rx") is not None and geom.get("ry") is not None and geom.get("x") is not None:
        rx, ry = float(geom["rx"]), float(geom["ry"])
        return float(geom["x"]) - rx, float(geom["y"]) - ry, rx * 2, ry * 2
    if {"x", "y", "w", "h"} <= geom.keys():
        x, y, w, h = float(geom["x"]), float(geom["y"]), float(geom["w"]), float(geom["h"])
        rot = float(geom.get("rotation") or 0)
        if rot:
            return _aabb(_rotated_corners(x, y, w, h, rot))
        return x, y, w, h
    pts = _points(geom)
    if pts:
        return _aabb(pts)
    if geom.get("x") is not None and geom.get("y") is not None:
        return float(geom["x"]), float(geom["y"]), 1.0, 1.0
    return None


def _rle(geom: dict[str, Any]) -> dict[str, Any] | None:
    raw = geom.get("rle")
    if isinstance(raw, dict) and raw.get("counts") is not None and raw.get("size"):
        return {"counts": raw["counts"], "size": raw["size"]}
    return None


def _keypoints(geom: dict[str, Any]) -> tuple[list[float], int]:
    pts = _points(geom)
    flat: list[float] = []
    visible = 0
    vis = geom.get("visibility")
    for i, (x, y) in enumerate(pts):
        v = 2
        if isinstance(vis, list) and i < len(vis):
            v = int(vis[i] or 0)
        if v > 0:
            visible += 1
        flat.extend([round(x, 2), round(y, 2), v])
    return flat, visible


async def collect_export_rows(
    db: AsyncSession,
    dataset_id: uuid.UUID,
    folder: str | None = None,
    item_ids: list[uuid.UUID] | None = None,
    recursive: bool = True,
) -> tuple[Dataset, list[dict[str, Any]]]:
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise FileNotFoundError("Dataset not found")
    repo = DatasetItemRepository(db)
    items = await repo.list_index(dataset_id, folder=folder, recursive=recursive, limit=50_000)
    if item_ids:
        wanted = set(item_ids)
        items = [i for i in items if i.id in wanted]

    item_map = {i.id: i for i in items}
    if not item_map:
        return dataset, []

    stmt = (
        select(Annotation)
        .where(Annotation.item_id.in_(item_map.keys()))
        .options(selectinload(Annotation.objects))
        .order_by(Annotation.updated_at.desc())
    )
    anns = (await db.execute(stmt)).scalars().unique().all()
    latest: dict[uuid.UUID, Annotation] = {}
    for ann in anns:
        latest.setdefault(ann.item_id, ann)

    rows = []
    for item in items:
        ann = latest.get(item.id)
        objects = []
        if ann:
            for obj in ann.objects or []:
                if getattr(obj, "is_hidden", False):
                    continue
                objects.append(
                    {
                        "class_name": obj.class_name,
                        "tool_type": obj.tool_type,
                        "geometry": obj.geometry or {},
                        "attributes": obj.attributes or {},
                        "link_relation": obj.link_relation,
                        "linked_object_id": str(obj.linked_object_id) if obj.linked_object_id else None,
                    }
                )
        rows.append(
            {
                "item": item,
                "annotation": ann,
                "objects": objects,
            }
        )
    return dataset, rows


def build_export_zip(dataset: Dataset, rows: list[dict[str, Any]], fmt: str, include_images: bool) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if fmt == "coco":
            zf.writestr("annotations/instances.json", json.dumps(_to_coco(dataset, rows), indent=2))
        elif fmt == "yolo":
            _write_yolo(zf, rows)
        elif fmt == "voc":
            _write_voc(zf, rows)
        elif fmt == "labelme":
            _write_labelme(zf, rows)
        elif fmt == "csv":
            zf.writestr("annotations.csv", _to_csv(rows))
        else:
            zf.writestr(
                "annotations.json",
                json.dumps(_to_native(dataset, rows), indent=2),
            )

        if include_images:
            from app.services.storage_service import LocalStorageBackend, get_storage_backend

            backend = get_storage_backend()
            if isinstance(backend, LocalStorageBackend):
                for row in rows:
                    item: DatasetItem = row["item"]
                    src = backend.resolve_local_path(item.storage_path)
                    if src.exists():
                        zf.write(src, f"images/{item.relative_path or item.original_filename}")
    return buf.getvalue()


def _to_native(dataset: Dataset, rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "dataset": dataset.name,
        "dataset_id": str(dataset.id),
        "items": [
            {
                "id": str(row["item"].id),
                "relative_path": row["item"].relative_path or row["item"].original_filename,
                "filename": row["item"].original_filename,
                "parent_folder": row["item"].parent_folder,
                "status": getattr(row["item"].status, "value", str(row["item"].status)),
                "width": row["item"].width,
                "height": row["item"].height,
                "objects": row["objects"],
            }
            for row in rows
        ],
    }


def _to_coco(dataset: Dataset, rows: list[dict[str, Any]]) -> dict[str, Any]:
    categories = {}
    images = []
    annotations = []
    ann_id = 1
    for idx, row in enumerate(rows, start=1):
        item: DatasetItem = row["item"]
        images.append(
            {
                "id": idx,
                "file_name": item.relative_path or item.original_filename,
                "width": item.width or 0,
                "height": item.height or 0,
            }
        )
        for obj in row["objects"]:
            name = obj["class_name"]
            if name not in categories:
                categories[name] = {"id": len(categories) + 1, "name": name}
            geom = obj["geometry"]
            bbox = _bbox(geom)
            pts = _points(geom)
            rle = _rle(geom)
            coco_bbox = [bbox[0], bbox[1], bbox[2], bbox[3]] if bbox else [0, 0, 0, 0]
            if rle:
                segmentation: Any = rle
            elif pts:
                segmentation = [sum(([x, y] for x, y in pts), [])]
            else:
                segmentation = []
            entry: dict[str, Any] = {
                "id": ann_id,
                "image_id": idx,
                "category_id": categories[name]["id"],
                "bbox": coco_bbox,
                "segmentation": segmentation,
                "area": (bbox[2] * bbox[3]) if bbox else 0,
                "iscrowd": 0,
            }
            if obj["tool_type"] in {"keypoint", "skeleton"}:
                kp, vis = _keypoints(geom)
                if kp:
                    entry["keypoints"] = kp
                    entry["num_keypoints"] = vis
            annotations.append(entry)
            ann_id += 1
    return {
        "info": {"description": dataset.name},
        "images": images,
        "annotations": annotations,
        "categories": list(categories.values()),
    }


def _to_csv(rows: list[dict[str, Any]]) -> str:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["relative_path", "filename", "status", "class_name", "tool_type", "x", "y", "w", "h"])
    for row in rows:
        item: DatasetItem = row["item"]
        status = getattr(item.status, "value", str(item.status))
        if not row["objects"]:
            writer.writerow([item.relative_path, item.original_filename, status, "", "", "", "", "", ""])
            continue
        for obj in row["objects"]:
            bbox = _bbox(obj["geometry"]) or ("", "", "", "")
            writer.writerow(
                [
                    item.relative_path,
                    item.original_filename,
                    status,
                    obj["class_name"],
                    obj["tool_type"],
                    *bbox,
                ]
            )
    return out.getvalue()


def _write_yolo(zf: zipfile.ZipFile, rows: list[dict[str, Any]]) -> None:
    classes: list[str] = []
    for row in rows:
        for obj in row["objects"]:
            if obj["class_name"] not in classes:
                classes.append(obj["class_name"])
    zf.writestr("classes.txt", "\n".join(classes))
    class_index = {name: i for i, name in enumerate(classes)}
    for row in rows:
        item: DatasetItem = row["item"]
        w = item.width or 1
        h = item.height or 1
        rel = Path(item.relative_path or item.original_filename)
        lines = []
        for obj in row["objects"]:
            bbox = _bbox(obj["geometry"])
            if not bbox:
                continue
            x, y, bw, bh = bbox
            cx = (x + bw / 2) / w
            cy = (y + bh / 2) / h
            lines.append(f"{class_index.get(obj['class_name'], 0)} {cx:.6f} {cy:.6f} {bw / w:.6f} {bh / h:.6f}")
        zf.writestr(str(rel.with_suffix(".txt")).replace("\\", "/"), "\n".join(lines))


def _write_voc(zf: zipfile.ZipFile, rows: list[dict[str, Any]]) -> None:
    for row in rows:
        item: DatasetItem = row["item"]
        ann = ET.Element("annotation")
        ET.SubElement(ann, "filename").text = item.original_filename
        ET.SubElement(ann, "path").text = item.relative_path or item.original_filename
        size = ET.SubElement(ann, "size")
        ET.SubElement(size, "width").text = str(item.width or 0)
        ET.SubElement(size, "height").text = str(item.height or 0)
        ET.SubElement(size, "depth").text = "3"
        for obj in row["objects"]:
            bbox = _bbox(obj["geometry"])
            if not bbox:
                continue
            x, y, w, h = bbox
            node = ET.SubElement(ann, "object")
            ET.SubElement(node, "name").text = obj["class_name"]
            bb = ET.SubElement(node, "bndbox")
            ET.SubElement(bb, "xmin").text = str(int(x))
            ET.SubElement(bb, "ymin").text = str(int(y))
            ET.SubElement(bb, "xmax").text = str(int(x + w))
            ET.SubElement(bb, "ymax").text = str(int(y + h))
        rel = Path(item.relative_path or item.original_filename).with_suffix(".xml")
        zf.writestr(f"voc/{rel.as_posix()}", ET.tostring(ann, encoding="unicode"))


def _write_labelme(zf: zipfile.ZipFile, rows: list[dict[str, Any]]) -> None:
    for row in rows:
        item: DatasetItem = row["item"]
        shapes = []
        for obj in row["objects"]:
            pts = _points(obj["geometry"])
            bbox = _bbox(obj["geometry"])
            if bbox and not pts:
                x, y, w, h = bbox
                pts = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
            tool = obj["tool_type"]
            if tool in {"polygon", "polygon_mask", "freehand_mask", "semantic_seg", "instance_seg", "freehand", "brush", "area"}:
                shape_type = "polygon"
            elif tool in {"polyline", "line", "arc", "measure"}:
                shape_type = "linestrip"
            elif tool in {"point", "keypoint"}:
                shape_type = "point"
            elif tool in {"circle"}:
                shape_type = "circle"
            elif tool in {"skeleton"}:
                shape_type = "linestrip"
            else:
                shape_type = "rectangle"
            shapes.append(
                {
                    "label": obj["class_name"],
                    "points": pts,
                    "group_id": None,
                    "shape_type": shape_type,
                    "flags": obj.get("attributes") or {},
                }
            )
        payload = {
            "version": "5.0.0",
            "flags": {},
            "shapes": shapes,
            "imagePath": item.original_filename,
            "imageData": None,
            "imageHeight": item.height,
            "imageWidth": item.width,
        }
        rel = Path(item.relative_path or item.original_filename).with_suffix(".json")
        zf.writestr(f"labelme/{rel.as_posix()}", json.dumps(payload, indent=2))
