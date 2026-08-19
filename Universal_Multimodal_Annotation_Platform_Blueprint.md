# MI-RA Studio: Universal Multimodal Annotation & Dataset Intelligence Platform

**Organization**: MI-RA Lab

## 1. Project Vision

Build **MI-RA Studio**, a research-grade, extensible, professional, and scalable annotation platform for the **MI-RA Lab** that supports:

- Image (Bounding boxes, polygons, masks, keypoints, landmarks)
- Video (Tracking, interpolation, timelines)
- Audio (Transcription, diarization)
- Text (Entity labeling, relationships, classification)
- Documents/PDF
- 2D/3D pose
- LiDAR & Point clouds
- Depth
- Medical/scientific imaging
- Geospatial data (GIS)
- Time-series/sensors
- Multimodal synchronized data
- AI-assisted pre-annotation & Human-in-the-loop workflows
- Dataset visualization & analytics
- Quality assurance, Consensus annotation, & IAA
- Model prediction/error visualization
- Embeddings and similarity search
- Dataset versioning & Annotation history
- Export/Import to common ML formats
- Ontology management & Reusable templates

The platform should act as a unified, complete annotation ecosystem, combining:

- Annotation Studio
- Dataset Explorer
- FiftyOne-style visualization
- CVAT-style annotation workflows
- 3D/LiDAR viewer
- Multimodal synchronized timeline
- AI pre-annotation
- QA/review system
- Dataset intelligence

---

# 2. Core Design Principles

1. **Customizable Schemas**: Do not hard-code annotation types; use an intuitive, configurable Annotation Schema Builder with ontology management.
2. **Professional UX**: Prioritize usability, annotation accuracy, and a seamless professional UX across all tools (autosave, advanced undo/redo, comprehensive keyboard shortcuts).
3. **Data Integrity & Security**: Keep large media files outside Supabase Postgres. Use local filesystem (dev) or Supabase Storage / S3 (cloud) for raw/derived files. Ensure robust error handling and recovery mechanisms.
4. **Unified Data Model**: Use a common annotation data model across modalities, supporting object linking, multi-label annotation, and hierarchical labels.
5. **Decoupled Architecture**: Make visualization and annotation separate but connected layers.
6. **Auditability**: Make every annotation versioned/auditable, with complete annotation history and audit logs.
7. **Extensibility**: Make modality support plugin-based to easily adapt to future formats.
8. **Asynchronous Processing**: Process large files asynchronously, maintaining an intuitive frontend experience.
9. **High Performance**: Optimize the browser for massive datasets, geospatial layers, and multi-gigabyte point clouds.
10. **Dataset Intelligence**: Keep research/QA metrics, validation rules, consensus annotation, and analytics as first-class platform features.
11. **Scalable Infrastructure**: Start as a modular monolith; split services only when scale requires it.
12. **AI Integration**: Seamlessly weave model-assisted/pre-annotation and human-in-the-loop workflows into the core experience.
13. **Local-first development**: Run frontend, backend, Redis, and workers as native processes on the developer machine. Do **not** require Docker or Docker Compose for day-to-day development.
14. **Managed database**: Use **Supabase Postgres** as the primary database so schema, migrations, and JSONB/pgvector work against a real hosted Postgres without running a local database server.

---

# 3. Recommended Technology Stack

| Layer | Recommended Technology |
|---|---|
| Frontend | React + TypeScript |
| Build | Vite |
| UI | Tailwind CSS + shadcn/ui |
| Client state | Zustand |
| Server state | TanStack Query |
| Image annotation | Canvas/Konva.js |
| Video | HTML5 Video + WebCodecs where required |
| Audio | Web Audio API + Wavesurfer.js |
| 2D/General rendering | Canvas/WebGL |
| 3D | Three.js |
| Large point cloud | Three.js + octree/LOD architecture |
| Point-cloud processing | Open3D |
| Backend | Python + FastAPI (run locally via uvicorn) |
| Validation | Pydantic |
| ORM | SQLAlchemy |
| Migrations | Alembic |
| Database | **Supabase Postgres** (hosted PostgreSQL; no local DB container) |
| Flexible annotation fields | PostgreSQL JSONB (Supabase) |
| Cache/queue broker | Redis installed natively on the host (Windows/WSL/macOS/Linux) |
| Background jobs | Celery (local worker processes) |
| Object storage | Local filesystem initially / Supabase Storage (S3-compatible) / S3 in cloud |
| Analytics | DuckDB + Parquet |
| Vector search | pgvector (enable on Supabase) |
| AI/ML | PyTorch |
| CV | OpenCV |
| NLP | Hugging Face Transformers |
| Speech | Whisper-compatible ASR + diarization |
| 3D ML | Open3D + PyTorch |
| Authentication | Application RBAC/JWT (or Supabase Auth later if desired) |
| Local process manager | Native processes + scripts (no Docker) |
| Optional reverse proxy | Nginx only if needed later (not required for local dev) |
| Monitoring | Prometheus + Grafana (optional; skip for early local phases) |
| Logs | File/console logging locally; Loki later if needed |
| CI/CD | GitHub Actions |
| API documentation | OpenAPI/Swagger |

### Local + Supabase summary (decision locked)

| Concern | Choice |
|---|---|
| How you run the app | **Local native processes** (Vite, uvicorn, Celery) — **no Docker** |
| Database | **Supabase Postgres** (hosted) |
| Vectors | **pgvector** extension on Supabase |
| Redis / jobs | Redis + Celery **installed and run on your PC** |
| Media (dev) | `./data` local folder by default |
| Media (optional) | Supabase Storage |
| Auth (start) | App JWT/RBAC; Supabase Auth is optional later |

---

# 4. High-Level Architecture

