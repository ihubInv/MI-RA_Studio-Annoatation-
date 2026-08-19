import type { DetectOutput } from '@/modules/image/api/inference.service'
import { captureFrameAt } from '@/modules/video/ai/captureFrame'
import {
  mapDetectResults,
  type AiDetectSuggestion,
  type AiSmartHint,
  type SmartSuggestionType,
} from '@/modules/video/ai/mapAiResults'
import { videoAiService, type TrackSeed } from '@/modules/video/api/videoAi.service'

export interface TrackProgress {
  frame: number
  total: number
  message: string
}

export interface SmartTrackResult {
  seeds: TrackSeed[]
  keyframes: AiDetectSuggestion[]
  hints: AiSmartHint[]
}

function mapTrackKeyframe(kf: {
  track_id: string
  class_name: string
  frame: number
  geometry: { x: number; y: number; width: number; height: number }
  confidence: number
  track_confidence: number
  match_iou?: number
  status?: string
  needs_review?: boolean
}): AiDetectSuggestion {
  const status = (kf.status || 'matched') as SmartSuggestionType | 'matched'
  let suggestion_type: SmartSuggestionType = 'tracked_keyframe'
  if (status === 'low_confidence') suggestion_type = 'low_confidence'
  if (status === 'id_switch_suspect') suggestion_type = 'id_switch_suspect'

  return {
    id: crypto.randomUUID(),
    kind: 'detect',
    suggestion_type,
    frame: kf.frame,
    class_name: kf.class_name,
    confidence: kf.confidence,
    status: 'pending',
    tool_type: 'bbox',
    x: kf.geometry.x,
    y: kf.geometry.y,
    width: kf.geometry.width,
    height: kf.geometry.height,
    engine: 'track',
    model: 'iou_v1',
    track_id: kf.track_id,
    track_confidence: kf.track_confidence,
    match_iou: kf.match_iou,
    needs_review: kf.needs_review,
  }
}

function mapTrackMetadata(trackResult: Awaited<ReturnType<typeof videoAiService.track>>): AiSmartHint[] {
  const hints: AiSmartHint[] = []

  for (const gap of trackResult.gaps || []) {
    const mid = Math.floor((gap.start_frame + gap.end_frame) / 2)
    hints.push({
      id: crypto.randomUUID(),
      kind: 'smart_hint',
      hint_type: 'gap',
      frame: mid,
      class_name: gap.class_name,
      confidence: 0.6,
      status: 'pending',
      object_id: gap.track_id,
      message: gap.open
        ? `Track lost from f${gap.start_frame + 1} — re-track suggested`
        : `Track gap f${gap.start_frame + 1}–${gap.end_frame + 1}`,
      gap_start: gap.start_frame,
      gap_end: gap.end_frame,
    })
  }

  for (const sw of trackResult.id_switches || []) {
    hints.push({
      id: crypto.randomUUID(),
      kind: 'smart_hint',
      hint_type: 'id_switch',
      frame: sw.frame,
      class_name: sw.class_name,
      confidence: sw.match_iou,
      status: 'pending',
      object_id: sw.track_id,
      message: `ID switch suspect (IoU ${Math.round(sw.match_iou * 100)}%)`,
    })
  }

  for (const cand of trackResult.reid_candidates || []) {
    hints.push({
      id: crypto.randomUUID(),
      kind: 'smart_hint',
      hint_type: 'reid',
      frame: cand.frame,
      class_name: cand.class_name,
      confidence: cand.reid_score,
      status: 'pending',
      object_id: cand.track_id,
      message: `Re-ID match (${Math.round(cand.reid_score * 100)}%)${cand.predicted ? ' — predicted' : ''}`,
    })
  }

  return hints
}

export async function trackBboxesAcrossFrames(
  itemId: string,
  video: HTMLVideoElement,
  opts: {
    fromFrame: number
    toFrame: number
    fps: number
    seeds: AiDetectSuggestion[]
    model?: string
    confidence?: number
    minTrackConfidence?: number
    retainLowConfidence?: boolean
    idSwitchThreshold?: number
    onProgress?: (p: TrackProgress) => void
  },
): Promise<SmartTrackResult> {
  const {
    fromFrame,
    toFrame,
    fps,
    seeds,
    model,
    confidence,
    minTrackConfidence,
    retainLowConfidence,
    idSwitchThreshold,
    onProgress,
  } = opts
  const direction = toFrame >= fromFrame ? 1 : -1
  const frames: number[] = []
  for (let f = fromFrame; direction > 0 ? f <= toFrame : f >= toFrame; f += direction) {
    frames.push(f)
  }

  const trackSeeds: TrackSeed[] = seeds.map((s, i) => ({
    track_id: s.track_id || `track_${i}_${s.class_name}`,
    class_name: s.class_name,
    confidence: s.confidence,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
  }))

  const prevTime = video.currentTime
  const frameDetections: { frame: number; objects: import('@/modules/image/api/inference.service').DetectedObject[] }[] =
    []

  try {
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i]
      onProgress?.({ frame, total: frames.length, message: `Detecting frame ${frame + 1}…` })
      const timeSec = frame / fps
      const blob = await captureFrameAt(video, timeSec, fps)
      const result = await videoAiService.detectBlob(itemId, blob, frame, {
        output: 'bbox' as DetectOutput,
        model,
        confidence,
      })
      frameDetections.push({ frame, objects: result.objects })
    }
  } finally {
    video.currentTime = prevTime
  }

  onProgress?.({ frame: toFrame, total: frames.length, message: 'Smart matching tracks…' })

  const trackResult = await videoAiService.track(itemId, {
    seeds: trackSeeds,
    frames: frameDetections,
    min_track_confidence: minTrackConfidence ?? 0.25,
    retain_low_confidence: retainLowConfidence ?? true,
    id_switch_iou_threshold: idSwitchThreshold ?? 0.35,
  })

  const keyframes = trackResult.keyframes.map(mapTrackKeyframe)
  const hints = mapTrackMetadata(trackResult)

  return { seeds: trackSeeds, keyframes, hints }
}

/** Task 17.3 — re-track from an accepted object keyframe. */
export async function reTrackFromObject(
  itemId: string,
  video: HTMLVideoElement,
  opts: {
    seed: AiDetectSuggestion
    fromFrame: number
    toFrame: number
    fps: number
    model?: string
    confidence?: number
    minTrackConfidence?: number
    onProgress?: (p: TrackProgress) => void
  },
): Promise<SmartTrackResult> {
  return trackBboxesAcrossFrames(itemId, video, {
    ...opts,
    seeds: [{ ...opts.seed, track_id: opts.seed.track_id || opts.seed.class_name }],
  })
}

export function matchDetectionToSeed(
  seed: AiDetectSuggestion,
  detections: AiDetectSuggestion[],
  minIou = 0.3,
): AiDetectSuggestion | null {
  let best: AiDetectSuggestion | null = null
  let bestScore = minIou
  for (const d of detections) {
    const score = iouMatch(seed, d)
    if (score > bestScore) {
      bestScore = score
      best = d
    }
  }
  return best
}

function iouMatch(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  const ix1 = Math.max(a.x, b.x)
  const iy1 = Math.max(a.y, b.y)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)
  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const inter = iw * ih
  if (inter <= 0) return 0
  const areaA = a.width * a.height
  const areaB = b.width * b.height
  return inter / (areaA + areaB - inter)
}

export { mapDetectResults }
