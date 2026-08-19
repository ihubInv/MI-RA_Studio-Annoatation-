import type { TimelineTrack } from '@/modules/video/timeline/timeline.types'
import { buildVideoTracks, buildVideoTracksFromAll, tracksToTimeline } from '@/modules/video/timeline/trackOps'
import type { VideoTrack } from '@/modules/video/timeline/track.types'
import type { VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import type { VideoRectObject } from '@/modules/video/canvas/types'

export type { VideoTrack }

/** Build one timeline track per object_id; each annotated frame is a keyframe. */
export function tracksFromAnnotations(objects: VideoRectObject[]): TimelineTrack[] {
  return tracksToTimeline(buildVideoTracks(objects))
}

export function tracksFromAllAnnotations(
  rects: VideoRectObject[],
  skeletons: VideoSkeletonObject[] = [],
  masks: VideoMaskObject[] = [],
): TimelineTrack[] {
  return tracksToTimeline(buildVideoTracksFromAll(rects, skeletons, masks))
}

export function videoTracksFromAnnotations(objects: VideoRectObject[]): VideoTrack[] {
  return buildVideoTracks(objects)
}

export function videoTracksFromAll(
  rects: VideoRectObject[],
  skeletons: VideoSkeletonObject[] = [],
  masks: VideoMaskObject[] = [],
): VideoTrack[] {
  return buildVideoTracksFromAll(rects, skeletons, masks)
}

/** Nearest keyframe instance for an object at or before `frame` (else nearest after). */
export function findNearestKeyframe(
  objects: VideoRectObject[],
  objectId: string,
  frame: number,
): VideoRectObject | null {
  const kfs = objects
    .filter((o) => o.object_id === objectId)
    .sort((a, b) => a.frame - b.frame)
  if (!kfs.length) return null
  const before = [...kfs].reverse().find((o) => o.frame <= frame)
  if (before) return before
  return kfs[0]
}

export function findKeyframeAt(
  objects: VideoRectObject[],
  objectId: string,
  frame: number,
): VideoRectObject | null {
  return objects.find((o) => o.object_id === objectId && o.frame === frame) ?? null
}

export function findMaskKeyframeAt(
  masks: VideoMaskObject[],
  objectId: string,
  frame: number,
): VideoMaskObject | null {
  return masks.find((o) => o.object_id === objectId && o.frame === frame) ?? null
}

export function findNearestMaskKeyframe(
  masks: VideoMaskObject[],
  objectId: string,
  frame: number,
): VideoMaskObject | null {
  const kfs = masks.filter((o) => o.object_id === objectId).sort((a, b) => a.frame - b.frame)
  if (!kfs.length) return null
  const before = [...kfs].reverse().find((o) => o.frame <= frame)
  if (before) return before
  return kfs[0]
}

export function findSkeletonKeyframeAt(
  skeletons: VideoSkeletonObject[],
  objectId: string,
  frame: number,
): VideoSkeletonObject | null {
  return skeletons.find((o) => o.object_id === objectId && o.frame === frame) ?? null
}

export function findNearestSkeletonKeyframe(
  skeletons: VideoSkeletonObject[],
  objectId: string,
  frame: number,
): VideoSkeletonObject | null {
  const kfs = skeletons.filter((o) => o.object_id === objectId).sort((a, b) => a.frame - b.frame)
  if (!kfs.length) return null
  const before = [...kfs].reverse().find((o) => o.frame <= frame)
  if (before) return before
  return kfs[0]
}
