import { api } from '@/services/api'

export type DetectOutput = 'bbox' | 'polygon' | 'mask'

export interface DetectOptions {
  output?: DetectOutput
  model?: string
  confidence?: number
  classes?: string[]
}

export interface DetectedObject {
  class_name: string
  confidence: number
  tool_type: string
  geometry: Record<string, unknown>
}

export interface DetectResult {
  engine: string
  model: string
  output: DetectOutput
  objects: DetectedObject[]
  total: number
}

export interface InferenceModel {
  id: string
  weights?: string
  task: string
  label: string
}

export interface ModelsListResponse {
  available: boolean
  items: InferenceModel[]
  default_model: string
  default_output: DetectOutput
  segment_models?: InferenceModel[]
  pose_models?: InferenceModel[]
}

export interface SegmentResult {
  engine: string
  model: string
  points: { x: number; y: number }[]
}

export interface PoseResult {
  engine: string
  model: string
  geometry: Record<string, unknown> | null
}

export interface PrelabelOptions {
  dataset_id: string
  model?: string
  output?: DetectOutput
  confidence?: number
  folder?: string
  skip_existing?: boolean
  limit?: number
}

async function imageToBlob(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/jpeg',
      0.92,
    )
  })
}

export const inferenceService = {
  async listModels(): Promise<ModelsListResponse> {
    const { data } = await api.get<ModelsListResponse>('/api/v1/inference/models')
    return data
  },

  async detect(image: HTMLImageElement, opts: DetectOptions = {}): Promise<DetectResult> {
    const blob = await imageToBlob(image)
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    form.append('output', opts.output ?? 'bbox')
    form.append('model', opts.model ?? 'yolov8n')
    form.append('confidence', String(opts.confidence ?? 0.25))
    if (opts.classes?.length) form.append('classes', opts.classes.join(','))

    const { data } = await api.post<DetectResult>('/api/v1/inference/detect', form, {
      timeout: 180_000,
    })
    return data
  },

  async segment(
    image: HTMLImageElement,
    positive: { x: number; y: number }[],
    negative: { x: number; y: number }[] = [],
    model = 'mobile_sam',
  ): Promise<SegmentResult> {
    const blob = await imageToBlob(image)
    const points = [
      ...positive.map((p) => ({ x: p.x, y: p.y, label: 1 })),
      ...negative.map((p) => ({ x: p.x, y: p.y, label: 0 })),
    ]
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    form.append('points', JSON.stringify(points))
    form.append('model', model)
    const { data } = await api.post<SegmentResult>('/api/v1/inference/segment', form, {
      timeout: 180_000,
    })
    return data
  },

  async pose(
    image: HTMLImageElement,
    point?: { x: number; y: number },
    model = 'yolov8n-pose',
    confidence = 0.25,
  ): Promise<PoseResult> {
    const blob = await imageToBlob(image)
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    form.append('x', String(point?.x ?? 0))
    form.append('y', String(point?.y ?? 0))
    form.append('model', model)
    form.append('confidence', String(confidence))
    const { data } = await api.post<PoseResult>('/api/v1/inference/pose', form, {
      timeout: 180_000,
    })
    return data
  },

  async prelabel(opts: PrelabelOptions): Promise<{ status: string; message: string }> {
    const { data } = await api.post('/api/v1/inference/prelabel', {
      dataset_id: opts.dataset_id,
      model: opts.model ?? 'yolov8n',
      output: opts.output ?? 'bbox',
      confidence: opts.confidence ?? 0.25,
      folder: opts.folder,
      skip_existing: opts.skip_existing ?? true,
      limit: opts.limit ?? 100,
    })
    return data
  },
}
