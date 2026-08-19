import type { Point } from '@/modules/image/canvas/annTypes'
import {
  maskIsEmpty,
  mergeManyMasks,
  polygonToMaskGeometry,
  strokeToMaskGeometry,
} from '@/modules/image/canvas/maskRle'
import { newObjectId } from '@/modules/video/canvas/types'
import {
  maskGeometryFromStroke,
  semanticObjectId,
  type SegmentationMode,
  type VideoMaskObject,
} from '@/modules/video/canvas/maskTypes'
import { nextLabeledObjectId } from '@/modules/video/canvas/objectId'

const STROKE_WIDTH = 16

function existingForStroke(m: VideoMaskObject) {
  return { rle: m.rle, points: m.points, tool_type: m.tool_type }
}

export function applyBrushStroke(
  masks: VideoMaskObject[],
  frame: number,
  points: Point[],
  opts: {
    label: string
    color: string
    segmentationMode: SegmentationMode
    imageW: number
    imageH: number
    objectId?: string
    selectedMaskId?: string | null
    allocateObjectId: (label: string) => string
  },
): VideoMaskObject[] {
  const { label, color, segmentationMode, imageW, imageH, allocateObjectId } = opts

  if (segmentationMode === 'semantic') {
    const oid = semanticObjectId(label)
    const existing = masks.find(
      (m) => m.frame === frame && m.segmentation_mode === 'semantic' && m.label === label,
    )
    const geometry = strokeToMaskGeometry(
      points,
      imageW,
      imageH,
      STROKE_WIDTH,
      existing ? existingForStroke(existing) : undefined,
      'add',
    )
    if (!('rle' in geometry) || !geometry.rle) return masks
    if (existing) {
      return masks.map((m) =>
        m.id === existing.id
          ? { ...m, ...maskGeometryFromStroke(geometry), tool_type: 'semantic_seg' }
          : m,
      )
    }
    return [
      ...masks,
      {
        id: newObjectId(),
        object_id: oid,
        label,
        frame,
        tool_type: 'semantic_seg',
        segmentation_mode: 'semantic',
        color,
        ...maskGeometryFromStroke(geometry),
        visible: true,
        locked: false,
        occlusion: 'visible',
      },
    ]
  }

  const selected =
    masks.find((m) => m.id === opts.selectedMaskId && m.frame === frame && !m.locked) ??
    masks.find((m) => m.object_id === opts.objectId && m.frame === frame && !m.locked)

  if (selected) {
    const geometry = strokeToMaskGeometry(
      points,
      imageW,
      imageH,
      STROKE_WIDTH,
      existingForStroke(selected),
      'add',
    )
    if (!('rle' in geometry) || !geometry.rle) return masks
    return masks.map((m) =>
      m.id === selected.id ? { ...m, ...maskGeometryFromStroke(geometry), tool_type: 'brush' } : m,
    )
  }

  const object_id = opts.objectId ?? allocateObjectId(label)
  const geometry = strokeToMaskGeometry(points, imageW, imageH, STROKE_WIDTH)
  if (!('rle' in geometry) || !geometry.rle) return masks
  return [
    ...masks,
    {
      id: newObjectId(),
      object_id,
      label,
      frame,
      tool_type: 'instance_seg',
      segmentation_mode: 'instance',
      color,
      ...maskGeometryFromStroke(geometry),
      visible: true,
      locked: false,
      occlusion: 'visible',
    },
  ]
}

export function applyEraserStroke(
  masks: VideoMaskObject[],
  targetId: string,
  points: Point[],
  imageW: number,
  imageH: number,
): VideoMaskObject[] {
  const target = masks.find((m) => m.id === targetId)
  if (!target || target.locked) return masks
  const geometry = strokeToMaskGeometry(
    points,
    imageW,
    imageH,
    STROKE_WIDTH,
    existingForStroke(target),
    'subtract',
  )
  if (maskIsEmpty('rle' in geometry ? geometry.rle : undefined)) {
    return masks.filter((m) => m.id !== targetId)
  }
  return masks.map((m) =>
    m.id === targetId ? { ...m, ...maskGeometryFromStroke(geometry), tool_type: 'brush' } : m,
  )
}

export function applyPolygonMask(
  masks: VideoMaskObject[],
  frame: number,
  points: Point[],
  opts: {
    label: string
    color: string
    segmentationMode: SegmentationMode
    imageW: number
    imageH: number
    objectId?: string
    allocateObjectId: (label: string) => string
  },
): VideoMaskObject[] {
  const { label, color, segmentationMode, imageW, imageH, allocateObjectId } = opts
  const geometry = polygonToMaskGeometry(points, imageW, imageH)
  if (!('rle' in geometry) || !geometry.rle) return masks

  if (segmentationMode === 'semantic') {
    const existing = masks.find(
      (m) => m.frame === frame && m.segmentation_mode === 'semantic' && m.label === label,
    )
    if (existing) {
      const merged = mergeManyMasks([existing.rle, geometry.rle])
      if (!merged) return masks
      const hullGeom = { ...geometry, rle: merged }
      return masks.map((m) =>
        m.id === existing.id
          ? { ...m, ...maskGeometryFromStroke(hullGeom), tool_type: 'semantic_seg' }
          : m,
      )
    }
    return [
      ...masks,
      {
        id: newObjectId(),
        object_id: semanticObjectId(label),
        label,
        frame,
        tool_type: 'semantic_seg',
        segmentation_mode: 'semantic',
        color,
        ...maskGeometryFromStroke(geometry),
        visible: true,
        locked: false,
        occlusion: 'visible',
      },
    ]
  }

  const object_id = opts.objectId ?? allocateObjectId(label)
  return [
    ...masks,
    {
      id: newObjectId(),
      object_id,
      label,
      frame,
      tool_type: 'mask',
      segmentation_mode: 'instance',
      color,
      ...maskGeometryFromStroke(geometry),
      visible: true,
      locked: false,
      occlusion: 'visible',
    },
  ]
}

export function allocateInstanceObjectId(label: string, existingIds: string[]) {
  return nextLabeledObjectId(label, existingIds)
}
