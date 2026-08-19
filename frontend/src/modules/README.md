# Annotation modules

Each modality is a separate package. Finish one, freeze it, then start the next.

| Module | Frontend | Backend | Status |
|--------|----------|---------|--------|
| Image | `src/modules/image` | `app/modules/image` | Live — freeze except image bugs |
| Video | `src/modules/video` | `app/modules/video` | Not started |
| Audio | `src/modules/audio` | `app/modules/audio` | Not started |
| Text | `src/modules/text` | `app/modules/text` | Not started |
| Document | `src/modules/document` | `app/modules/document` | Not started |
| Pose | `src/modules/pose` | `app/modules/pose` | Not started (2D pose in image studio is image-only) |
| Point cloud | `src/modules/pointcloud` | `app/modules/pointcloud` | Not started |
| LiDAR | `src/modules/lidar` | `app/modules/lidar` | Not started |
| Medical | `src/modules/medical` | `app/modules/medical` | Not started |
| Geospatial | `src/modules/geospatial` | `app/modules/geospatial` | Not started |
| Multimodal | `src/modules/multimodal` | `app/modules/multimodal` | Not started |

Cross-module imports go through each module's `index.ts` only.