```text
                         USER
                          |
                          v
                +---------------------+
                | React + TypeScript   |
                | Frontend (Vite local)|
                +----------+----------+
                           |
               +-----------+-----------+
               |           |           |
               v           v           v
             REST       WebSocket     Upload
               |           |           |
               +-----------+-----------+
                           |
                           v
                   +---------------+
                   |    FastAPI    |
                   | Backend (local|
                   |  uvicorn)     |
                   +-------+-------+
                           |
          +----------------+----------------+
          |                |                |
          v                v                v
   Supabase Postgres    Redis (local)   Local FS /
   (hosted + pgvector)  Celery broker   Supabase Storage
          |                |                |
          |                v                |
          |             Celery             |
          |          (local workers)       |
          |                |                |
          |       +--------+--------+       |
          |       |        |        |       |
          v       v        v        v       |
       Metadata Image    Video    LiDAR    |
                Worker   Worker   Worker   |
                         |                |
                         +-------+--------+
                                 |
                                 v
                           AI Services
                                 |
                    +------------+------------+
                    |            |            |
                    v            v            v
                  Vision        NLP          3D
                    |            |            |
                    +------------+------------+
                                 |
                                 v
                           QA / Analytics
                                 |
                    +------------+------------+
                    |                         |
                    v                         v
                 DuckDB                    pgvector
                 + Parquet              (on Supabase)
```

**Local-first rule**: Frontend, backend, Redis, and Celery workers run on your machine. Only the database (and optionally object storage) live on Supabase.
---

# 5. Main Product Modules

```text
1. Authentication & RBAC
2. Organization Management
3. Project Management
4. Dataset Management
5. Dataset Versioning
6. Annotation Schema Builder
6b. Ontology & Template Management
7. Image Annotation
8. Video Annotation
9. Audio Annotation
10. Text Annotation
11. Document Annotation
12. 2D Pose Annotation
13. 3D Pose Annotation
14. LiDAR Annotation
15. Point Cloud Annotation
16. Depth Annotation
17. Medical Annotation
18. Time-Series Annotation
19. Geospatial Annotation
19b. Multimodal Annotation
20. Dataset Explorer
21. 2D Visualization
22. 3D Visualization
23. Camera/LiDAR Visualization
24. Embedding Visualization
25. Model Prediction Visualization
26. AI Pre-annotation
27. Object Tracking
28. QA & Review
29. IAA / Agreement Analytics
30. Annotator Management
31. Gold Standard Tasks
32. Active Learning
33. Search & Filtering
34. Dataset Analytics
35. Export Engine
36. API / SDK
37. Audit Logs
38. Notifications
39. System Administration
```

---

# 6. Supported Modalities

## 6.1 Image

Support:

- Classification
- Bounding box
- Rotated bounding box
- Polygon
- Polyline
- Point
- Ellipse
- Brush
- Segmentation mask
- Keypoints
- Skeleton
- Cuboid
- Attributes

## 6.2 Video

Support:

- Frame classification
- Bounding boxes
- Polygon tracking
- Mask tracking
- Keypoint tracking
- Skeleton tracking
- Object IDs
- Keyframes
- Interpolation
- Temporal segments
- Action labels
- Events
- Scene changes

## 6.3 Audio

Support:

- Transcription
- Speaker diarization
- Speaker identity
- Speech/non-speech
- Sound events
- Emotion
- Noise
- Quality rating
- Loudness
- Discontinuity
- Temporal segments

Example configurable quality fields:

```text
Main Speaker Present
Noisiness
Voice Tone Naturalness
Discontinuity
Loudness
Overall Audio Quality
```

## 6.4 Text

Support:

- Classification
- Span annotation
- NER
- Relation extraction
- Sentiment
- Intent
- Entity linking
- Question answering
- LLM response evaluation
- Comments

## 6.5 Documents

Support:

- PDF
- DOCX
- Scanned pages
- OCR
- Tables
- Cells
- Key-value pairs
- Headers
- Footers
- Signatures
- Checkboxes
- Text regions
- Images

## 6.6 2D Pose

Support:

- COCO
- MPII
- Custom skeletons
- Human pose
- Animal pose
- Hand pose
- Face landmarks

## 6.7 3D Pose

Support:

- XYZ joints
- Bone connections
- Root joint
- Camera coordinates
- World coordinates
- Visibility
- Confidence
- Per-joint error

## 6.8 Point Cloud/LiDAR

Support:

- 3D cuboids
- 3D bounding boxes
- Point labels
- Semantic segmentation
- Instance segmentation
- Object tracking
- Ground plane
- BEV annotation
- Camera association
- Attributes

Formats to support initially or through converters:

```text
PCD
PLY
LAS
LAZ
XYZ
BIN
NPY
NPZ
KITTI-style data
Custom formats
```

## 6.9 Depth

Support:

- Depth maps
- Object depth
- 3D coordinates
- Planes
- Surface regions
- RGB-depth association

## 6.10 Medical

Support:

- X-Ray
- CT
- MRI
- Ultrasound
- Microscopy
- Histopathology
- DICOM
- NIfTI
- NRRD

Annotations:

- Classification
- Bounding box
- Polygon
- Segmentation
- Lesion
- Organ
- Cell
- Anatomical landmarks

## 6.11 Time-Series

Support:

- Events
- Anomalies
- Segments
- Peaks
- States
- Sensor labels

## 6.13 Geospatial Data

Support:

- GeoTIFF / Satellite imagery
- Shapefiles / GeoJSON / KML
- Drone imagery / Orthomosaics
- Raster and Vector layers
- Coordinate Reference Systems (CRS)

Annotations:
- Geo-referenced Bounding boxes
- Polygons & Polylines
- Points & Landmarks
- Semantic segmentation masks
- Land cover classification

## 6.14 Multimodal

Support synchronized:

```text
RGB
Depth
LiDAR
Audio
IMU
GPS
Radar
EEG
ECG
PPG
Other sensors
```

---

# 7. Core Annotation Engine

The platform should have one common annotation engine.

```text
Annotation Engine
|
+-- Image
+-- Video
+-- Audio
+-- Text
+-- Document
+-- Pose
+-- Point Cloud
+-- LiDAR
+-- Medical
+-- Time-Series
+-- Multimodal
```

Common operations:

```text
create()
update()
delete()
select()
move()
resize()
rotate()
copy()
paste()
undo()
redo()
autosave()
link_objects()
add_hierarchical_label()
lock()
hide()
show()
validate()
submit()
review()
consensus_merge()
```

---

# 8. Annotation Schema Builder

Do not create annotation tools by changing source code for every project.

Create a no-code schema builder.

Example:

