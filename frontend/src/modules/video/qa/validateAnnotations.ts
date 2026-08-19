import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import type { VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { VideoTrack } from '@/modules/video/timeline/track.types'
import { buildVideoTracksFromAll } from '@/modules/video/timeline/trackOps'

export type QaSeverity = 'error' | 'warning' | 'info'

export interface QaIssue {
  id: string
  code: string
  severity: QaSeverity
  message: string
  object_id?: string
  frame?: number
}

function issue(code: string, severity: QaSeverity, message: string, extra?: Partial<QaIssue>): QaIssue {
  return { id: `${code}:${extra?.object_id ?? ''}:${extra?.frame ?? ''}`, code, severity, message, ...extra }
}

export function isInvalidGeometry(r: VideoRectObject) {
  return r.width <= 0 || r.height <= 0 || !Number.isFinite(r.x) || !Number.isFinite(r.y)
}

export function isEmptyMask(m: VideoMaskObject) {
  return !m.rle?.counts?.length || m.rle.counts.every((c) => c === 0)
}

/** Task 27.1 — annotation validation. */
export function validateAnnotations(store: VideoAnnotationStore): QaIssue[] {
  const issues: QaIssue[] = []
  const ids = new Set<string>()

  for (const r of store.rects) {
    if (!r.label?.trim()) {
      issues.push(issue('missing_label', 'error', `Missing label on ${r.object_id}`, { object_id: r.object_id, frame: r.frame }))
    }
    if (isInvalidGeometry(r)) {
      issues.push(issue('invalid_geometry', 'error', `Invalid bbox ${r.object_id} at f${r.frame + 1}`, { object_id: r.object_id, frame: r.frame }))
    }
    if (ids.has(r.id)) {
      issues.push(issue('duplicate_ids', 'error', `Duplicate annotation id ${r.id}`, { object_id: r.object_id, frame: r.frame }))
    }
    ids.add(r.id)
  }

  const objectIds = store.rects.map((r) => r.object_id)
  const dupObjects = objectIds.filter((id, i) => {
    const sameFrame = store.rects.filter((r) => r.object_id === id && r.frame === store.rects[i]?.frame)
    return sameFrame.length > 1
  })
  for (const id of [...new Set(dupObjects)]) {
    issues.push(issue('duplicate_ids', 'warning', `Duplicate object_id instances for ${id}`, { object_id: id }))
  }

  const tracks = buildVideoTracksFromAll(store.rects, store.skeletons, store.masks)
  for (const t of tracks) {
    if (t.keyframes.length < 2 && t.end_frame === t.start_frame) continue
    const span = t.end_frame - t.start_frame + 1
    if (span > 1 && t.keyframes.length === 1) {
      issues.push(issue('broken_track', 'warning', `Track ${t.object_id} has only one keyframe over a range`, { object_id: t.object_id }))
    }
  }

  for (const m of store.masks) {
    if (isEmptyMask(m)) {
      issues.push(issue('empty_mask', 'error', `Empty mask ${m.object_id} at f${m.frame + 1}`, { object_id: m.object_id, frame: m.frame }))
    }
  }

  return issues
}

function centroid(r: VideoRectObject) {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}

/** Task 27.2 — temporal validation. */
export function validateTemporal(store: VideoAnnotationStore, fps: number, maxJumpPx = 200): QaIssue[] {
  const issues: QaIssue[] = []
  const byId = new Map<string, VideoRectObject[]>()
  for (const r of store.rects) {
    const list = byId.get(r.object_id) ?? []
    list.push(r)
    byId.set(r.object_id, list)
  }

  for (const [objectId, kfs] of byId) {
    const sorted = [...kfs].sort((a, b) => a.frame - b.frame)
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1]
      const b = sorted[i]
      const gap = b.frame - a.frame
      if (gap > Math.max(2, Math.round(fps))) {
        issues.push(
          issue('track_gap', 'warning', `Track gap ${gap} frames on ${objectId} (f${a.frame + 1}→${b.frame + 1})`, {
            object_id: objectId,
            frame: b.frame,
          }),
        )
      }
      const ca = centroid(a)
      const cb = centroid(b)
      const dist = Math.hypot(cb.x - ca.x, cb.y - ca.y)
      if (dist > maxJumpPx && gap <= 2) {
        issues.push(
          issue('sudden_jump', 'warning', `Sudden jump ${dist.toFixed(0)}px on ${objectId}`, {
            object_id: objectId,
            frame: b.frame,
          }),
        )
      }
      const dt = gap / Math.max(fps, 1)
      const speed = dist / Math.max(dt, 1e-3)
      if (speed > 4000) {
        issues.push(
          issue('impossible_movement', 'error', `Impossible speed ${speed.toFixed(0)} px/s on ${objectId}`, {
            object_id: objectId,
            frame: b.frame,
          }),
        )
      }
      if (a.label !== b.label) {
        issues.push(
          issue('id_switch', 'warning', `Label/ID switch on ${objectId}: ${a.label} → ${b.label}`, {
            object_id: objectId,
            frame: b.frame,
          }),
        )
      }
    }
  }
  return issues
}

/** Task 27.3 — AI confidence QA (flag < 50%). */
export function validateConfidence(store: VideoAnnotationStore, threshold = 0.5): QaIssue[] {
  const issues: QaIssue[] = []
  for (const r of store.rects) {
    const conf = Number(r.attributes?.confidence ?? r.attributes?.track_confidence)
    if (Number.isFinite(conf) && conf < threshold) {
      issues.push(
        issue('low_confidence', 'warning', `Confidence ${(conf * 100).toFixed(0)}% < ${threshold * 100}% on ${r.object_id}`, {
          object_id: r.object_id,
          frame: r.frame,
        }),
      )
    }
  }
  return issues
}

export function runAllQa(store: VideoAnnotationStore, fps: number): QaIssue[] {
  return [...validateAnnotations(store), ...validateTemporal(store, fps), ...validateConfidence(store)]
}

export function qaSummary(issues: QaIssue[]) {
  return {
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
    total: issues.length,
  }
}

export type { VideoTrack }
