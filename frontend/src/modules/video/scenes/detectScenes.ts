import type { SceneDefinition } from '@/modules/video/schema/sceneStore'
import { newSceneId, type VideoScene } from '@/modules/video/scenes/sceneTypes'

export interface SceneDetectionOptions {
  sampleEvery?: number
  cutThreshold?: number
  sceneThreshold?: number
  minSceneFrames?: number
}

export interface SceneDetectionResult {
  scenes: VideoScene[]
  shotBoundaries: number[]
  cameraCuts: number[]
}

function frameHist(data: Uint8ClampedArray, bins = 16): Float32Array {
  const hist = new Float32Array(bins * bins * bins)
  for (let i = 0; i < data.length; i += 4) {
    const r = Math.min(bins - 1, Math.floor((data[i] / 256) * bins))
    const g = Math.min(bins - 1, Math.floor((data[i + 1] / 256) * bins))
    const b = Math.min(bins - 1, Math.floor((data[i + 2] / 256) * bins))
    hist[r * bins * bins + g * bins + b] += 1
  }
  let sum = 0
  for (let i = 0; i < hist.length; i++) sum += hist[i]
  if (sum > 0) for (let i = 0; i < hist.length; i++) hist[i] /= sum
  return hist
}

function histDiff(a: Float32Array, b: Float32Array): number {
  let d = 0
  for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i])
  return d
}

async function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = timeSec
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      reject(new Error('Seek timeout'))
    }, 5000)
  })
}

/** Automatic scene / shot / cut detection via frame histogram diff. */
export async function detectScenesFromVideo(
  video: HTMLVideoElement,
  maxFrame: number,
  fps: number,
  sceneTypes: SceneDefinition[],
  options: SceneDetectionOptions = {},
  onProgress?: (pct: number) => void,
): Promise<SceneDetectionResult> {
  const sampleEvery = options.sampleEvery ?? Math.max(1, Math.round(fps / 2))
  const cutThreshold = options.cutThreshold ?? 0.35
  const sceneThreshold = options.sceneThreshold ?? 0.18
  const minSceneFrames = options.minSceneFrames ?? Math.round(fps * 2)

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 36
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { scenes: [], shotBoundaries: [], cameraCuts: [] }

  const defaultSceneType = sceneTypes.find((d) => d.kind === 'scene' && d.enabled)?.name ?? 'Unknown'
  const shotDef = sceneTypes.find((d) => d.kind === 'shot_boundary')
  const cutDef = sceneTypes.find((d) => d.kind === 'camera_cut')

  const diffs: { frame: number; diff: number }[] = []
  let prevHist: Float32Array | null = null
  const savedTime = video.currentTime
  const wasPaused = video.paused

  try {
    for (let frame = 0; frame <= maxFrame; frame += sampleEvery) {
      const timeSec = frame / Math.max(fps, 1)
      await seekVideo(video, timeSec)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const hist = frameHist(img.data)
      if (prevHist) {
        diffs.push({ frame, diff: histDiff(prevHist, hist) })
      }
      prevHist = hist
      onProgress?.(frame / Math.max(maxFrame, 1))
    }
  } catch {
    /* partial results ok */
  }

  if (!wasPaused) void video.play()
  else video.currentTime = savedTime

  const cameraCuts: number[] = []
  const shotBoundaries: number[] = []

  for (const { frame, diff } of diffs) {
    if (diff >= cutThreshold) cameraCuts.push(frame)
    else if (diff >= sceneThreshold) shotBoundaries.push(frame)
  }

  const cutSet = new Set([...cameraCuts, ...shotBoundaries, 0])
  const boundaries = [...cutSet].sort((a, b) => a - b)
  if (boundaries[boundaries.length - 1] !== maxFrame) boundaries.push(maxFrame)

  const scenes: VideoScene[] = []

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    if (end - start < minSceneFrames) continue
    scenes.push({
      id: newSceneId(),
      label: defaultSceneType,
      color: sceneTypes.find((d) => d.name === defaultSceneType)?.color ?? '#475569',
      marker_kind: 'scene',
      scene_type: defaultSceneType,
      frame: start,
      end_frame: end,
      auto_detected: true,
      visible: true,
    })
  }

  for (const frame of shotBoundaries) {
    scenes.push({
      id: newSceneId(),
      label: shotDef?.name ?? 'Shot boundary',
      color: shotDef?.color ?? '#f59e0b',
      marker_kind: 'shot_boundary',
      frame,
      auto_detected: true,
      visible: true,
    })
  }

  for (const frame of cameraCuts) {
    scenes.push({
      id: newSceneId(),
      label: cutDef?.name ?? 'Camera cut',
      color: cutDef?.color ?? '#ef4444',
      marker_kind: 'camera_cut',
      frame,
      auto_detected: true,
      visible: true,
    })
  }

  return { scenes, shotBoundaries, cameraCuts }
}
