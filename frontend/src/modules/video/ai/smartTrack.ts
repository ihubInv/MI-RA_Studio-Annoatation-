/**
 * Phase 17 — Smart Tracking
 * Client-side track analysis + suggestion generation for existing annotations.
 */
import { bracketKeyframes, interpolateRect } from '@/modules/video/canvas/interpolation'
import { iouMatch, type AiDetectSuggestion, type AiSmartHint } from '@/modules/video/ai/mapAiResults'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import type { VideoTrack } from '@/modules/video/timeline/track.types'

export interface TrackGap {
  object_id: string
  class_name: string
  start_frame: number
  end_frame: number
  open?: boolean
}

export interface IdSwitchEvent {
  object_id: string
  class_name: string
  frame: number
  match_iou: number
  reason?: string
}

export interface ReIdCandidate {
  object_id: string
  class_name: string
  frame: number
  candidate_object_id: string
  reid_score: number
  x: number
  y: number
  width: number
  height: number
}

export interface SmartTrackAnalysis {
  keyframe_hints: AiSmartHint[]
  gaps: TrackGap[]
  id_switches: IdSwitchEvent[]
  reid_candidates: ReIdCandidate[]
  low_confidence_frames: number[]
}

const DEFAULT_GAP_THRESHOLD = 8
const MOTION_THRESHOLD = 0.45
const ID_SWITCH_IOU = 0.35

function center(o: Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height'>) {
  return { x: o.x + o.width / 2, y: o.y + o.height / 2 }
}

function motionRatio(a: VideoRectObject, b: VideoRectObject): number {
  const ca = center(a)
  const cb = center(b)
  const diag = Math.hypot(a.width, a.height) || 1
  return Math.hypot(cb.x - ca.x, cb.y - ca.y) / diag
}

export function keyframesForObject(objects: VideoRectObject[], objectId: string): VideoRectObject[] {
  return objects
    .filter((o) => o.object_id === objectId)
    .sort((a, b) => a.frame - b.frame)
}

export function analyzeTrackGaps(kfs: VideoRectObject[], maxFrame: number, gapThreshold = DEFAULT_GAP_THRESHOLD): TrackGap[] {
  if (kfs.length < 2) return []
  const gaps: TrackGap[] = []
  for (let i = 0; i < kfs.length - 1; i++) {
    const span = kfs[i + 1].frame - kfs[i].frame
    if (span > gapThreshold) {
      gaps.push({
        object_id: kfs[0].object_id,
        class_name: kfs[0].label,
        start_frame: kfs[i].frame + 1,
        end_frame: kfs[i + 1].frame - 1,
      })
    }
  }
  const last = kfs[kfs.length - 1]
  if (maxFrame - last.frame > gapThreshold) {
    gaps.push({
      object_id: last.object_id,
      class_name: last.label,
      start_frame: last.frame + 1,
      end_frame: maxFrame,
      open: true,
    })
  }
  return gaps
}

/** Task 17.5 — detect ID switches between consecutive stored keyframes. */
export function detectIdSwitches(kfs: VideoRectObject[], threshold = ID_SWITCH_IOU): IdSwitchEvent[] {
  const events: IdSwitchEvent[] = []
  for (let i = 1; i < kfs.length; i++) {
    const prev = kfs[i - 1]
    const curr = kfs[i]
    const iou = iouMatch(prev, curr)
    const motion = motionRatio(prev, curr)
    if (iou < threshold || (motion > 2 && iou < 0.5)) {
      events.push({
        object_id: curr.object_id,
        class_name: curr.label,
        frame: curr.frame,
        match_iou: iou,
        reason: motion > 2 ? 'motion_jump' : 'iou_drop',
      })
    }
  }
  return events
}