```text
CREATE PROJECT
|
+-- Dataset Type: Traffic
|
+-- Classes
|   +-- Car
|   +-- Bus
|   +-- Truck
|   +-- Motorcycle
|   +-- Pedestrian
|
+-- Tools
|   +-- 2D Bounding Box
|   +-- Polygon
|   +-- 3D Box
|   +-- Tracking
|
+-- Attributes
    +-- Vehicle Type
    +-- Color
    +-- Occlusion
    +-- Truncation
    +-- Direction
```

Schema example:

```json
{
  "name": "Traffic Annotation",
  "version": "1.0",
  "modalities": ["image", "video", "lidar"],
  "classes": [
    {
      "name": "vehicle",
      "tools": ["bbox2d", "bbox3d", "tracking"],
      "attributes": {
        "color": ["red", "white", "black", "other"],
        "occluded": "boolean",
        "truncated": "boolean"
      }
    }
  ]
}
```

---

# 9. Image Annotation UI

Recommended:

- Canvas
- Konva.js
- WebGL when necessary

Tools:

```text
Select
Box
Rotated Box
Polygon
Polyline
Point
Ellipse
Brush
Eraser
Mask
Keypoint
Skeleton
```

Required:

- Zoom/Pan
- Undo/Redo/Autosave
- Multi-label & Hierarchical labels
- Object linking & Relationships
- Tagging & Attributes
- Comments
- Fit to screen
- Undo/redo
- Snap
- Multi-select
- Copy/paste
- Lock
- Hide
- Label visibility
- Object list
- Keyboard shortcuts

---

# 10. Video Annotation UI

Build a dedicated timeline.

```text
Video
|
+-- Frame 0
+-- Frame 1
+-- ...
+-- Frame N
```

Timeline:

```text
0s ---- 5s ---- 10s ---- 15s ---- 20s

Car_001  =========================
Car_002          ================
Person_001  ======================
```

Features:

- Frame navigation
- Keyframes
- Interpolation
- Object tracking
- Track IDs
- Temporal segments
- Action/event labels
- Frame-level classification
- Playback speed
- Frame stepping

---

# 11. Audio Annotation UI

Use:

- Web Audio API
- Wavesurfer.js

Viewer:

```text
Speaker 1
████████████

Speaker 2
           █████████

Noise
      ███        ███

0s ----- 5s ----- 10s ----- 15s
```

Include:

- Waveform
- Spectrogram
- Play/pause
- Speed
- Segment creation
- Speaker tracks
- Transcription
- Quality labels
- Sound event labels

---

# 12. Text Annotation UI

Use a structured document editor.

Features:

- Span selection
- Entity labels
- Relations
- Classification
- Comments
- Highlighting
- Search
- Keyboard shortcuts

Example:

```text
[Fariyad] works at [IIT Mandi].

PERSON             ORGANIZATION
```

---

# 13. 3D/LiDAR Visualization

Use:

- Three.js frontend
- Open3D backend processing
- WebGL/WebGPU rendering
- Octree/LOD/chunking for large clouds

Viewer controls:

```text
Orbit
Pan
Zoom
First Person
Top
Front
Side
BEV
Camera
```

Rendering controls:

```text
Point Size
Point Color
RGB
Intensity
Height
Distance
Semantic Class
Instance ID
```

Annotation tools:

```text
3D Box
Cuboid
Point Selection
Polygon
Region Selection
Semantic Label
Instance Label
Track
```

---

# 14. Large Point Cloud Architecture

Never send a huge raw point cloud directly to the browser.

Pipeline:

```text
Raw Point Cloud
       |
       v
Preprocessing
       |
       v
Coordinate normalization
       |
       v
Downsampling
       |
       v
Spatial partitioning
       |
       v
Octree / LOD
       |
       v
Tiles/chunks
       |
       v
Browser viewer
```

Load only visible chunks.

LOD example:

```text
LOD0 = full resolution
LOD1 = medium
LOD2 = low
LOD3 = preview
```

---

# 15. Camera + LiDAR Calibration

Store:

```text
Camera Intrinsic:
fx
fy
cx
cy
distortion

Camera Extrinsic:
R
T
```

Projection:

```text
LiDAR XYZ
   |
   v
Extrinsic Transform
   |
   v
Camera Coordinates
   |
   v
Projection
   |
   v
Pixel X,Y
```

Allow:

- LiDAR-to-camera projection
- Camera-to-LiDAR association
- 2D/3D linked selection
- Camera frustum
- Calibration visualization
- 3D box projection to image

---

# 16. Multimodal Timeline

Create a global timeline independent of video.

```text
GLOBAL TIMELINE

RGB       ==============================
LiDAR     ==============================
Depth     ==============================
Audio     ==============================
IMU       ==============================
GPS       ==============================
EEG       ==============================
ECG       ==============================
PPG       ==============================

                     ^
                  12.450s
```

Selecting one timestamp must update every viewer.

---

# 17. Dataset Explorer

This is the FiftyOne-style part of the product.

Features:

- Dataset gallery
- Grid view
- List view
- Table view
- Sample preview
- Metadata
- Filters
- Search
- Sort
- Group by
- Similarity search
- Duplicates
- Outliers
- Embeddings
- Prediction visualization
- Annotation status
- QA status

Example filters:

```text
class = pedestrian
confidence < 0.5
annotation_status = review
IAA < 0.7
annotator = A12
modality = lidar
```

---

# 18. Embedding Visualization

Generate embeddings for:

```text
Image
Text
Audio
Video
Multimodal samples
```

Support:

```text
PCA
t-SNE
UMAP
```

Visualization:

```text
             Embedding Space

       ● ● ●
     ● ● ● ● ●
    ● ● ●
                   × × ×
                 × × × ×
```

Click a point to open the corresponding sample.

---

# 19. Dataset Similarity Search

Example:

```text
Upload/query sample
        |
        v
Generate embedding
        |
        v
Vector search
        |
        v
Top-K similar samples
```

Start with:

**PostgreSQL + pgvector**

Move to Qdrant/Milvus only when required by scale.

---

# 20. Model Prediction Visualization

Support:

```text
Ground Truth
Prediction
Difference
```

For detection:

- TP
- FP
- FN
- IoU
- Confidence
- Class mismatch

For segmentation:

- IoU
- Dice
- GT mask
- Prediction mask
- Difference

