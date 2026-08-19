import type { DetectOptions, DetectResult } from '@/modules/image/api/inference.service'
import { api } from '@/services/api'
import { captureVideoFrame } from '@/modules/video/ai/captureFrame'

export interface VideoAiModels {
  available: boolean
  detect_models: { id: string; label: string }[]
  segment_models: { id: string; label: string }[]
  pose_models: { id: string; label: string }[]
  track_models: { id: string; label: string }[]
}

export interface VideoDetectResult extends DetectResult {
  frame_index?: number
}

export interface TrackSeed {
  track_id: string
  class_name: string
  confidence?: number
  x: number
  y: number
  width: number
  height: number
}

export interface TrackKeyframe {
  track_id: string
  class_name: string
  frame: number
  geometry: { x: number; y: number; width: number; height: number }
  confidence: number
  track_confidence: number
  match_iou?: number
  status?: 'matched' | 'low_confidence' | 'id_switch_suspect'
  needs_review?: boolean
}

export interface TrackGap {
  track_id: string
  class_name: string
  start_frame: number
  end_frame: number
  open?: boolean
}

export interface IdSwitchEvent {
  track_id: string
  class_name: string
  frame: number
  match_iou: number
  track_confidence?: number
  reason?: string
}

export interface ReIdCandidate {
  track_id: string
  class_name: string
  frame: number
  reid_score: number
  geometry: { x: number; y: number; width: number; height: number }
  predicted?: boolean
}

export interface TrackResponse {
  keyframes: TrackKeyframe[]
  gaps?: TrackGap[]
  id_switches?: IdSwitchEvent[]
  reid_candidates?: ReIdCandidate[]
}

function buildDetectForm(frameIndex: number, blob: Blob, opts: DetectOptions = {}) {
  const form = new FormData()
  form.append('file', blob, 'frame.jpg')
  form.append('frame_index', String(frameIndex))
  form.append('output', opts.output ?? 'bbox')
  form.append('model', opts.model ?? 'yolov8n')
  form.append('confidence', String(opts.confidence ?? 0.25))
  if (opts.classes?.length) form.append('classes', opts.classes.join(','))
  return form
}

export const videoAiService = {
  async listModels(itemId: string): Promise<VideoAiModels> {
    const { data } = await api.get(`/api/v1/video/${itemId}/ai/models`)
    return data
  },

  async detectBlob(
    itemId: string,
    blob: Blob,
    frameIndex: number,
    opts: DetectOptions = {},
  ): Promise<VideoDetectResult> {
    const { data } = await api.post<VideoDetectResult>(
      `/api/v1/video/${itemId}/ai/detect`,
      buildDetectForm(frameIndex, blob, opts),
      { timeout: 180_000 },
    )
    return data
  },

  async detect(
    itemId: string,
    video: HTMLVideoElement,
    frameIndex: number,
    opts: DetectOptions = {},
  ): Promise<VideoDetectResult> {
    const blob = await captureVideoFrame(video)
    return this.detectBlob(itemId, blob, frameIndex, opts)
  },

  async segment(
    itemId: string,
    video: HTMLVideoElement,
    frameIndex: number,
    positive: { x: number; y: number }[],
    negative: { x: number; y: number }[] = [],
    model = 'mobile_sam',
  ) {
    const blob = await captureVideoFrame(video)
    const points = [
      ...positive.map((p) => ({ x: p.x, y: p.y, label: 1 })),
      ...negative.map((p) => ({ x: p.x, y: p.y, label: 0 })),
    ]
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    form.append('frame_index', String(frameIndex))
    form.append('points', JSON.stringify(points))
    form.append('model', model)
    const { data } = await api.post(`/api/v1/video/${itemId}/ai/segment`, form, { timeout: 180_000 })
    return data as { engine: string; model: string; points: { x: number; y: number }[]; frame_index?: number }
  },

  async pose(
    itemId: string,
    video: HTMLVideoElement,
    frameIndex: number,
    point?: { x: number; y: number },
    model = 'yolov8n-pose',
    confidence = 0.25,
  ) {
    const blob = await captureVideoFrame(video)
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    form.append('frame_index', String(frameIndex))
    form.append('x', String(point?.x ?? 0))
    form.append('y', String(point?.y ?? 0))
    form.append('model', model)
    form.append('confidence', String(confidence))
    const { data } = await api.post(`/api/v1/video/${itemId}/ai/pose`, form, { timeout: 180_000 })
    return data as { engine: string; model: string; geometry: Record<string, unknown> | null; frame_index?: number }
  },

  async track(
    itemId: string,
    payload: {
      seeds: TrackSeed[]
      frames: { frame: number; objects: DetectResult['objects'] }[]
      min_track_confidence?: number
      retain_low_confidence?: boolean
      id_switch_iou_threshold?: number
      reid_iou_threshold?: number
    },
  ) {
    const { data } = await api.post<TrackResponse>(`/api/v1/video/${itemId}/ai/track`, payload, {
      timeout: 180_000,
    })
    return data
  },
}
