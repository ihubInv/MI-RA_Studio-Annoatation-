import { api } from '@/services/api'
import type { WaveformData } from '@/modules/video/audio/audioTypes'

export const videoAudioService = {
  waveform: async (itemId: string, buckets = 2048): Promise<WaveformData> => {
    const { data } = await api.get(`/api/v1/video/${itemId}/audio/waveform`, {
      params: { buckets },
    })
    return data as WaveformData
  },
}
