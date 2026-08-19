import {
  bracketKeyframes,
  interpolationT,
  lerp,
  makeInterpolatedId,
} from '@/modules/video/canvas/interpolation'
import type { VideoJoint, VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'

export interface VideoDisplaySkeleton extends VideoSkeletonObject {
  interpolated?: boolean
}

function interpolateJoints(before: VideoJoint[], after: VideoJoint[], t: number): VideoJoint[] {
  const afterById = new Map(after.map((j) => [j.joint_id, j]))
  return before.map((bj) => {
    const aj = afterById.get(bj.joint_id)
    if (!aj) return bj
    return {
      ...bj,
      x: lerp(bj.x, aj.x, t),
      y: lerp(bj.y, aj.y, t),
      visible: bj.visible && aj.visible,
      occlusion: t < 0.5 ? bj.occlusion : aj.occlusion,
    }
  })
}

function groupSkeletonKeyframes(objects: VideoSkeletonObject[]): Map<string, VideoSkeletonObject[]> {
  const map = new Map<string, VideoSkeletonObject[]>()
  for (const o of objects) {
    const list = map.get(o.object_id) ?? []
    list.push(o)
    map.set(o.object_id, list)
  }
  return map
}

function trackVisible(keyframes: VideoSkeletonObject[]): boolean {
  return keyframes.every((o) => o.visible !== false)
}

function trackLocked(keyframes: VideoSkeletonObject[]): boolean {
  return keyframes.some((o) => o.locked)
}

/** Phase 14.4 — resolve skeleton poses at `frame`, with manual keyframe interpolation. */
export function resolveDisplaySkeletons(
  skeletons: VideoSkeletonObject[],
  frame: number,
): VideoDisplaySkeleton[] {
  const groups = groupSkeletonKeyframes(skeletons)
  const out: VideoDisplaySkeleton[] = []

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
      const joints = interpolateJoints(before.joints, after.joints, t)
      out.push({
        ...before,
        joints,
        frame,
        id: makeInterpolatedId(objectId),
        interpolated: true,
        locked: trackLocked([before, after]),
        occlusion: t < 0.5 ? before.occlusion : after.occlusion,
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

export function skeletonGeometryAtFrame(
  skeletons: VideoSkeletonObject[],
  objectId: string,
  frame: number,
): Pick<VideoSkeletonObject, 'joints' | 'edges' | 'template_id'> | null {
  const display = resolveDisplaySkeletons(skeletons, frame).find((o) => o.object_id === objectId)
  if (!display) return null
  return {
    joints: display.joints.map((j) => ({ ...j })),
    edges: [...display.edges],
    template_id: display.template_id,
  }
}

export function isSkeletonDisplay(obj: { tool_type?: string }): obj is VideoDisplaySkeleton {
  return obj.tool_type === 'skeleton'
}
