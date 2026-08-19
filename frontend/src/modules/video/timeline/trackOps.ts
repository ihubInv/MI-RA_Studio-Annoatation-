import { geometryAtFrame } from '@/modules/video/canvas/interpolation'
import type { VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import { findKeyframeAt, findNearestKeyframe } from '@/modules/video/timeline/objectTracks'
import type { TimelineTrack } from '@/modules/video/timeline/timeline.types'
import type { TrackMergeResult, TrackSplitResult, VideoTrack } from '@/modules/video/timeline/track.types'

type KeyframeLike = { object_id: string; frame: number; label: string; color: string }

export function buildVideoTracks(objects: VideoRectObject[]): VideoTrack[] {
  return buildVideoTracksFromAll(objects, [])
}

export function buildVideoTracksFromAll(
  rects: VideoRectObject[],
  skeletons: VideoSkeletonObject[] = [],
  masks: VideoMaskObject[] = [],
): VideoTrack[] {
  const map = new Map<string, KeyframeLike[]>()
  for (const o of [...rects, ...skeletons, ...masks]) {
    const list = map.get(o.object_id) ?? []
    list.push(o)
    map.set(o.object_id, list)
  }

  const tracks: VideoTrack[] = []
  for (const [object_id, kfs] of map) {
    const frames = [...new Set(kfs.map((o) => o.frame))].sort((a, b) => a - b)
    if (!frames.length) continue
    const sample = kfs[0]
    tracks.push({
      track_id: object_id,
      object_id,
      class_name: sample.label,
      start_frame: frames[0],
      end_frame: frames[frames.length - 1],
      keyframes: frames,
      color: sample.color,
    })
  }

  return tracks.sort((a, b) => a.object_id.localeCompare(b.object_id, undefined, { numeric: true }))
}

export function tracksToTimeline(tracks: VideoTrack[]): TimelineTrack[] {
  return tracks.map((t) => ({
    id: t.object_id,
    label: t.object_id,
    color: t.color,
    keyframes: t.keyframes,
    startFrame: t.start_frame,
    endFrame: t.end_frame,
    className: t.class_name,
  }))
}

/** Task 12.2 — extend track forward: keyframe at `toFrame` with geometry from `fromFrame`. */
export function trackForward(
  objects: VideoRectObject[],
  objectId: string,
  fromFrame: number,
  toFrame: number,
  newId: () => string,
): VideoRectObject[] {
  if (toFrame <= fromFrame) return objects
  const source = findKeyframeAt(objects, objectId, fromFrame) ?? findNearestKeyframe(objects, objectId, fromFrame)
  if (!source) return objects

  if (findKeyframeAt(objects, objectId, toFrame)) return objects

  const geom = geometryAtFrame(objects, objectId, fromFrame) ?? {
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
  }

  const id = newId()
  const { id: _id, frame: _f, ...rest } = source
  return [...objects, { ...rest, ...geom, id, frame: toFrame, object_id: objectId }]
}

/** Task 12.3 — extend track backward: keyframe at `toFrame` with geometry from `fromFrame`. */
export function trackBackward(
  objects: VideoRectObject[],
  objectId: string,
  fromFrame: number,
  toFrame: number,
  newId: () => string,
): VideoRectObject[] {
  if (toFrame >= fromFrame) return objects
  const source = findKeyframeAt(objects, objectId, fromFrame) ?? findNearestKeyframe(objects, objectId, fromFrame)
  if (!source) return objects

  if (findKeyframeAt(objects, objectId, toFrame)) return objects

  const geom = geometryAtFrame(objects, objectId, fromFrame) ?? {
    x: source.x,
    y: source.y,
    width: source.width,
    height: source.height,
  }

  const id = newId()
  const { id: _id, frame: _f, ...rest } = source
  return [...objects, { ...rest, ...geom, id, frame: toFrame, object_id: objectId }]
}

/** Task 12.4 — split track at frame; keyframes >= atFrame move to new object_id. */
export function splitTrack(
  objects: VideoRectObject[],
  objectId: string,
  atFrame: number,
  allocateObjectId: (label: string) => string,
): { objects: VideoRectObject[]; result: TrackSplitResult | null } {
  const trackKfs = objects.filter((o) => o.object_id === objectId)
  if (trackKfs.length < 1) return { objects, result: null }

  const toMove = trackKfs.filter((o) => o.frame >= atFrame)
  if (!toMove.length || toMove.length === trackKfs.length) return { objects, result: null }

  const label = trackKfs[0].label
  const newObjectId = allocateObjectId(label)
  const next = objects.map((o) =>
    o.object_id === objectId && o.frame >= atFrame ? { ...o, object_id: newObjectId } : o,
  )

  const tracks = buildVideoTracks(next)
  const kept = tracks.find((t) => t.object_id === objectId)
  const created = tracks.find((t) => t.object_id === newObjectId)
  if (!kept || !created) return { objects: next, result: null }

  return {
    objects: next,
    result: { kept, created, newObjectId },
  }
}

/** Task 12.5 — merge secondary track into primary (reassign object_id). */
export function mergeTracks(
  objects: VideoRectObject[],
  primaryId: string,
  secondaryId: string,
): { objects: VideoRectObject[]; result: TrackMergeResult | null } {
  if (primaryId === secondaryId) return { objects, result: null }

  const primary = objects.filter((o) => o.object_id === primaryId)
  const secondary = objects.filter((o) => o.object_id === secondaryId)
  if (!primary.length || !secondary.length) return { objects, result: null }

  const primaryFrames = new Set(primary.map((o) => o.frame))
  const next = objects
    .filter((o) => o.object_id !== secondaryId || !primaryFrames.has(o.frame))
    .map((o) => (o.object_id === secondaryId ? { ...o, object_id: primaryId, label: primary[0].label, color: primary[0].color } : o))

  const merged = buildVideoTracks(next).find((t) => t.object_id === primaryId)
  if (!merged) return { objects: next, result: null }

  return {
    objects: next,
    result: { merged, removedObjectId: secondaryId },
  }
}
