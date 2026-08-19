import type { VideoRectObject } from '@/modules/video/canvas/types'

export const INTERP_ID_PREFIX = 'interp:'

export type Point2 = { x: number; y: number }

export type Keypoint2 = { x: number; y: number; name?: string }

export interface VideoDisplayObject extends VideoRectObject {
  /** True when geometry is linearly interpolated between keyframes. */
  interpolated?: boolean
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Shortest-path angle interpolation in degrees. Task 11.4 */
export function lerpAngleDeg(a: number, b: number, t: number): number {
  let diff = ((b - a + 180) % 360) - 180
  if (diff < -180) diff += 360
  const r = a + diff * t
  return ((r % 360) + 360) % 360
}

export function makeInterpolatedId(objectId: string): string {
  return `${INTERP_ID_PREFIX}${objectId}`
}

export function isInterpolatedId(id: string): boolean {
  return id.startsWith(INTERP_ID_PREFIX)
}

export function parseInterpolatedId(id: string): string {
  return id.slice(INTERP_ID_PREFIX.length)
}

export function bracketKeyframes<T extends { frame: number }>(
  keyframes: T[],
  frame: number,
): { before: T | null; after: T | null } {
  const sorted = [...keyframes].sort((a, b) => a.frame - b.frame)
  let before: T | null = null
  let after: T | null = null
  for (const kf of sorted) {
    if (kf.frame <= frame) before = kf
    if (kf.frame >= frame) {
      after = kf
      break
    }
  }
  return { before, after }
}

export function interpolationT(beforeFrame: number, afterFrame: number, frame: number): number {
  if (afterFrame === beforeFrame) return 0
  return (frame - beforeFrame) / (afterFrame - beforeFrame)
}

/** Task 11.1 — linear bbox / rectangle interpolation. */
export function interpolateRect(
  before: Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height'>,
  after: Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height'>,
  beforeFrame: number,
  afterFrame: number,
  frame: number,
): Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height'> {
  const t = interpolationT(beforeFrame, afterFrame, frame)
  return {
    x: lerp(before.x, after.x, t),
    y: lerp(before.y, after.y, t),
    width: lerp(before.width, after.width, t),
    height: lerp(before.height, after.height, t),
  }
}

/** Task 11.2 — polygon vertex interpolation (same vertex count required). */
export function interpolatePolygon(before: Point2[], after: Point2[], t: number): Point2[] {
  const n = Math.min(before.length, after.length)
  if (!n) return []
  return Array.from({ length: n }, (_, i) => ({
    x: lerp(before[i].x, after[i].x, t),
    y: lerp(before[i].y, after[i].y, t),
  }))
}

/** Task 11.3 — keypoint X/Y interpolation. */
export function interpolateKeypoints(before: Keypoint2[], after: Keypoint2[], t: number): Keypoint2[] {
  const n = Math.min(before.length, after.length)
  if (!n) return []
  return Array.from({ length: n }, (_, i) => ({
    x: lerp(before[i].x, after[i].x, t),
    y: lerp(before[i].y, after[i].y, t),
    name: before[i].name ?? after[i].name,
  }))
}

/** Task 11.4 — rotation interpolation for rotated boxes. */
export function interpolateRotation(beforeDeg: number, afterDeg: number, t: number): number {
  return lerpAngleDeg(beforeDeg, afterDeg, t)
}

function groupRectKeyframes(objects: VideoRectObject[]): Map<string, VideoRectObject[]> {
  const map = new Map<string, VideoRectObject[]>()
  for (const o of objects) {
    const list = map.get(o.object_id) ?? []
    list.push(o)
    map.set(o.object_id, list)
  }
  return map
}

function trackVisible(keyframes: VideoRectObject[]): boolean {
  return keyframes.every((o) => o.visible !== false)
}

function trackLocked(keyframes: VideoRectObject[]): boolean {
  return keyframes.some((o) => o.locked)
}

/** Resolve all objects visible at `frame`, including interpolated bbox positions. */
export function resolveDisplayObjects(objects: VideoRectObject[], frame: number): VideoDisplayObject[] {
  const groups = groupRectKeyframes(objects)
  const out: VideoDisplayObject[] = []

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

    if (before && after && before.frame !== after.frame) {
      const t = interpolationT(before.frame, after.frame, frame)
      const geom = interpolateRect(before, after, before.frame, after.frame, frame)
      const points =
        before.points && after.points ? interpolatePolygon(before.points, after.points, t) : before.points
      out.push({
        ...before,
        ...geom,
        rotation: interpolateRotation(before.rotation ?? 0, after.rotation ?? 0, t),
        points,
        frame,
        id: makeInterpolatedId(objectId),
        interpolated: true,
        locked: trackLocked([before, after]),
      })
      continue
    }

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

/** Geometry at `frame` for creating a keyframe (uses interpolation when between KFs). */
export function geometryAtFrame(
  objects: VideoRectObject[],
  objectId: string,
  frame: number,
): Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'points'> | null {
  const display = resolveDisplayObjects(objects, frame).find((o) => o.object_id === objectId)
  if (!display) return null
  return {
    x: display.x,
    y: display.y,
    width: display.width,
    height: display.height,
    rotation: display.rotation,
    points: display.points,
  }
}