/** Task 17.4 — find potential re-ID links after track gaps. */
export function findReIdCandidates(
  objects: VideoRectObject[],
  gap: TrackGap,
  minScore = 0.2,
): ReIdCandidate[] {
  const kfs = keyframesForObject(objects, gap.object_id)
  const before = kfs.filter((k) => k.frame <= gap.start_frame - 1).pop()
  if (!before) return []

  const candidates: ReIdCandidate[] = []
  const sameClass = objects.filter(
    (o) =>
      o.object_id !== gap.object_id &&
      o.label === gap.class_name &&
      o.frame >= gap.start_frame &&
      o.frame <= gap.end_frame,
  )

  for (const o of sameClass) {
    const score = iouMatch(before, o)
    if (score >= minScore) {
      candidates.push({
        object_id: gap.object_id,
        class_name: gap.class_name,
        frame: o.frame,
        candidate_object_id: o.object_id,
        reid_score: score,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
      })
    }
  }
  return candidates.sort((a, b) => b.reid_score - a.reid_score)
}

/** Task 17.1 — suggest keyframes at gap midpoints and high-motion frames. */
export function suggestAutoKeyframes(
  kfs: VideoRectObject[],
  maxFrame: number,
  gapThreshold = DEFAULT_GAP_THRESHOLD,
): AiSmartHint[] {
  const hints: AiSmartHint[] = []
  const gaps = analyzeTrackGaps(kfs, maxFrame, gapThreshold)

  for (const gap of gaps) {
    const mid = Math.floor((gap.start_frame + gap.end_frame) / 2)
    hints.push({
      id: crypto.randomUUID(),
      kind: 'smart_hint',
      hint_type: 'keyframe',
      frame: mid,
      class_name: gap.class_name,
      confidence: 0.7,
      status: 'pending',
      object_id: gap.object_id,
      message: `Add keyframe in gap (f${gap.start_frame + 1}–${gap.end_frame + 1})`,
      gap_start: gap.start_frame,
      gap_end: gap.end_frame,
    })
  }

  for (let i = 1; i < kfs.length; i++) {
    const motion = motionRatio(kfs[i - 1], kfs[i])
    if (motion > MOTION_THRESHOLD) {
      const { before, after } = bracketKeyframes(kfs, Math.floor((kfs[i - 1].frame + kfs[i].frame) / 2))
      if (before && after && after.frame - before.frame > 2) {
        const midFrame = Math.floor((before.frame + after.frame) / 2)
        if (!kfs.some((k) => k.frame === midFrame)) {
          hints.push({
            id: crypto.randomUUID(),
            kind: 'smart_hint',
            hint_type: 'keyframe',
            frame: midFrame,
            class_name: kfs[0].label,
            confidence: Math.min(0.95, motion),
            status: 'pending',
            object_id: kfs[0].object_id,
            message: `High motion — keyframe suggested at f${midFrame + 1}`,
          })
        }
      }
    }
  }

  return hints
}

/** Task 17.2 — flag stored keyframes with low AI confidence in attributes. */
export function findLowConfidenceKeyframes(
  kfs: VideoRectObject[],
  threshold = 0.35,
): AiSmartHint[] {
  return kfs
    .filter((k) => {
      const attrs = k.attributes as Record<string, unknown> | undefined
      const tc = attrs?.track_confidence ?? attrs?.confidence
      return typeof tc === 'number' && tc < threshold
    })
    .map((k) => {
      const attrs = k.attributes as Record<string, unknown>
      const tc = (attrs.track_confidence ?? attrs.confidence) as number
      return {
        id: crypto.randomUUID(),
        kind: 'smart_hint' as const,
        hint_type: 'low_confidence' as const,
        frame: k.frame,
        class_name: k.label,
        confidence: tc,
        status: 'pending' as const,
        object_id: k.object_id,
        message: `Low confidence (${Math.round(tc * 100)}%) — review keyframe`,
      }
    })
}