For pose:

- MPJPE
- P-MPJPE
- Per-joint error
- GT skeleton
- Prediction skeleton

---

# 21. AI Annotation Service

Create a separate AI layer.

```text
AI Annotation Service
|
+-- Detection
+-- Segmentation
+-- Classification
+-- Pose
+-- Tracking
+-- OCR
+-- ASR
+-- Speaker Diarization
+-- Depth
+-- 3D Detection
+-- Embeddings
+-- LLM-based annotation
```

Workflow:

```text
Upload
  |
  v
AI Pre-annotation
  |
  v
Human Correction
  |
  v
QA
  |
  v
Ground Truth
```

---

# 22. Model Registry

Store:

```text
Model Name
Version
Framework
Weights
Input Modality
Output Schema
GPU Requirement
Inference Configuration
```

Example:

```text
YOLO
SAM
Pose Model
OCR Model
ASR Model
3D Detector
Custom Research Model
```

---

# 23. Background Processing

Never run large media processing inside the HTTP request.

Use:

```text
FastAPI
   |
   v
Redis
   |
   v
Celery
   |
   +-- Image preprocessing
   +-- Video frame extraction
   +-- Audio processing
   +-- Point cloud conversion
   +-- Thumbnail generation
   +-- AI inference
   +-- Embeddings
   +-- Dataset statistics
   +-- Export
```

---

# 24. Database Design

Core tables:

```text
organizations
users
roles
permissions

projects
project_members

datasets
dataset_items
dataset_versions

annotation_schemas
annotation_classes
annotation_attributes

tasks
task_assignments

annotations
annotation_objects
annotation_tracks
annotation_keypoints

reviews
qa_results
gold_samples

models
model_versions
predictions
prediction_objects

embeddings
embedding_runs

exports
processing_jobs

comments
notifications
audit_logs
```

---

# 25. Supabase Postgres Strategy

Use **Supabase Postgres** (hosted PostgreSQL) as the single source of truth for:

- Users
- Projects
- Dataset metadata
- Tasks
- Annotations
- QA
- Permissions
- Model metadata
- Audit logs
- Embeddings via **pgvector** (enable the `vector` extension in the Supabase SQL editor)

Use JSONB for flexible annotation attributes.

Example:

```json
{
  "occluded": true,
  "truncated": false,
  "color": "white",
  "vehicle_type": "car"
}
```

Do not store large binary media inside Postgres (Supabase DB or otherwise).

### Why Supabase (not a local Postgres / Docker DB)

- No Docker or local Postgres install required for the database
- Real hosted Postgres with connection pooling (Supavisor / PgBouncer)
- Easy dashboard for SQL, tables, and extensions
- Optional later: Supabase Auth, Storage, Realtime — without changing the core schema approach
- `pgvector` available for similarity search

### Connection approach

- Use the **Session / Direct** connection string for Alembic migrations (DDL)
- Use the **Transaction / Pooler** connection string for the FastAPI app at runtime when many concurrent requests are expected
- Prefer the SQLAlchemy URL form: `postgresql+psycopg://...`
- Store the URL only in `.env` (never commit it)

### Supabase project setup (one-time)

```text
1. Create a project at https://supabase.com
2. Open Project Settings → Database
3. Copy the connection string(s)
4. In SQL Editor, enable extensions as needed:
     create extension if not exists vector;
     create extension if not exists "uuid-ossp";
5. Point DATABASE_URL / DATABASE_URL_MIGRATE in local .env at Supabase
6. Run Alembic migrations from your local machine against Supabase
```

### Local app ↔ Supabase

```text
Your PC (local processes)              Supabase Cloud
--------------------------             -----------------
Vite frontend  :5173
FastAPI        :8000  -------------->  Postgres (+ pgvector)
Celery workers
Redis (local)
Local media folder  -or-  ---------->  Supabase Storage (optional)
```

---

# 26. Object Storage

**Local development (no Docker):** prefer a local filesystem data directory first.

```text
./data/
|
+-- projects/
+-- datasets/
+-- images/
+-- videos/
+-- audio/
+-- lidar/
+-- pointcloud/
+-- documents/
+-- thumbnails/
+-- previews/
+-- embeddings/
+-- predictions/
+-- exports/
```

**Optional:** use **Supabase Storage** (S3-compatible API) so media lives with the same project as the database — still no Docker.

**Later / production:** AWS S3 or equivalent.

Abstract storage behind an interface (`LocalStorageBackend` / `SupabaseStorageBackend` / `S3StorageBackend`) so the rest of the app does not care which backend is active.

Bucket / prefix structure (same layout whether local or cloud):

```text
bucket-or-root/
|
+-- projects/
+-- datasets/
+-- images/
+-- videos/
+-- audio/
+-- lidar/
+-- pointcloud/
+-- documents/
+-- thumbnails/
+-- previews/
+-- embeddings/
+-- predictions/
+-- exports/
```

---

# 27. Dataset Analytics

Use:

**DuckDB + Parquet**

Architecture:

```text
Object Storage
      |
      v
Parquet
      |
      v
DuckDB
      |
      v
Analytics
```

Use PostgreSQL for application state and DuckDB/Parquet for large analytical workloads.

---

# 28. QA System

Three layers.

## Automatic QA

Check:

```text
Missing annotation
Invalid geometry
Out-of-bounds
Duplicate object
Overlapping object
Invalid skeleton
Invalid timestamps
Invalid 3D box
Missing sensor data
```

## Human QA & Consensus Workflow

```text
Annotator A        Annotator B
    |                  |
    +-------+----------+
            |
            v
      Consensus Merge
            |
            v
       QA Reviewer
            |
    +-------+-------+
    |       |       |
 Accept  Reject   Modify
```

## Statistical QA

```text
IAA
Krippendorff Alpha
Cohen Kappa
Fleiss Kappa
IoU
F1
Precision
Recall
Correlation
Distribution consistency
```

---

# 29. Gold Standard Tasks

Create hidden reference samples.

Example:

```text
100 tasks
|
+-- 95 normal
+-- 5 gold-standard
```

Measure:

```text
Gold accuracy
IAA
Error rate
Correction rate
Average annotation time
```

---

# 30. Annotator Management

Roles:

