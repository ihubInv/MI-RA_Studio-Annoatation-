# Image annotation module

Single home for all image annotation UI. The old `src/annotation/image/` gitkeep scaffold is retired.

```text
modules/image/
  pages/     ImageStudioPage
  panels/    ToolPanel, ClassManager
  tools/     tool registry + shortcuts
  canvas/    Konva shapes, drafts, RLE masks
  gallery/   dataset thumbnail overlays
  schema/    label classes
  ai/        on-device assist
  api/       schema HTTP client
```

Import from `@/modules/image` only. Do not add video/audio/LiDAR code here.
