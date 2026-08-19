import type { FrameIndex } from '@/modules/video/api/video.service'

function fpsFraction(index: FrameIndex): number {
  if (index.fps_rational?.num && index.fps_rational.den) {
    return index.fps_rational.num / index.fps_rational.den
  }
  return index.fps || 0
}

export function frameToTimeSec(frameIndex: number, index: FrameIndex): number {
  const fps = fpsFraction(index)
  if (!fps) return 0
  return frameIndex / fps
}

export function timeSecToFrame(timeSec: number, index: FrameIndex): number {
  const fps = fpsFraction(index)
  if (!fps) return 0
  let frame = Math.round(timeSec * fps)
  if (index.frame_count > 0) {
    frame = Math.min(frame, index.frame_count - 1)
  }
  return Math.max(0, frame)
}

export function formatTimecode(timeSec: number): string {
  const total = Math.max(0, Math.floor(timeSec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ms = Math.floor((timeSec - Math.floor(timeSec)) * 1000)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

/** Parse `00:01:25.350`, `1:25.350`, or `85.350` → seconds. */
export function parseTimecode(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed)
    return Number.isFinite(n) && n >= 0 ? n : null
  }
  const parts = trimmed.split(':')
  if (parts.length < 2 || parts.length > 3) return null
  try {
    let h = 0
    let m = 0
    let sPart = parts[parts.length - 1]
    if (parts.length === 3) {
      h = Number(parts[0])
      m = Number(parts[1])
    } else {
      m = Number(parts[0])
    }
    const s = Number(sPart)
    if (![h, m, s].every((n) => Number.isFinite(n) && n >= 0)) return null
    return h * 3600 + m * 60 + s
  } catch {
    return null
  }
}

/** Parse `Frame 1250`, `frame 1250`, or `1250` → frame index. */
export function parseFrameInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^frame\s*#?\s*(\d+)$/i) || trimmed.match(/^(\d+)$/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function clampFrame(frame: number, index: FrameIndex): number {
  const max = Math.max(0, (index.frame_count || 1) - 1)
  return Math.min(Math.max(0, frame), max)
}