```text
SUPER_ADMIN
ORG_ADMIN
PROJECT_MANAGER
ANNOTATOR
QA
REVIEWER
VIEWER
```

Track:

```text
Tasks completed
Annotation time
Average time/sample
Rejected annotations
Gold accuracy
IAA
Correction rate
Productivity
Quality score
```

---

# 31. Audit Trail

Every modification must be logged.

```text
User
Action
Timestamp
Project
Dataset
Sample
Annotation
Old value
New value
```

Example:

```text
User: annotator_12
Action: update_annotation
Object: car_001
Before: x=100,y=200,w=150,h=200
After:  x=105,y=198,w=155,h=204
```

---

# 32. Versioning

Never silently overwrite important ground truth.

Use:

```text
Dataset v1.0
Dataset v1.1
Dataset v2.0
```

and:

```text
Annotation v1
Annotation v2
Annotation v3
```

Keep change history.

---

# 33. Export Engine

Support:

## Image

```text
COCO
YOLO
Pascal VOC
CVAT
LabelMe
```

## Pose

```text
COCO Keypoints
MPII
Custom JSON
```

## Audio

```text
JSON
CSV
RTTM
TXT
Segmented WAV metadata
```

## Text

```text
JSON
JSONL
CSV
CoNLL
```

## 3D

```text
KITTI-style
nuScenes-style
PCD
PLY
LAS/LAZ
Custom JSON
```

## Medical

```text
DICOM
NIfTI
NRRD
```

---

# 34. API Structure

```text
/api/v1/

auth/
organizations/
users/

projects/
projects/{id}

datasets/
datasets/{id}
datasets/{id}/items
datasets/{id}/versions

schemas/
classes/
attributes/

tasks/
assignments/

annotations/
annotations/{id}

reviews/
qa/

models/
predictions/

embeddings/

visualization/

analytics/

exports/

audit/
```

Use REST for standard operations and WebSocket for realtime state.

---

# 35. WebSocket Events

Use WebSocket for:

```text
annotation.created
annotation.updated
annotation.deleted
task.assigned
task.status_changed
review.created
ai.job.started
ai.job.progress
ai.job.completed
export.started
export.progress
export.completed
```

---

# 36. Frontend Project Structure

```text
frontend/
|
+-- src/
    |
    +-- app/
    +-- components/
    +-- layouts/
    |
    +-- features/
    |   +-- auth/
    |   +-- projects/
    |   +-- datasets/
    |   +-- tasks/
    |   +-- annotations/
    |   +-- qa/
    |   +-- models/
    |   +-- analytics/
    |
    +-- annotation/
    |   +-- image/
    |   +-- video/
    |   +-- audio/
    |   +-- text/
    |   +-- document/
    |   +-- pose/
    |   +-- pointcloud/
    |   +-- lidar/
    |   +-- multimodal/
    |
    +-- visualization/
    |   +-- gallery/
    |   +-- embeddings/
    |   +-- statistics/
    |   +-- predictions/
    |
    +-- viewers/
    |   +-- ImageViewer/
    |   +-- VideoViewer/
    |   +-- AudioViewer/
    |   +-- PointCloudViewer/
    |   +-- MultimodalViewer/
    |
    +-- stores/
    +-- hooks/
    +-- services/
    +-- types/
    +-- utils/
```

---

# 37. Backend Project Structure

```text
backend/
|
+-- app/
    |
    +-- main.py
    |
    +-- api/
    |   +-- auth.py
    |   +-- projects.py
    |   +-- datasets.py
    |   +-- tasks.py
    |   +-- annotations.py
    |   +-- qa.py
    |   +-- models.py
    |   +-- exports.py
    |   +-- analytics.py
    |
    +-- models/
    +-- schemas/
    +-- services/
    +-- repositories/
    +-- workers/
    +-- middleware/
    +-- security/
    +-- utils/
    |
    +-- database/
    |   +-- connection.py
    |   +-- migrations/
    |
    +-- config/
```

---

# 38. AI Services Structure

```text
ai-services/
|
+-- detection/
+-- segmentation/
+-- classification/
+-- pose/
+-- tracking/
+-- ocr/
+-- asr/
+-- diarization/
+-- depth/
+-- lidar/
+-- embeddings/
+-- llm/
```

Each AI module should expose a consistent interface:

```text
load_model()
validate_input()
predict()
postprocess()
convert_to_annotation()
```

---

# 39. Processing Pipeline

```text
Upload
  |
  v
Validate File
  |
  v
Detect Modality
  |
  v
Extract Metadata
  |
  v
Generate Preview
  |
  v
Generate Thumbnail
  |
  v
Create Dataset Item
  |
  v
Ready for Annotation
```

For large files:

```text
Upload
  |
  v
Background Job
  |
  +-- Extract
  +-- Convert
  +-- Index
  +-- Generate previews
  +-- Generate embeddings
  +-- Generate statistics
```

---

# 40. File Validation

Validate:

```text
File type
File extension
MIME type
File size
Image dimensions
Video codec
Audio codec
Point cloud structure
DICOM metadata
Malicious files
```

Never trust a client-provided extension alone.

---

# 41. Authentication and Authorization

Implement:

```text
Login
Logout
Refresh token
Password reset
Email verification
2FA later
RBAC
Project-level permissions
Dataset-level permissions
```

Use:

```text
JWT
Refresh tokens
Secure cookies where appropriate
HTTPS
```

---

# 42. Security

Implement:

```text
HTTPS
RBAC
Audit logging
Rate limiting
Input validation
File validation
Signed object-storage URLs
Encryption at rest
Secrets via environment/secret manager
CORS policy
CSRF protection where applicable
SQL injection protection via ORM/parameterization
```

Never commit:

```text
DATABASE_URL
DATABASE_URL_MIGRATE
SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET
AWS_SECRET
API_KEYS
.any real .env values
```

to Git.

---

# 43. Local Development Stack (No Docker)

**Do not use Docker or Docker Compose for development.** Run everything as native processes on your machine, with Supabase as the hosted database.

## What runs locally on your PC

```text
Frontend     — Vite (npm run dev)           → http://localhost:5173
Backend      — FastAPI + uvicorn            → http://localhost:8000
Redis        — native install (Windows/WSL/macOS/Linux)
Celery       — local worker process(es)
Media        — ./data filesystem (or Supabase Storage)
```

