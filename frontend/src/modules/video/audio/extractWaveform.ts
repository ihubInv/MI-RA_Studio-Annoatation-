import type { WaveformData } from '@/modules/video/audio/audioTypes'

const DEFAULT_BUCKETS = 2048
const TARGET_SAMPLE_RATE = 8000

/** Task 22.1 — extract mono waveform peaks from a media URL (Web Audio API). */
export async function extractWaveformFromUrl(
  url: string,
  buckets = DEFAULT_BUCKETS,
): Promise<WaveformData> {
  const response = await fetch(url)
  const buffer = await response.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(buffer.slice(0))
    return peaksFromAudioBuffer(decoded, buckets)
  } finally {
    await ctx.close()
  }
}

/** Extract from an already-loaded HTMLVideoElement (uses current src). */
export async function extractWaveformFromVideoElement(
  video: HTMLVideoElement,
  buckets = DEFAULT_BUCKETS,
): Promise<WaveformData> {
  if (!video.src) throw new Error('Video has no source')
  return extractWaveformFromUrl(video.src, buckets)
}

export function peaksFromAudioBuffer(buffer: AudioBuffer, buckets: number): WaveformData {
  const channel = buffer.getChannelData(0)
  const blockSize = Math.max(1, Math.floor(channel.length / buckets))
  const peaks: number[] = []

  for (let i = 0; i < buckets; i++) {
    const start = i * blockSize
    const end = Math.min(start + blockSize, channel.length)
    let peak = 0
    for (let j = start; j < end; j++) {
      peak = Math.max(peak, Math.abs(channel[j]))
    }
    peaks.push(peak)
  }

  const maxPeak = Math.max(...peaks, 1e-6)
  return {
    duration_sec: buffer.duration,
    sample_rate: buffer.sampleRate,
    buckets,
    peaks: peaks.map((p) => p / maxPeak),
  }
}

export function downsamplePeaks(peaks: number[], buckets: number): number[] {
  if (peaks.length <= buckets) return peaks
  const blockSize = peaks.length / buckets
  const out: number[] = []
  for (let i = 0; i < buckets; i++) {
    const start = Math.floor(i * blockSize)
    const end = Math.floor((i + 1) * blockSize)
    let max = 0
    for (let j = start; j < end; j++) max = Math.max(max, peaks[j] ?? 0)
    out.push(max)
  }
  return out
}

export { DEFAULT_BUCKETS, TARGET_SAMPLE_RATE }
