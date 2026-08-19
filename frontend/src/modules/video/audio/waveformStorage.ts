import type { WaveformData } from '@/modules/video/audio/audioTypes'

function storageKey(itemId: string) {
  return `mira.video.waveform.${itemId}`
}

export function loadWaveformCache(itemId: string): WaveformData | null {
  try {
    const raw = localStorage.getItem(storageKey(itemId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as WaveformData
    if (!parsed?.peaks?.length) return null
    return parsed
  } catch {
    return null
  }
}

export function saveWaveformCache(itemId: string, data: WaveformData) {
  try {
    localStorage.setItem(storageKey(itemId), JSON.stringify(data))
  } catch {
    /* quota — ignore */
  }
}