## What runs on Supabase (cloud)

```text
PostgreSQL   — primary database
pgvector     — embeddings / similarity search
(optional) Storage — media files
(optional) Auth    — only if you later adopt Supabase Auth
```

## Local process layout

```text
                 Developer browser
                         |
                +--------+--------+
                |                 |
         Vite Frontend      FastAPI Backend
         :5173                  :8000
                                  |
               +------------------+------------------+
               |                  |                  |
       Supabase Postgres     Redis (local)    ./data or
       (hosted)              :6379            Supabase Storage
                                  |
                            Celery workers
                            (local Python)
                                  |
                             AI workers
                             (same machine / GPU)
```

## Host prerequisites (install once)

```text
- Git
- Node.js 20+ LTS + npm/pnpm
- Python 3.11+ (venv recommended)
- Redis (native):
    Windows: Memurai, Redis for Windows, or Redis inside WSL2
    macOS:   brew install redis
    Linux:   apt/yum install redis
- FFmpeg (for video/audio pipelines)
- CUDA toolkit (only when enabling GPU AI workers)
- Supabase account + project (for Postgres)
```

## Recommended local start scripts

Keep startup simple with repo scripts (PowerShell / bash), for example:

```text
scripts/dev-frontend.ps1   # npm run dev
scripts/dev-backend.ps1    # uvicorn app.main:app --reload --port 8000
scripts/dev-worker.ps1     # celery -A app.workers worker -l info
scripts/dev-all.ps1        # start backend + worker (frontend separate terminal)
```

No `docker compose up`. No local Postgres container.

---

# 44. Local Services & Process Map

Suggested **process / service names** (all local except DB):

```text
frontend          # Vite
backend           # FastAPI / uvicorn
redis             # native Redis
celery-worker     # Celery worker
celery-beat       # optional scheduler
```

Database (remote):

```text
supabase-postgres # hosted; connection via DATABASE_URL
```

Later local workers (still no Docker):

```text
ai-worker
lidar-worker
video-worker
audio-worker
embedding-worker
```

### Day-1 bring-up checklist

```text
1. Create Supabase project; copy DB URL; enable vector extension
2. Clone repo; copy .env.example → .env; fill secrets + DATABASE_URL
3. python -m venv .venv && activate; pip install -r requirements.txt
4. alembic upgrade head   # migrates against Supabase
5. Start Redis locally
6. Start backend (uvicorn)
7. Start Celery worker
8. cd frontend && npm install && npm run dev
9. Open http://localhost:5173
```

---

# 45. Environment Variables

Create `.env.example`.

```text
APP_ENV=development

# Supabase Postgres (required)
# Use Session/Direct URL for Alembic migrations
DATABASE_URL_MIGRATE=postgresql+psycopg://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
# Use Transaction pooler URL for the running API (recommended under load)
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres

# Local Redis (native, not Docker)
REDIS_URL=redis://127.0.0.1:6379/0

# Local filesystem object storage (default for local-first)
STORAGE_BACKEND=local
LOCAL_STORAGE_ROOT=./data

# Optional: Supabase Storage (S3-compatible) instead of local disk
# STORAGE_BACKEND=supabase
# SUPABASE_URL=https://[PROJECT-REF].supabase.co
# SUPABASE_SERVICE_ROLE_KEY=...
# SUPABASE_STORAGE_BUCKET=multimodal-data

JWT_SECRET=change-me-in-dev

CORS_ORIGINS=http://localhost:5173

GPU_ENABLED=false
```

Never commit the real `.env`.

**Notes for Supabase:**

- Prefer **IPv4-compatible / pooler** URLs if your network has IPv6 issues
- Turn on SSL (`sslmode=require`) as required by Supabase connection docs
- Keep `DATABASE_URL_MIGRATE` (session) separate from pooled `DATABASE_URL` when using transaction pooling
- Restrict which IPs can connect in Supabase network settings if your plan supports it

---

# 46. Development Machine

For development:

```text
CPU: 16+ cores
RAM: 64-128 GB
GPU: RTX 4090 24 GB or better
Storage: 2-4 TB NVMe
Network: 1 Gbps+
```

An RTX 4090-class machine is enough to develop the platform and test many AI workloads.

---

# 47. Production Architecture

Start with a few well-defined services. Still no requirement for Docker Desktop on developer machines; production may use VMs, systemd, or a PaaS.

```text
             Load Balancer / CDN
                   |
             Nginx / Gateway (optional)
                   |
       +-----------+-----------+
       |                       |
   Frontend                 FastAPI
   (static / SSR)              |
       +-----------+-----------+
       |           |           |
 Supabase       Redis       Object Storage
 Postgres                   (Supabase Storage / S3)
                   |
                 Workers
                   |
         +---------+---------+
         |         |         |
        GPU      GPU       CPU
       Vision    3D       Processing
```

Do not start with Kubernetes unless you actually need it.
Do not introduce Docker solely for local development — keep local = native processes + Supabase.
---

# 48. Monitoring

Use:

```text
Prometheus
Grafana
Loki
```

Monitor:

```text
CPU
RAM
GPU
VRAM
API latency
Database connections
Redis queue
Celery jobs
Storage
Upload speed
Annotation throughput
AI inference time
Error rate
```

---

# 49. Testing Strategy

## Frontend

```text
Unit tests
Component tests
Integration tests
E2E tests
```

Recommended:

```text
Vitest
React Testing Library
Playwright
```

## Backend

```text
pytest
```

Test:

```text
API
Authentication
Permissions
Annotation CRUD
Dataset import
Export
QA
AI jobs
```

## Data tests

Test:

```text
COCO export
YOLO export
KITTI export
Pose conversion
Coordinate transformation
LiDAR projection
Timestamp synchronization
```

---

# 50. Performance Testing

Test with:

```text
10K images
100K images
1M images
Large videos
Large audio
Millions of points
Multiple concurrent annotators
```

Measure:

```text
Initial page load
Sample loading
Annotation latency
3D rendering FPS
API latency
Upload throughput
Search latency
Export time
AI inference time
```

---

# 51. Browser Performance Rules

Do not:

