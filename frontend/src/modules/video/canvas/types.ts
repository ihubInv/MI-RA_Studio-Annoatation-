import { normalizeOcclusion, type OcclusionState } from '@/modules/video/schema/occlusion'

/** Video annotation shapes — Phase 7 bbox + Phase 8 geometry tools. */

export type VideoShapeType =
  | 'bbox'
  | 'rectangle'
  // Phase 8.2+ (reserved — not implemented yet)
  | 'rotated_rect'
  | 'polygon'
  | 'polyline'
  | 'point'
  | 'ellipse'
  | 'brush'
  | 'eraser'
  | 'mask'
  | 'keypoints'

/** AI assist tools (Phase 16). */
export type VideoAiTool = 'ai_detect' | 'ai_segment' | 'ai_pose'

export type VideoTool =
  | 'select'
  | 'pan'
  | VideoShapeType
  | VideoAiTool

export interface VideoBbox {
  x: number
  y: number
  width: number
  height: number
}

/** Axis-aligned rect-like shapes (bbox + rectangle). */
export interface VideoRectObject {
  id: string
  object_id: string
  label: string
  frame: number
  tool_type: 'bbox' | 'rectangle' | 'rotated_rect' | 'polygon' | 'polyline' | 'point' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
  color: string
  /** Degrees, for rotated_rect */
  rotation?: number
  /** Vertices for polygon / polyline */
  points?: { x: number; y: number }[]
  /** Phase 9 — default true when omitted */
  visible?: boolean
  /** Phase 9 — default false when omitted */
  locked?: boolean
  /** Phase 13 — occlusion state */
  occlusion?: OcclusionState
  attributes?: Record<string, unknown>
}

/** @deprecated Use VideoRectObject — kept as alias for Phase 7 call sites. */
export type VideoBboxObject = VideoRectObject

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

export function newObjectId() {
  return crypto.randomUUID()
}

export function isRectShape(obj: { tool_type?: string }): obj is VideoRectObject {
  return (
    obj.tool_type === 'bbox' ||
    obj.tool_type === 'rectangle' ||
    obj.tool_type === 'ellipse' ||
    obj.tool_type === 'rotated_rect' ||
    obj.tool_type === 'point' ||
    obj.tool_type === 'polygon' ||
    obj.tool_type === 'polyline' ||
    obj.tool_type == null
  )
}

export function normalizeLoadedObject(raw: Record<string, unknown>): VideoRectObject | null {
  const x = Number(raw.x)
  const y = Number(raw.y)
  const width = Number(raw.width)
  const height = Number(raw.height)
  if (![x, y, width, height].every(Number.isFinite)) return null
  const rawTool = String(raw.tool_type || 'bbox')
  const tool =
    rawTool === 'rectangle' ||
    rawTool === 'rotated_rect' ||
    rawTool === 'polygon' ||
    rawTool === 'polyline' ||
    rawTool === 'point' ||
    rawTool === 'ellipse'
      ? rawTool
      : 'bbox'
  const points = Array.isArray(raw.points)
    ? (raw.points as { x?: number; y?: number }[])
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    : undefined
  return {
    id: String(raw.id || newObjectId()),
    object_id: String(raw.object_id || 'Object_001'),
    label: String(raw.label || 'Object'),
    frame: Math.max(0, Math.floor(Number(raw.frame) || 0)),
    tool_type: tool,
    x,
    y,
    width,
    height,
    color: String(raw.color || '#0d559e'),
    rotation: Number.isFinite(Number(raw.rotation)) ? Number(raw.rotation) : 0,
    points,
    visible: raw.visible === false ? false : true,
    locked: raw.locked === true,
    occlusion: normalizeOcclusion(raw.occlusion),
    attributes: (raw.attributes as Record<string, unknown>) || undefined,
  }
}

export function bboxFromObject(obj: VideoRectObject): VideoBbox {
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height }
}

export function clampBbox(b: VideoBbox, maxW: number, maxH: number, min = 4): VideoBbox {
  let { x, y, width, height } = b
  width = Math.max(min, width)
  height = Math.max(min, height)
  x = Math.max(0, Math.min(x, maxW - width))
  y = Math.max(0, Math.min(y, maxH - height))
  return { x, y, width, height }
}

