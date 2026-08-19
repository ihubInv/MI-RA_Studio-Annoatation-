import { makeInterpolatedId, bracketKeyframes } from '@/modules/video/canvas/interpolation'
import type { VideoMaskObject } from '@/modules/video/canvas/maskTypes'

export interface VideoDisplayMask extends VideoMaskObject {
  interpolated?: boolean
}

function groupMaskKeyframes(masks: VideoMaskObject[]): Map<string, VideoMaskObject[]> {
  const map = new Map<string, VideoMaskObject[]>()
  for (const o of masks) {
    const list = map.get(o.object_id) ?? []
    list.push(o)
    map.set(o.object_id, list)
  }
  return map
}

function trackVisible(keyframes: VideoMaskObject[]): boolean {
  return keyframes.every((o) => o.visible !== false)
}

function trackLocked(keyframes: VideoMaskObject[]): boolean {
  return keyframes.some((o) => o.locked)
}

/** Phase 15.4 — resolve masks at frame (hold between keyframes; track ops copy RLE). */
export function resolveDisplayMasks(masks: VideoMaskObject[], frame: number): VideoDisplayMask[] {
  const groups = groupMaskKeyframes(masks)
  const out: VideoDisplayMask[] = []

  for (const [objectId, keyframes] of groups) {
    if (!trackVisible(keyframes)) continue

    const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)
    const exact = sorted.find((o) => o.frame === frame)
    if (exact) {
      out.push({ ...exact, interpolated: false })
      continue
    }

    const first = sorted[0]
    if (frame < first.frame) continue

    const { before, after } = bracketKeyframes(sorted, frame)
    const hold = before ?? after
    if (!hold) continue

    out.push({
      ...hold,
      frame,
      id: makeInterpolatedId(objectId),
      interpolated: true,
      locked: trackLocked(sorted),
    })
  }

  return out
}

export function maskGeometryAtFrame(
  masks: VideoMaskObject[],
  objectId: string,
  frame: number,
): Pick<VideoMaskObject, 'rle' | 'points' | 'strokeWidth'> | null {
  const display = resolveDisplayMasks(masks, frame).find((o) => o.object_id === objectId)
  if (!display) return null
  return {
    rle: display.rle,
    points: display.points ? [...display.points] : undefined,
    strokeWidth: display.strokeWidth,
  }
}

export function isMaskDisplay(obj: { tool_type?: string; rle?: unknown }): obj is VideoDisplayMask {
  return Boolean(obj.rle) || obj.tool_type === 'brush' || obj.tool_type === 'mask' || obj.tool_type === 'instance_seg' || obj.tool_type === 'semantic_seg'
}