```text
Load entire dataset into React
Load entire point cloud into memory
Render thousands of DOM objects
Send huge JSON payloads
Process multi-GB files synchronously
```

Instead:

```text
Pagination
Virtualization
Web Workers
Chunking
LOD
Lazy loading
Streaming
Caching
GPU rendering
```

---

# 52. Dataset Explorer Performance

Use:

```text
Virtualized grid
Server-side filtering
Cursor pagination
Thumbnail CDN/cache
Metadata indexing
Parquet/DuckDB analytics
```

Do not retrieve 100,000 samples in one API call.

---

# 53. Point Cloud Performance

Use:

```text
Octree
LOD
Spatial tiling
Frustum culling
GPU buffers
Point batching
Progressive loading
```

Only request points visible in the current viewport.

---

# 54. Annotation Collaboration

Later support:

```text
User A annotates
User B reviews
User C observes
```

Realtime events through WebSocket.

Avoid conflicting edits using:

```text
Object locking
Task locking
Optimistic concurrency
Annotation version numbers
```

---

# 55. Active Learning

Implement after the core platform is stable.

```text
Dataset
  |
  v
Train Model
  |
  v
Prediction
  |
  v
Uncertainty
  |
  v
Hard Sample Selection
  |
  v
Annotation Queue
  |
  v
Corrected Ground Truth
  |
  v
Retraining
```

---

# 56. Dataset Health Dashboard

Create:

```text
DATASET HEALTH

Total Samples             100,000
Annotated                  92,400
Pending                     7,600

Class Balance               Good
Duplicates                  1.8%
Missing Data                0.7%
Low Confidence              4.2%
IAA                         0.78
QA Rejection                5.1%
```

---

# 57. Annotator Dashboard

```text
MY WORK

Assigned Tasks             120
Completed                    82
Pending                      38

Average Time                42 sec
QA Acceptance               93%
Gold Accuracy               96%
IAA                          0.84
```

---

# 58. Project Manager Dashboard

```text
PROJECT STATUS

Dataset Size             250,000
Completed                72%
QA                       61%
IAA                       0.81

Annotators                 18
QA Reviewers                3

Estimated Completion      4 days
```

---

# 59. Research Dashboard

Include:

```text
Dataset statistics
Class distribution
Annotation statistics
IAA
Annotator statistics
Model performance
Prediction errors
Embedding visualization
Outliers
Duplicates
Dataset versions
Export history
```

---

# 60. SDK

After the web platform is stable, create a Python SDK.

Example:

```python
from multimodal_sdk import Dataset

dataset = Dataset("traffic")

dataset.filter(
    label="pedestrian",
    confidence="<0.5"
)

dataset.visualize()
```

Also support:

```python
dataset.export("coco")
dataset.export("yolo")
dataset.samples()
dataset.statistics()
dataset.embeddings()
```

---

# 61. CLI

Eventually:

```bash
mira-studio login

mira-studio dataset create traffic

mira-studio dataset upload ./data

mira-studio dataset export traffic --format coco

mira-studio model run --model yolo

mira-studio dataset stats traffic
```

---

# 62. Plugin Architecture

Build modality-specific components as plugins.

```text
Core Platform
|
+-- Image Plugin
+-- Video Plugin
+-- Audio Plugin
+-- Text Plugin
+-- Document Plugin
+-- Pose Plugin
+-- LiDAR Plugin
+-- Point Cloud Plugin
+-- Medical Plugin
+-- Multimodal Plugin
```

Future:

```text
Radar
Thermal
Hyperspectral
Satellite
NeRF
Gaussian Splatting
EEG
ECG
PPG
IMU
```

---

# 63. Recommended Repository

```text
mi-ra-studio/
|
+-- frontend/
|
+-- backend/
|
+-- ai-services/
|
+-- processing/
|
+-- visualization/
|
+-- exporters/
|
+-- database/                 # Alembic migrations + SQL helpers for Supabase
|
+-- scripts/                  # local start scripts (no Docker)
|   +-- dev-frontend.ps1
|   +-- dev-backend.ps1
|   +-- dev-worker.ps1
|   +-- setup-local.ps1
|
+-- data/                     # local media root (gitignored)
|
+-- tests/
|
+-- docs/
|
+-- sdk/
|
+-- cli/
|
+-- .github/
|
+-- .env.example
+-- README.md
```

**Explicitly not required in the repo:** `docker/`, `Dockerfile`, `docker-compose.yml`.

---

# 64. Development Phases

Do NOT build every modality at once.

## Phase 1 — Foundation

Build:

```text
Authentication
Organizations
Projects
Datasets
File upload
Local filesystem / Supabase Storage
Supabase Postgres
Task system
```

## Phase 2 — Image Annotation

Build:

```text
Image viewer
Bounding box
Polygon
Polyline
Classification
Keypoints
Mask
Attributes
Undo/redo
Export
```

## Phase 3 — Video

Build:

```text
Timeline
Frame navigation
Keyframes
Tracking
Interpolation
Temporal annotation
```

## Phase 4 — Dataset Explorer

Build:

```text
Gallery
Filtering
Search
Metadata
Statistics
Annotation visualization
```

## Phase 5 — Audio/Text

Build:

```text
Waveform
Transcription
Speaker segments
Text spans
NER
Relations
```

## Phase 6 — Pose

Build:

```text
2D pose
3D pose
Custom skeleton
Pose tracking
Joint error
```

## Phase 7 — LiDAR/3D

Build:

```text
Three.js viewer
Point cloud
3D cuboid
BEV
3D segmentation
Tracking
Camera projection
```

## Phase 8 — Multimodal

Build:

```text
Global timeline
RGB
LiDAR
Depth
Audio
IMU
GPS
EEG
ECG
PPG
```

## Phase 9 — AI

Build:

```text
YOLO
Segmentation
Pose
OCR
ASR
3D detection
Embeddings
AI pre-labeling
```

## Phase 10 — Intelligence

Build:

```text
Active learning
Embedding search
Outlier detection
Duplicate detection
Advanced QA
Dataset health
```

---

# 65. MVP Scope

The first usable release should NOT include every feature.

Build this MVP:

