# MI-RA Studio — Video Annotation Module Specification

**Phase 0 · Frozen architecture**  
**Status:** Specification (implementation follows phased plan)  
**Image module:** Frozen — no video features in `modules/image`

---

## 1. Purpose

This document defines the **scope, boundaries, and capabilities** of the MI-RA Studio video annotation module. It is the contract for all frontend (`frontend/src/modules/video/`) and backend (`backend/app/modules/video/`) work.

Video annotation extends the platform’s universal annotation model with **time** as a first-class dimension: frames, tracks, keyframes, events, actions, audio alignment, multi-camera sync, and optional 3D.

---

## 2. Module boundaries

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Video studio UI | `frontend/src/modules/video/` | Player, timeline, tools, tracks panel, export UI |
| Video services | `backend/app/modules/video/` | Probe, ingest, frame index, video export, video QA helpers |
| Shared platform | `frontend/src/features/`, `backend/app/api/`, `backend/app/models/` | Projects, datasets, auth, tasks, universal annotation CRUD |
| Frozen | `frontend/src/modules/image/` | Image-only studio — import types only, no edits |

**Routes**

| Modality | Route |
|----------|--------|
| Image | `/annotate/:itemId` |
| Video | `/annotate/video/:itemId` |

---

## 3. Scope matrix

Each row is **in scope** for the video module. Implementation phase is noted; v1 target is Phase 1–3 unless marked later.

### 3.1 Video annotation (container-level)

| Capability | Description | Phase |
|------------|-------------|-------|
| Video ingest | MP4, AVI, MOV, MKV, WebM, MPEG, MPG, M4V, WMV, FLV, TS, MTS, M2TS, 3GP | 1 |
| Codec probe | H.264, H.265/HEVC, VP8, VP9, AV1, ProRes (where FFmpeg supports) | 1 |
| Metadata display | Resolution, FPS, duration, frame count, aspect ratio, codec, bitrate, audio channels/rate, file size, color space, GOP/keyframes | 1 |
| Upload paths | Single, multi, folder, drag-drop, ZIP, local attach, server upload | 1 |
| Advanced import | URL, cloud, image-sequence→video, annotated dataset import | 2–4 |
| Organization | Projects, datasets, folders, tags, tasks, jobs, versions | 1 (reuse platform) |

### 3.2 Frame annotation

| Capability | Description | Phase |
|------------|-------------|-------|
| Frame navigation | Scrubber, step frame, jump to time/frame, go to keyframe | 1 |
| Per-frame shapes | Bbox, polygon, mask, point, line (reuse image geometry JSON) | 1 |
| Frame snapshot | Display frame at `frame_index`; optional cached JPEG/WebP per frame | 1 |
| Zoom / pan | Same interaction model as image studio | 1 |
| Multi-frame edit | Copy shape to frame, paste, propagate | 2 |

### 3.3 Temporal annotation

| Capability | Description | Phase |
|------------|-------------|-------|
| Time range labels | Start/end time or frame range on object or span | 1 |
| Span tools | Temporal segment (e.g. `{ start_sec, end_sec }` or frame indices) | 1 |
| Interpolation | Linear bbox/keypoint between keyframes | 2 |
| Timeline layers | Separate tracks for objects, events, audio, QA markers | 1 |

### 3.4 Object tracking

| Capability | Description | Phase |
|------------|-------------|-------|
| Track identity | Stable `track_id` across frames | 1 |
| Track table | `AnnotationTrack` + linked `AnnotationObject` per keyframe | 1 |
| Track lifecycle | Create, merge, split, delete track | 2 |
| Interpolation modes | None, linear, constant (hold) | 2 |
| Re-ID / manual link | Link same object after occlusion | 3 |

### 3.5 Segmentation (video)

| Capability | Description | Phase |
|------------|-------------|-------|
| Instance mask per frame | RLE / polygon with `frame_index` | 2 |
| Mask propagation | Propagate mask to next N frames or track | 3 |
| Video semantic regions | Time-varying semantic class spans | 3 |
| AI segment | SAM / YOLO-seg on current frame (server inference) | 2 |

### 3.6 Pose & skeleton (video)

| Capability | Description | Phase |
|------------|-------------|-------|
| Per-frame keypoints | COCO-17 (or schema-defined) with `frame_index` | 2 |
| Skeleton track | Keypoints linked via track + keyframe interpolation | 2 |
| Pose edit | Drag joints on current frame | 2 |
| AI pose | YOLO-pose on current frame | 2 |

### 3.7 Events

| Capability | Description | Phase |
|------------|-------------|-------|
| Event definition | Named event type from label schema | 2 |
| Instant event | Single timestamp / frame | 2 |
| Interval event | Start–end time range | 2 |
| Event timeline | Dedicated lane on timeline | 2 |

### 3.8 Actions

| Capability | Description | Phase |
|------------|-------------|-------|
| Action label | Verb + actor (track) + optional object | 3 |
| Action span | Time range with action class | 3 |
| Action hierarchy | Nested or sequential actions | 4 |

### 3.9 Audio

