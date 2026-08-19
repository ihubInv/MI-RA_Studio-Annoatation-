import type { Point } from '@/modules/image/canvas/annTypes'
import type { RleMask } from '@/modules/image/canvas/maskRle'
import { decodeRle, rleToHullPoints } from '@/modules/image/canvas/maskRle'
import { normalizeOcclusion, type OcclusionState } from '@/modules/video/schema/occlusion'
import { newObjectId } from '@/modules/video/canvas/types'

export type SegmentationMode = 'instance' | 'semantic'

export type VideoMaskToolType = 'brush' | 'eraser' | 'mask' | 'instance_seg' | 'semantic_seg'

export interface VideoMaskObject {
  id: string
  object_id: string
  label: string
  frame: number
  tool_type: VideoMaskToolType
  segmentation_mode: SegmentationMode
  color: string
  rle: RleMask
  points?: Point[]
  strokeWidth?: number
  visible?: boolean
  locked?: boolean
  occlusion?: OcclusionState
  attributes?: Record<string, unknown>
}

export function semanticObjectId(label: string) {
  return `semantic:${label}`
}

export function normalizeMask(raw: Record<string, unknown>): VideoMaskObject | null {
  const rle = raw.rle as RleMask | undefined
  if (!rle?.counts?.length || !rle.size) return null
  const segMode = raw.segmentation_mode === 'semantic' ? 'semantic' : 'instance'
  const tool = String(raw.tool_type || 'brush') as VideoMaskToolType
  const label = String(raw.label || 'Object')
  return {
    id: String(raw.id || newObjectId()),
    object_id: String(raw.object_id || (segMode === 'semantic' ? semanticObjectId(label) : 'Object_001')),
    label,
    frame: Math.max(0, Math.floor(Number(raw.frame) || 0)),
    tool_type: tool,
    segmentation_mode: segMode,
    color: String(raw.color || '#0d559e'),
    rle,
    points: Array.isArray(raw.points) ? (raw.points as Point[]) : rleToHullPoints(rle),
    strokeWidth: Number(raw.strokeWidth) || 16,
    visible: raw.visible !== false,
    locked: raw.locked === true,
    occlusion: normalizeOcclusion(raw.occlusion),
    attributes: (raw.attributes as Record<string, unknown>) || undefined,
  }
}

export function hitTestMask(px: number, py: number, mask: VideoMaskObject): boolean {
  const [h, w] = mask.rle.size
  const x = Math.floor(px)
  const y = Math.floor(py)
  if (x < 0 || y < 0 || x >= w || y >= h) return false
  const data = decodeRle(mask.rle)
  return data[y * w + x] === 1
}

export function maskGeometryFromStroke(
  geometry: { rle?: RleMask; points?: Point[]; strokeWidth?: number },
): Pick<VideoMaskObject, 'rle' | 'points' | 'strokeWidth'> {
  return {
    rle: geometry.rle!,
    points: geometry.points,
    strokeWidth: geometry.strokeWidth ?? 16,
  }
}