```text
Authentication
        |
Projects
        |
Datasets
        |
Image Upload
        |
Image Annotation
        |
Bounding Box
Polygon
Classification
        |
Task Assignment
        |
QA Review
        |
Export
        |
Dataset Explorer
```

Then add:

```text
Video
        ↓
Audio
        ↓
Pose
        ↓
LiDAR
        ↓
Multimodal
        ↓
AI
```

---

# 66. First Development Milestone

The first milestone should produce this:

```text
Login
   |
   v
Dashboard
   |
   v
Create Project
   |
   v
Create Dataset
   |
   v
Upload Images
   |
   v
Create Annotation Schema
   |
   v
Open Annotation Studio
   |
   v
Draw Bounding Boxes
   |
   v
Save Annotation
   |
   v
Submit Task
   |
   v
QA Review
   |
   v
Accept/Reject
   |
   v
Dataset Explorer
   |
   v
Export COCO/YOLO
```

Only after this works reliably should the 3D/LiDAR and multimodal layers be added.

---

# 67. Final Target Product

The finished platform should look conceptually like:

```text
                 MULTIMODAL DATA PLATFORM
                          |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
 Annotation Studio   Dataset Explorer    Analytics
       |                  |                  |
       v                  v                  v
 Image               Gallery             Statistics
 Video               Filters             IAA
 Audio               Similarity          Quality
 Text                Embeddings          Models
 LiDAR               Outliers            Errors
 Pose                Duplicates
 Medical
 Multimodal
       |
       v
    AI Assist
       |
       +-- Detection
       +-- Segmentation
       +-- Pose
       +-- OCR
       +-- ASR
       +-- Tracking
       +-- 3D Detection
       +-- Embeddings
       |
       v
      QA
       |
       +-- Human Review
       +-- Gold Tasks
       +-- IAA
       +-- Annotator Metrics
       |
       v
    EXPORT
       |
       +-- COCO
       +-- YOLO
       +-- KITTI
       +-- MPII
       +-- JSON
       +-- CSV
       +-- Custom
```

---

# 68. Final Technology Recommendation

For the first complete version, use exactly this baseline:

```text
FRONTEND
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Zustand
TanStack Query
Konva.js
Three.js
Wavesurfer.js

BACKEND
Python
FastAPI
Pydantic
SQLAlchemy
Alembic

DATA
Supabase Postgres
Redis (local native)
Local filesystem storage / Supabase Storage
DuckDB
Parquet
pgvector (on Supabase)

PROCESSING
Celery (local workers)
OpenCV
Open3D
FFmpeg

AI
PyTorch
Transformers
YOLO-compatible models
Segmentation models
Pose models
Whisper-compatible ASR

INFRASTRUCTURE
Local native processes (no Docker for development)
Supabase (hosted Postgres ± Storage)
Optional Nginx for production
NVIDIA CUDA (when GPU workers are enabled)

MONITORING
Prometheus
Grafana
Loki
(optional in early local phases)

TESTING
pytest
Vitest
React Testing Library
Playwright
```

---

# 69. Most Important Architectural Rule

Keep these five engines independent:

```text
                 CORE PLATFORM
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
 Annotation       Visualization      Dataset
   Engine             Engine          Engine
       |               |               |
       +---------------+---------------+
                       |
                +------+------+
                |             |
                v             v
              QA Engine     AI Engine
```

**Annotation Engine** defines what an annotation is.

**Visualization Engine** defines how it is displayed.

**Dataset Engine** defines how data is organized and searched.

**QA Engine** defines whether the data is trustworthy.

**AI Engine** accelerates annotation and analysis.

This separation is what will allow you to add **new modalities later without rewriting the whole platform**.

---

# 70. Start-to-End Build Order

Follow this exact order:

```text
STEP 01  Define requirements
STEP 02  Define annotation data model
STEP 03  Define database schema (Supabase Postgres)
STEP 04  Define annotation schema format
STEP 05  Create Git repository
STEP 06  Create local env (venv, Node, Redis, .env) — no Docker
STEP 07  Create Supabase project + enable pgvector
STEP 08  Wire DATABASE_URL / migrate with Alembic against Supabase
STEP 09  Setup local Redis
STEP 10  Setup local filesystem storage (./data) or Supabase Storage
STEP 11  Create FastAPI backend (uvicorn local)
STEP 12  Create React frontend (Vite local)
STEP 13  Implement authentication
STEP 14  Implement projects
STEP 15  Implement datasets
STEP 16  Implement uploads
STEP 17  Implement object storage abstraction
STEP 18  Implement annotation schema builder
STEP 19  Implement image viewer
STEP 20  Implement image annotations
STEP 21  Implement annotation persistence
STEP 22  Implement task assignment
STEP 23  Implement QA
STEP 24  Implement dataset explorer
STEP 25  Implement exports
STEP 26  Implement video engine
STEP 27  Implement audio engine
STEP 28  Implement text engine
STEP 29  Implement pose engine
STEP 30  Implement Three.js 3D viewer
STEP 31  Implement point-cloud processing
STEP 32  Implement LiDAR annotation
STEP 33  Implement camera/LiDAR calibration
STEP 34  Implement multimodal timeline
STEP 35  Implement AI service
STEP 36  Implement model registry
STEP 37  Implement embeddings
STEP 38  Implement similarity search (pgvector on Supabase)
STEP 39  Implement advanced QA/IAA
STEP 40  Implement active learning
STEP 41  Performance optimization
STEP 42  Security hardening
STEP 43  Automated testing
STEP 44  Monitoring
STEP 45  Production deployment
STEP 46  SDK
STEP 47  CLI
STEP 48  Plugin ecosystem
```

---

# 71. First 4 Components to Build

Do not start with AI.

Build these first:

```text
1. Annotation Data Model
2. Annotation Schema Builder
3. Visualization Engine
4. Dataset Explorer
```

Once these four are correct, the rest of the modalities can plug into the same foundation.

## Final Goal

The platform should eventually be capable of:

**Upload → Organize → Visualize → Annotate → AI Pre-label → Track → Review → Measure IAA → Analyze → Search → Version → Export → Train Model → Evaluate → Re-annotate**

across **image, video, audio, text, documents, pose, 3D, LiDAR, depth, medical and synchronized multimodal sensor data**.

That should be the complete architectural blueprint for starting the implementation.
