import type { DetectedObject, DetectOutput } from '@/modules/image/api/inference.service'
import { polygonToMaskGeometry } from '@/modules/image/canvas/maskRle'
import { COCO_KEYPOINT_NAMES } from '@/modules/image/canvas/geometryDraw'
import type { VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'

export type SmartSuggestionType =
  | 'detection'
  | 'tracked_keyframe'
  | 'low_confidence'
  | 'id_switch_suspect'

export type SmartHintType = 'keyframe' | 'gap' | 'low_confidence' | 'id_switch' | 'reid'

export interface AiSuggestionBase {
  id: string
  frame: number
  confidence: number
  class_name: string
  engine?: string
  model?: string
  status: 'pending' | 'accepted' | 'rejected'
}

export interface AiDetectSuggestion extends AiSuggestionBase {
  kind: 'detect'
  tool_type: 'bbox' | 'rectangle'
  x: number
  y: number
  width: number
  height: number
  track_id?: string
  track_confidence?: number
  match_iou?: number
  suggestion_type?: SmartSuggestionType
  needs_review?: boolean
}

export interface AiSmartHint extends AiSuggestionBase {
  kind: 'smart_hint'
  hint_type: SmartHintType
  object_id?: string
  linked_object_id?: string
  message: string
  gap_start?: number
  gap_end?: number
}

export interface AiMaskSuggestion extends AiSuggestionBase {
  kind: 'segment'
  points: { x: number; y: number }[]
  segmentation_mode: 'instance' | 'semantic'
}

export interface AiPoseSuggestion extends AiSuggestionBase {
  kind: 'pose'
  joints: { joint_id: string; name: string; x: number; y: number; visible: boolean }[]
  edges: [string, string][]
  template_id: string
}

export type AiSuggestion = AiDetectSuggestion | AiMaskSuggestion | AiPoseSuggestion | AiSmartHint

const COCO_EDGES: [string, string][] = [
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
]

export function mapDetectResults(
  objects: DetectedObject[],
  frame: number,
  engine?: string,
  model?: string,
): AiDetectSuggestion[] {
  return objects
    .filter((o) => o.tool_type === 'bbox' || o.tool_type === 'rectangle' || !o.tool_type)
    .map((o) => {
      const g = o.geometry as { x?: number; y?: number; width?: number; height?: number }
      return {
        id: crypto.randomUUID(),
        kind: 'detect' as const,
        frame,
        class_name: o.class_name || 'Object',
        confidence: o.confidence ?? 0,
        engine,
        model,
        status: 'pending' as const,
        tool_type: (o.tool_type === 'rectangle' ? 'rectangle' : 'bbox') as 'bbox' | 'rectangle',
        x: Number(g.x) || 0,
        y: Number(g.y) || 0,
        width: Number(g.width) || 0,
        height: Number(g.height) || 0,
      }
    })
    .filter((s) => s.width > 2 && s.height > 2)
}

export function mapSegmentResult(
  points: { x: number; y: number }[],
  frame: number,
  label: string,
  confidence: number,
  _imageW: number,
  _imageH: number,
  engine?: string,
  model?: string,
  segmentation_mode: 'instance' | 'semantic' = 'instance',
): AiMaskSuggestion | null {
  if (points.length < 3) return null
  return {
    id: crypto.randomUUID(),
    kind: 'segment',
    frame,
    class_name: label,
    confidence,
    engine,
    model,
    status: 'pending',
    points,
    segmentation_mode,
  }
}

export function mapPoseResult(
  geometry: Record<string, unknown> | null | undefined,
  frame: number,
  label: string,
  confidence: number,
  engine?: string,
  model?: string,
): AiPoseSuggestion | null {
  if (!geometry?.points) return null
  const pts = geometry.points as { x: number; y: number }[]
  const names = (geometry.names as string[]) || COCO_KEYPOINT_NAMES
  const visibility = (geometry.visibility as number[]) || []
  const joints = pts.map((p, i) => ({
    joint_id: names[i] || `joint_${i}`,
    name: names[i] || `joint_${i}`,
    x: p.x,
    y: p.y,
    visible: visibility[i] == null ? true : visibility[i] > 0.3,
  }))
  return {
    id: crypto.randomUUID(),
    kind: 'pose',
    frame,
    class_name: label,
    confidence,
    engine,
    model,
    status: 'pending',
    joints,
    edges: COCO_EDGES,
    template_id: 'coco-17',
  }
}

export function suggestionToRect(s: AiDetectSuggestion, object_id: string, color: string): Omit<VideoRectObject, 'id'> {
  return {
    object_id,
    label: s.class_name,
    frame: s.frame,
    tool_type: s.tool_type,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    color,
    visible: true,
    locked: false,
    attributes: {
      source:
        s.suggestion_type === 'low_confidence' || s.needs_review
          ? 'ai_track_review'
          : s.engine === 'track' || s.engine === 'smart_track'
            ? 'ai_track'
            : 'ai_detect',
      confidence: s.confidence,
      engine: s.engine,
      model: s.model,
      ...(s.track_confidence != null ? { track_confidence: s.track_confidence } : {}),
      ...(s.match_iou != null ? { match_iou: s.match_iou } : {}),
      ...(s.needs_review ? { needs_review: true } : {}),
    },
  }
}

export function suggestionToMask(
  s: AiMaskSuggestion,
  object_id: string,
  color: string,
  imageW: number,
  imageH: number,
): Omit<VideoMaskObject, 'id'> | null {
  const geom = polygonToMaskGeometry(s.points, imageW, imageH)
  if (!('rle' in geom) || !geom.rle) return null
  return {
    object_id,
    label: s.class_name,
    frame: s.frame,
    tool_type: s.segmentation_mode === 'semantic' ? 'semantic_seg' : 'instance_seg',
    segmentation_mode: s.segmentation_mode,
    color,
    rle: geom.rle,
    points: geom.points as { x: number; y: number }[],
    strokeWidth: 16,
    visible: true,
    locked: false,
    attributes: {
      source: 'ai_segment',
      confidence: s.confidence,
      engine: s.engine,
      model: s.model,
    },
  }
}

export function suggestionToSkeleton(
  s: AiPoseSuggestion,
  object_id: string,
  color: string,
): Omit<VideoSkeletonObject, 'id'> {
  return {
    object_id,
    label: s.class_name,
    frame: s.frame,
    tool_type: 'skeleton',
    template_id: s.template_id,
    color,
    joints: s.joints.map((j) => ({
      joint_id: j.joint_id,
      name: j.name,
      x: j.x,
      y: j.y,
      visible: j.visible,
      occlusion: 'visible' as const,
    })),
    edges: s.edges,
    visible: true,
    locked: false,
    attributes: {
      source: 'ai_pose',
      confidence: s.confidence,
      engine: s.engine,
      model: s.model,
    },
  }
}

export function iouMatch(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  const ix1 = Math.max(a.x, b.x)
  const iy1 = Math.max(a.y, b.y)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)
  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const inter = iw * ih
  if (inter <= 0) return 0
  const areaA = a.width * a.height
  const areaB = b.width * b.height
  return inter / (areaA + areaB - inter)
}

export type { DetectOutput }
