import type { LucideIcon } from 'lucide-react'
import {
  Circle,
  Eraser,
  Hand,
  Hexagon,
  MousePointer2,
  Paintbrush,
  PenLine,
  RotateCw,
  Square,
  RectangleHorizontal,
  Target,
  Waypoints,
} from 'lucide-react'
import type { VideoTool } from '@/modules/video/canvas/types'

export type VideoToolCategory = 'navigation' | 'geometry' | 'segmentation' | 'pose'

export interface VideoToolDef {
  id: VideoTool
  label: string
  category: VideoToolCategory
  hotkey: string
  description: string
  icon: LucideIcon
  /** Only true when the tool is fully usable this phase. */
  implemented: boolean
}

/**
 * Video tool registry (spec §5).
 * Phase 8 ships tools one at a time — only `implemented: true` tools are selectable.
 */
export const VIDEO_TOOLS: VideoToolDef[] = [
  { id: 'select', label: 'Select', category: 'navigation', hotkey: 'V', description: 'Select and edit shapes', icon: MousePointer2, implemented: true },
  { id: 'pan', label: 'Pan', category: 'navigation', hotkey: 'H', description: 'Pan the canvas', icon: Hand, implemented: true },
  { id: 'bbox', label: 'BBox', category: 'geometry', hotkey: 'B', description: 'Axis-aligned bounding box (Phase 7)', icon: Square, implemented: true },
  { id: 'rectangle', label: 'Rectangle', category: 'geometry', hotkey: 'R', description: 'Draw an axis-aligned rectangle', icon: RectangleHorizontal, implemented: true },
  { id: 'rotated_rect', label: 'Rotated Rect', category: 'geometry', hotkey: 'O', description: 'Rotated rectangle', icon: RotateCw, implemented: true },
  { id: 'polygon', label: 'Polygon', category: 'geometry', hotkey: 'N', description: 'Closed polygon', icon: Hexagon, implemented: true },
  { id: 'polyline', label: 'Polyline', category: 'geometry', hotkey: 'L', description: 'Open polyline', icon: PenLine, implemented: true },
  { id: 'point', label: 'Point', category: 'geometry', hotkey: 'I', description: 'Single point', icon: Target, implemented: true },
  { id: 'ellipse', label: 'Ellipse', category: 'geometry', hotkey: 'C', description: 'Ellipse', icon: Circle, implemented: true },
  { id: 'brush', label: 'Brush', category: 'segmentation', hotkey: 'M', description: 'Freehand brush mask', icon: Paintbrush, implemented: true },
  { id: 'eraser', label: 'Eraser', category: 'segmentation', hotkey: 'E', description: 'Erase mask / stroke', icon: Eraser, implemented: true },
  { id: 'mask', label: 'Mask', category: 'segmentation', hotkey: 'G', description: 'Polygon instance mask', icon: Hexagon, implemented: true },
  { id: 'keypoints', label: 'Keypoints', category: 'pose', hotkey: 'P', description: 'Skeleton / pose keypoints', icon: Waypoints, implemented: true },
]

export function getImplementedTools() {
  return VIDEO_TOOLS.filter((t) => t.implemented)
}

export function getToolDef(id: VideoTool) {
  return VIDEO_TOOLS.find((t) => t.id === id)
}

export function isDrawRectTool(tool: VideoTool) {
  return tool === 'bbox' || tool === 'rectangle' || tool === 'ellipse' || tool === 'rotated_rect'
}

export function isPathTool(tool: VideoTool) {
  return tool === 'polygon' || tool === 'polyline'
}

export function isPointTool(tool: VideoTool) {
  return tool === 'point'
}

export function isSkeletonTool(tool: VideoTool) {
  return tool === 'keypoints'
}

export function isBrushTool(tool: VideoTool) {
  return tool === 'brush'
}

export function isEraserTool(tool: VideoTool) {
  return tool === 'eraser'
}

export function isMaskPolygonTool(tool: VideoTool) {
  return tool === 'mask'
}

export function isMaskTool(tool: VideoTool) {
  return tool === 'brush' || tool === 'eraser' || tool === 'mask'
}

export function isAiTool(tool: VideoTool): tool is import('@/modules/video/canvas/types').VideoAiTool {
  return tool === 'ai_detect' || tool === 'ai_segment' || tool === 'ai_pose'
}

export function toolTypeForDraw(
  tool: VideoTool,
): 'bbox' | 'rectangle' | 'ellipse' | 'rotated_rect' | null {
  if (tool === 'bbox') return 'bbox'
  if (tool === 'rectangle') return 'rectangle'
  if (tool === 'ellipse') return 'ellipse'
  if (tool === 'rotated_rect') return 'rotated_rect'
  return null
}
