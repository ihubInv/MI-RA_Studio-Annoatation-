# Image annotation module (backend)

Owns image-specific export (COCO / YOLO / VOC / LabelMe), label-schema APIs, and thumbnail processing.

HTTP routes stay at existing paths so the UI does not break:

- `GET/PUT /api/v1/schemas/dataset/{id}`
- `POST /api/v1/exports/`

Generic annotation CRUD (`/api/v1/annotations/`) stays in the platform layer because the JSONB object model is shared.

When adding video or LiDAR, create `app/modules/video` (etc.). Do not extend `export.py` in this folder with non-image formats.
