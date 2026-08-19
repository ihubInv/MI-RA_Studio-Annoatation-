import { api } from '@/services/api'

export interface VideoProbe {
  item_id: string
  status: string
  width?: number
  height?: number
  fps?: number
  duration_seconds?: number
  frame_count?: number
  codec?: string
  bitrate_bps?: number
  audio?: {
    codec?: string
    channels?: number
    sample_rate?: number
    bitrate_bps?: number
  }
  thumbnail_url?: string
  preview_thumbnail_url?: string
  media_url?: string
  preview_url?: string
  proxies?: Record<string, string>
  frame_index?: FrameIndex
  processing_error?: string
}

export interface FrameIndex {
  version: string
  frame_count: number
  fps: number
  fps_rational?: { num: number; den: number }
  duration_sec: number
  keyframes?: number[]
}

export interface FrameLookup {
  frame_index: number
  time_sec: number
}

export const videoService = {
  probe: async (itemId: string): Promise<VideoProbe> => {
    const { data } = await api.get(`/api/v1/video/${itemId}/probe`)
    return data
  },

  frameIndex: async (itemId: string): Promise<FrameIndex> => {
    const { data } = await api.get(`/api/v1/video/${itemId}/frame-index`)
    return data
  },

  lookupFrame: async (itemId: string, params: { frame_index?: number; time_sec?: number }): Promise<FrameLookup> => {
    const { data } = await api.get(`/api/v1/video/${itemId}/frames/lookup`, { params })
    return data
  },

  reprocess: async (itemId: string) => {
    const { data } = await api.post(`/api/v1/video/${itemId}/process`)
    return data as { status: string; item_id: string }
  },

  importUrl: async (datasetId: string, url: string, filename?: string) => {
    const { data } = await api.post('/api/v1/video/import-url', { dataset_id: datasetId, url, filename })
    return data as { item_id: string; filename: string }
  },

  importSequence: async (datasetId: string, files: File[], fps = 30) => {
    const form = new FormData()
    form.append('dataset_id', datasetId)
    form.append('fps', String(fps))
    for (const f of files) form.append('files', f)
    const { data } = await api.post('/api/v1/video/import-sequence', form)
    return data as { item_id: string; frames: number; fps: number }
  },

  renderAnnotated: async (itemId: string) => {
    const { data } = await api.post(`/api/v1/video/${itemId}/render-annotated`)
    return data as { url: string; storage_path: string }
  },

  signedUrl: async (itemId: string) => {
    const { data } = await api.get(`/api/v1/video/${itemId}/signed-url`)
    return data as { url: string; expires_at: number }
  },
}