export function normalizeDragRect(x1: number, y1: number, x2: number, y2: number): VideoBbox {
  const x = Math.min(x1, x2)
  const y = Math.min(y1, y2)
  return { x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
}

export function aabbFromPoints(points: { x: number; y: number }[]): VideoBbox {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(4, Math.max(...xs) - x), height: Math.max(4, Math.max(...ys) - y) }
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  const dx = px - cx
  const dy = py - cy
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
  const x = ax + t * dx
  const y = ay + t * dy
  return Math.hypot(px - x, py - y)
}

function pointInPolygon(px: number, py: number, pts: { x: number; y: number }[]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x
    const yi = pts[i].y
    const xj = pts[j].x
    const yj = pts[j].y
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside
  }
  return inside
}

export function hitTestBbox(px: number, py: number, obj: VideoRectObject, handleSize = 8): ResizeHandle | null {
  const { x, y, width, height } = obj
  const hs = handleSize
  const handles: { id: ResizeHandle; cx: number; cy: number }[] = [
    { id: 'nw', cx: x, cy: y },
    { id: 'n', cx: x + width / 2, cy: y },
    { id: 'ne', cx: x + width, cy: y },
    { id: 'e', cx: x + width, cy: y + height / 2 },
    { id: 'se', cx: x + width, cy: y + height },
    { id: 's', cx: x + width / 2, cy: y + height },
    { id: 'sw', cx: x, cy: y + height },
    { id: 'w', cx: x, cy: y + height / 2 },
  ]
  for (const h of handles) {
    if (Math.abs(px - h.cx) <= hs && Math.abs(py - h.cy) <= hs) return h.id
  }
  if (px >= x && px <= x + width && py >= y && py <= y + height) return 'move'
  return null
}

export function hitTestShape(px: number, py: number, obj: VideoRectObject, handleSize = 8): ResizeHandle | null {
  if (obj.tool_type === 'point') {
    const cx = obj.x + obj.width / 2
    const cy = obj.y + obj.height / 2
    return Math.hypot(px - cx, py - cy) <= Math.max(handleSize, 8) ? 'move' : null
  }
  if (obj.tool_type === 'polygon' && obj.points?.length) {
    if (pointInPolygon(px, py, obj.points)) return 'move'
    for (let i = 0; i < obj.points.length; i++) {
      const a = obj.points[i]
      const b = obj.points[(i + 1) % obj.points.length]
      if (distToSegment(px, py, a.x, a.y, b.x, b.y) <= handleSize) return 'move'
    }
    return null
  }
  if (obj.tool_type === 'polyline' && obj.points?.length) {
    for (let i = 0; i < obj.points.length - 1; i++) {
      const a = obj.points[i]
      const b = obj.points[i + 1]
      if (distToSegment(px, py, a.x, a.y, b.x, b.y) <= handleSize) return 'move'
    }
    return null
  }
  if (obj.tool_type === 'rotated_rect' && (obj.rotation || 0) !== 0) {
    const cx = obj.x + obj.width / 2
    const cy = obj.y + obj.height / 2
    const local = rotatePoint(px, py, cx, cy, -(obj.rotation || 0))
    return hitTestBbox(local.x, local.y, { ...obj, rotation: 0 }, handleSize)
  }
  return hitTestBbox(px, py, obj, handleSize)
}

export function hitTestVertex(px: number, py: number, obj: VideoRectObject, handleSize = 8): number | null {
  if (!obj.points?.length) return null
  for (let i = 0; i < obj.points.length; i++) {
    if (Math.hypot(px - obj.points[i].x, py - obj.points[i].y) <= handleSize) return i
  }
  return null
}

export function applyResize(obj: VideoRectObject, handle: ResizeHandle, px: number, py: number): VideoBbox {
  let { x, y, width, height } = obj
  const right = x + width
  const bottom = y + height
  switch (handle) {
    case 'nw':
      width = right - px
      height = bottom - py
      x = px
      y = py
      break
    case 'n':
      height = bottom - py
      y = py
      break
    case 'ne':
      width = px - x
      height = bottom - py
      y = py
      break
    case 'e':
      width = px - x
      break
    case 'se':
      width = px - x
      height = py - y
      break
    case 's':
      height = py - y
      break
    case 'sw':
      width = right - px
      height = py - y
      x = px
      break
    case 'w':
      width = right - px
      x = px
      break
    default:
      break
  }
  return { x, y, width, height }
}
