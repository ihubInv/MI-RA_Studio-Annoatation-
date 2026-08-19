"""Build folder trees and dataset dashboard stats from stored relative paths."""
from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import Annotation
from app.models.annotation_object import AnnotationObject
from app.models.dataset_item import DatasetItem, ItemStatus
from app.repositories.dataset_repo import DatasetItemRepository


STATUS_BUCKETS = {
    "not_annotated": {ItemStatus.PENDING, ItemStatus.PROCESSING, ItemStatus.READY, ItemStatus.ERROR},
    "in_progress": {ItemStatus.ANNOTATING},
    "completed": {ItemStatus.ANNOTATED},
    "needs_review": {ItemStatus.IN_REVIEW, ItemStatus.REJECTED},
    "approved": {ItemStatus.APPROVED},
}


def empty_counts() -> dict[str, int]:
    return {
        "image_count": 0,
        "not_annotated": 0,
        "in_progress": 0,
        "completed": 0,
        "needs_review": 0,
        "approved": 0,
        "error": 0,
    }


def bucket_status(status: ItemStatus | str) -> str:
    value = status if isinstance(status, ItemStatus) else ItemStatus(str(status))
    if value == ItemStatus.ERROR:
        return "error"
    for name, group in STATUS_BUCKETS.items():
        if value in group:
            return name
    return "not_annotated"


def add_counts(target: dict[str, int], status: ItemStatus | str, n: int = 1) -> None:
    target["image_count"] += n
    key = bucket_status(status)
    target[key] = target.get(key, 0) + n


def progress_of(counts: dict[str, int]) -> float:
    total = counts["image_count"]
    if not total:
        return 0.0
    done = counts["completed"] + counts["approved"]
    return round(100.0 * done / total, 1)


def ensure_node(nodes: dict[str, dict], path: str, name: str) -> dict:
    if path not in nodes:
        nodes[path] = {
            "path": path,
            "name": name or "Dataset",
            "children": {},
            **empty_counts(),
        }
    return nodes[path]


async def build_dataset_tree(db: AsyncSession, dataset_id: uuid.UUID) -> dict[str, Any]:
    repo = DatasetItemRepository(db)
    rows = await repo.folder_status_rows(dataset_id)

    object_count_stmt = (
        select(func.count(AnnotationObject.id))
        .join(Annotation, Annotation.id == AnnotationObject.annotation_id)
        .join(DatasetItem, DatasetItem.id == Annotation.item_id)
        .where(DatasetItem.dataset_id == dataset_id)
    )
    object_count = int((await db.execute(object_count_stmt)).scalar_one() or 0)

    class_count_stmt = (
        select(func.count(func.distinct(AnnotationObject.class_name)))
        .join(Annotation, Annotation.id == AnnotationObject.annotation_id)
        .join(DatasetItem, DatasetItem.id == Annotation.item_id)
        .where(DatasetItem.dataset_id == dataset_id)
    )
    class_count = int((await db.execute(class_count_stmt)).scalar_one() or 0)

    nodes: dict[str, dict] = {}
    root = ensure_node(nodes, "", "Dataset")

    for parent, status, count in rows:
        folder = parent or ""
        add_counts(root, status, count)
        if not folder:
            continue
        parts = folder.split("/")
        acc = []
        for part in parts:
            acc.append(part)
            path = "/".join(acc)
            ensure_node(nodes, path, part)
            add_counts(nodes[path], status, count)

    for path, node in nodes.items():
        if not path:
            continue
        parent = path.rsplit("/", 1)[0] if "/" in path else ""
        parent_node = nodes.get(parent, root)
        parent_node["children"][path] = node

    def serialize(node: dict) -> dict[str, Any]:
        children = [serialize(child) for _, child in sorted(node["children"].items())]
        counts = {k: node[k] for k in empty_counts()}
        return {
            "path": node["path"],
            "name": node["name"],
            **counts,
            "progress": progress_of(counts),
            "children": children,
        }

    tree = serialize(root)
    summary = {k: tree[k] for k in empty_counts()}
    return {
        "tree": tree,
        "summary": {
            **summary,
            "folders": max(0, len(nodes) - 1),
            "progress": progress_of(summary),
            "classes": class_count,
            "annotations": object_count,
            "remaining": summary["not_annotated"] + summary["in_progress"] + summary["needs_review"],
        },
    }