export function analyzeSmartTrack(
  objects: VideoRectObject[],
  tracks: VideoTrack[],
  maxFrame: number,
  opts?: { gapThreshold?: number; lowConfThreshold?: number },
): SmartTrackAnalysis {
  const gapThreshold = opts?.gapThreshold ?? DEFAULT_GAP_THRESHOLD
  const lowConfThreshold = opts?.lowConfThreshold ?? 0.35

  const keyframe_hints: AiSmartHint[] = []
  const gaps: TrackGap[] = []
  const id_switches: IdSwitchEvent[] = []
  const reid_candidates: ReIdCandidate[] = []
  const low_confidence_frames: number[] = []

  for (const track of tracks) {
    const kfs = keyframesForObject(objects, track.object_id)
    if (kfs.length < 1) continue

    const trackGaps = analyzeTrackGaps(kfs, maxFrame, gapThreshold)
    gaps.push(...trackGaps)
    id_switches.push(...detectIdSwitches(kfs))
    keyframe_hints.push(...suggestAutoKeyframes(kfs, maxFrame, gapThreshold))

    const lowHints = findLowConfidenceKeyframes(kfs, lowConfThreshold)
    keyframe_hints.push(...lowHints)
    low_confidence_frames.push(...lowHints.map((h) => h.frame))

    for (const ev of detectIdSwitches(kfs)) {
      keyframe_hints.push({
        id: crypto.randomUUID(),
        kind: 'smart_hint',
        hint_type: 'id_switch',
        frame: ev.frame,
        class_name: ev.class_name,
        confidence: ev.match_iou,
        status: 'pending',
        object_id: ev.object_id,
        message: `Possible ID switch (IoU ${Math.round(ev.match_iou * 100)}%)`,
      })
    }

    for (const gap of trackGaps) {
      for (const cand of findReIdCandidates(objects, gap).slice(0, 2)) {
        reid_candidates.push(cand)
        keyframe_hints.push({
          id: crypto.randomUUID(),
          kind: 'smart_hint',
          hint_type: 'reid',
          frame: cand.frame,
          class_name: cand.class_name,
          confidence: cand.reid_score,
          status: 'pending',
          object_id: cand.object_id,
          linked_object_id: cand.candidate_object_id,
          message: `Re-ID candidate: link to ${cand.candidate_object_id} (${Math.round(cand.reid_score * 100)}%)`,
        })
      }
    }
  }

  return {
    keyframe_hints: dedupeHints(keyframe_hints),
    gaps,
    id_switches,
    reid_candidates,
    low_confidence_frames: [...new Set(low_confidence_frames)],
  }
}

function dedupeHints(hints: AiSmartHint[]): AiSmartHint[] {
  const seen = new Set<string>()
  return hints.filter((h) => {
    const key = `${h.hint_type}:${h.object_id}:${h.frame}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Interpolated bbox at frame for keyframe hint acceptance. */
export function interpolatedBboxAt(
  objects: VideoRectObject[],
  objectId: string,
  frame: number,
): Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height' | 'label' | 'tool_type'> | null {
  const kfs = keyframesForObject(objects, objectId)
  if (!kfs.length) return null
  const exact = kfs.find((k) => k.frame === frame)
  if (exact) return exact
  const { before, after } = bracketKeyframes(kfs, frame)
  if (!before) return after
  if (!after) return before
  if (before.frame === after.frame) return before
  const geom = interpolateRect(before, after, before.frame, after.frame, frame)
  return { ...geom, label: before.label, tool_type: before.tool_type }
}

export function seedFromObject(kf: VideoRectObject): AiDetectSuggestion {
  const attrs = (kf.attributes || {}) as Record<string, unknown>
  return {
    id: crypto.randomUUID(),
    kind: 'detect',
    suggestion_type: 'tracked_keyframe',
    frame: kf.frame,
    class_name: kf.label,
    confidence: (attrs.confidence as number) ?? 1,
    status: 'pending',
    tool_type: kf.tool_type === 'rectangle' ? 'rectangle' : 'bbox',
    x: kf.x,
    y: kf.y,
    width: kf.width,
    height: kf.height,
    track_id: kf.object_id,
    engine: 'smart_track',
    model: 'iou_v1',
  }
}
