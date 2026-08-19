import { normalizeOcclusion, type OcclusionState } from '@/modules/video/schema/occlusion'
import { newObjectId } from '@/modules/video/canvas/types'

export interface VideoJoint {
  joint_id: string
  name: string
  x: number
  y: number
  visible: boolean
  occlusion: OcclusionState
}

export interface VideoSkeletonObject {
  id: string
  object_id: string
  label: string
  frame: number
  tool_type: 'skeleton'
  template_id: string
  color: string
  joints: VideoJoint[]
  edges: [string, string][]
  visible?: boolean
  locked?: boolean
  occlusion?: OcclusionState
  attributes?: Record<string, unknown>
}

export interface VideoSkeletonStore {
  version: 2
  rects: import('@/modules/video/canvas/types').VideoRectObject[]
  skeletons: VideoSkeletonObject[]
}

export function normalizeSkeleton(raw: Record<string, unknown>): VideoSkeletonObject | null {
  const joints = Array.isArray(raw.joints) ? raw.joints : []
  if (!joints.length) return null
  return {
    id: String(raw.id || newObjectId()),
    object_id: String(raw.object_id || 'Person_001'),
    label: String(raw.label || 'Person'),
    frame: Math.max(0, Math.floor(Number(raw.frame) || 0)),
    tool_type: 'skeleton',
    template_id: String(raw.template_id || 'coco-17'),
    color: String(raw.color || '#fc6900'),
    joints: joints.map((j: Record<string, unknown>) => ({
      joint_id: String(j.joint_id || j.id || ''),
      name: String(j.name || j.joint_id || ''),
      x: Number(j.x),
      y: Number(j.y),
      visible: j.visible !== false,
      occlusion: normalizeOcclusion(j.occlusion),
    })),
    edges: Array.isArray(raw.edges) ? (raw.edges as [string, string][]) : [],
    visible: raw.visible !== false,
    locked: raw.locked === true,
    occlusion: normalizeOcclusion(raw.occlusion),
    attributes: (raw.attributes as Record<string, unknown>) || undefined,
  }
}

export function hitTestJoint(px: number, py: number, sk: VideoSkeletonObject, radius = 10): string | null {
  for (const j of [...sk.joints].reverse()) {
    if (!j.visible) continue
    if (Math.hypot(px - j.x, py - j.y) <= radius) return j.joint_id
  }
  return null
}

export function hitTestSkeleton(px: number, py: number, sk: VideoSkeletonObject, radius = 10): boolean {
  return hitTestJoint(px, py, sk, radius) != null
}
