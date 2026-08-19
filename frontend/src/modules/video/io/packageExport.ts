import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { qaSummary, runAllQa } from '@/modules/video/qa/validateAnnotations'
import {
  exportCoco,
  exportCsv,
  exportCvat,
  exportKeypoints,
  exportMot,
  exportNativeJson,
  exportSrt,
} from '@/modules/video/io/exportFormats'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

export interface PackageMeta {
  itemId: string
  filename: string
  width: number
  height: number
  fps: number
  frameCount: number
}

export function buildPackageFiles(store: VideoAnnotationStore, meta: PackageMeta) {
  const stats = collectItemStats(store, meta)
  const qa = runAllQa(store, meta.fps)
  const readme = `# MI-RA Dataset Package

Item: ${meta.filename}
Frames: ${meta.frameCount}
FPS: ${meta.fps}

## Structure
- videos/ — original media placeholder
- frames/ — extracted frames (optional)
- masks/ — PNG masks (optional)
- annotations/ — objects, tracks, keypoints, segmentation, events, actions, relationships
- metadata/ — probe and package info
- qa/ — validation report
- statistics/ — counts
`

  return {
    'README.md': readme,
    'annotations/objects.json': JSON.stringify(store.rects, null, 2),
    'annotations/tracks.json': JSON.stringify(
      [...new Set(store.rects.map((r) => r.object_id))].map((id) => ({
        object_id: id,
        frames: store.rects.filter((r) => r.object_id === id).map((r) => r.frame),
      })),
      null,
      2,
    ),
    'annotations/keypoints.json': exportKeypoints(store),
    'annotations/segmentation.json': JSON.stringify(store.masks.map((m) => ({ object_id: m.object_id, frame: m.frame, rle: m.rle })), null, 2),
    'annotations/events.json': JSON.stringify(store.events, null, 2),
    'annotations/actions.json': JSON.stringify(store.actions, null, 2),
    'annotations/relationships.json': JSON.stringify(store.relations, null, 2),
    'metadata/item.json': JSON.stringify(meta, null, 2),
    'metadata/mira.json': exportNativeJson(store, meta.itemId),
    'qa/report.json': JSON.stringify({ issues: qa, summary: qaSummary(qa) }, null, 2),
    'statistics/counts.json': JSON.stringify(stats, null, 2),
    'export/objects.csv': exportCsv(store),
    'export/mot.txt': exportMot(store),
    'export/cvat.xml': exportCvat(store, meta.itemId),
    'export/coco.json': JSON.stringify(exportCoco(store, meta.itemId, meta.width, meta.height), null, 2),
    'export/events.srt': exportSrt(store, meta.fps),
  }
}

export function collectItemStats(store: VideoAnnotationStore, meta: PackageMeta) {
  const objectIds = new Set(store.rects.map((r) => r.object_id))
  const annotatedFrames = new Set([
    ...store.rects.map((r) => r.frame),
    ...store.skeletons.map((s) => s.frame),
    ...store.masks.map((m) => m.frame),
  ])
  return {
    videos: 1,
    total_frames: meta.frameCount,
    annotated_frames: annotatedFrames.size,
    objects: store.rects.length,
    tracks: objectIds.size,
    keyframes: store.rects.length,
    masks: store.masks.length,
    events: store.events.length,
    actions: store.actions.length,
    relations: store.relations.length,
    qa_errors: qaSummary(runAllQa(store, meta.fps)).errors,
  }
}

export async function downloadDatasetZip(store: VideoAnnotationStore, meta: PackageMeta) {
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
  const files = buildPackageFiles(store, meta)
  for (const [path, content] of Object.entries(files)) {
    await zipWriter.add(path, new TextReader(content))
  }
  const blob = await zipWriter.close()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `MI-RA-Dataset-${meta.itemId.slice(0, 8)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
