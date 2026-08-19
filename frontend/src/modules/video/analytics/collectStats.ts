import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { collectItemStats } from '@/modules/video/io/packageExport'
import { qaSummary, runAllQa } from '@/modules/video/qa/validateAnnotations'

export interface DatasetAnalytics {
  videos: number
  total_frames: number
  annotated_frames: number
  objects: number
  tracks: number
  keyframes: number
  masks: number
  events: number
  qa_errors: number
}

export function emptyAnalytics(): DatasetAnalytics {
  return {
    videos: 0,
    total_frames: 0,
    annotated_frames: 0,
    objects: 0,
    tracks: 0,
    keyframes: 0,
    masks: 0,
    events: 0,
    qa_errors: 0,
  }
}

export function scanLocalVideoAnalytics(): DatasetAnalytics {
  const totals = emptyAnalytics()
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k?.startsWith('mira.video.annotations.')) continue
    try {
      const store = JSON.parse(localStorage.getItem(k) || '{}') as VideoAnnotationStore
      const fps = 30
      const stats = collectItemStats(store, {
        itemId: k.slice('mira.video.annotations.'.length),
        filename: k,
        width: 1280,
        height: 720,
        fps,
        frameCount: Math.max(
          0,
          ...store.rects.map((r) => r.frame),
          ...store.events.map((e) => e.end_frame ?? e.frame),
        ) + 1,
      })
      totals.videos += 1
      totals.total_frames += stats.total_frames
      totals.annotated_frames += stats.annotated_frames
      totals.objects += stats.objects
      totals.tracks += stats.tracks
      totals.keyframes += stats.keyframes
      totals.masks += stats.masks
      totals.events += stats.events
      totals.qa_errors += qaSummary(runAllQa(store, fps)).errors
    } catch {
      /* skip */
    }
  }
  return totals
}