| Capability | Description | Phase |
|------------|-------------|-------|
| Waveform display | Derived from video audio or separate file | 2 |
| Audio sync | Align annotations to `time_sec` | 1 |
| Separate audio track | Dataset item type audio linked to video | 3 |
| Transcription overlay | ASR spans (future `modules/audio`) | 4 |

### 3.10 Multi-camera

| Capability | Description | Phase |
|------------|-------------|-------|
| Camera groups | Dataset collection of synced videos | 3 |
| Shared timeline | Master clock; per-camera items | 3 |
| Cross-camera track ID | Same logical object across cameras | 4 |

### 3.11 3D (video context)

| Capability | Description | Phase |
|------------|-------------|-------|
| 2.5D cuboid on frame | Reuse image cuboid geometry per frame | 3 |
| Camera calibration | Intrinsics/extrinsics in item `metadata` | 4 |
| LiDAR sync | Via multimodal dataset; not in video v1 | 4+ |

### 3.12 AI-assisted annotation

| Capability | Description | Phase |
|------------|-------------|-------|
| Detect on frame | YOLO bbox/polygon (existing inference API) | 2 |
| Segment on frame | SAM prompts (existing inference API) | 2 |
| Pose on frame | YOLO-pose | 2 |
| Track init + propagate | Detector seed + manual/keyframe refine | 3 |
| Batch pre-label | Celery job per dataset (keyframes only v1) | 2 |
| Model registry UI | `/models` page (platform) | 3 |

### 3.13 Quality assurance (QA)

| Capability | Description | Phase |
|------------|-------------|-------|
| Review workflow | Reuse `Review`, annotation status enum | 1 |
| QA rules | Missing keyframes, track gaps, label validation | 2 |
| QA results | `QAResult` linked to annotation | 2 |
| Gold samples | `GoldSample` comparison | 3 |
| Consensus | Multi-annotator merge | 4 |

### 3.14 Import / export

| Format | Direction | Phase |
|--------|-----------|-------|
| Native JSON | Import / export | 1 |
| COCO-Video / MOT | Export | 2 |
| CVAT for video | Import / export | 2 |
| Label Studio video | Export | 3 |
| KITTI tracking | Export | 3 |
| Waymo / nuScenes | Export (subset) | 4 |

---

## 4. User-facing studio layout (target)

```
┌─────────────────────────────────────────────────────────────┐
│ Header · save · submit · AI · settings                      │
├──────────┬──────────────────────────────┬───────────────────┤
│ Tool     │  Video canvas (current frame) │ Objects / tracks │
│ panel    │                               │ Events / props   │
│          ├──────────────────────────────┤                   │
│          │  Timeline (frames · tracks ·  │                   │
│          │  events · waveform)           │                   │
├──────────┴──────────────────────────────┴───────────────────┤
│ Dataset tree · item nav                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Tool registry (video module)

Video tools live in `frontend/src/modules/video/tools/registry.ts` (to be created). Categories:

- **Navigation:** play/pause, step, jump, zoom, pan  
- **Geometry:** bbox, polygon, mask, point, line, cuboid  
- **Temporal:** span, keyframe toggle, interpolate  
- **Tracking:** new track, link, merge, split  
- **Events / actions:** instant event, interval event, action span  
- **AI:** detect, segment, pose, track-assist  
- **QA:** flag frame, add review note  

Image tool registry is **not** extended for video.

---

## 6. Non-goals (video v1)

- Full LiDAR / point-cloud studio inside video module  
- Real-time collaborative editing (single user v1)  
- Training pipeline / model fine-tuning UI  
- Replacing image studio or merging image+video on one page  

---

## 7. Dependencies

| Dependency | Use |
|------------|-----|
| FFmpeg / ffprobe | Probe, thumbnails, optional frame extraction |
| Platform PostgreSQL | All persistent entities |
| Redis + Celery | Video processing queue (`video` queue) |
| Existing inference API | Frame-level AI assist |
| Konva or canvas | Frame overlay (reuse patterns from image) |
| HTML5 `<video>` | Playback (codec limited by browser) |

---

## 8. Phased delivery (summary)

| Phase | Focus |
|-------|--------|
| **0** | This spec + data model (frozen architecture) |
| **1** | Ingest, probe, upload, route, basic player + frame scrub + bbox per frame |
| **2** | Tracks, keyframes, interpolation, events, export MOT/COCO-Video |
| **3** | Masks, pose tracks, multi-camera groups, advanced QA |
| **4** | Actions, 3D calibration, cloud/URL import, consensus |

---

## 9. References

- Platform blueprint: `Universal_Multimodal_Annotation_Platform_Blueprint.md`
- Image module (frozen): `frontend/src/modules/image/README.md`
- Data model: `backend/app/modules/video/DATA_MODEL.md`
- Workspace rule: `.cursor/rules/modality-modules.mdc`

---

## 10. Approval

This specification is **frozen for Phase 0**. Changes require explicit version bump in this file (`spec_version` in metadata below).

```yaml
spec_version: "0.1.0"
module: video
frozen_date: "2026-08-19"
image_module: frozen
```
