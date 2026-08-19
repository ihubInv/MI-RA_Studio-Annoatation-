import { dist, polygonArea, type Point } from './annTypes'

export const CLOSED_TYPES = new Set([
  'polygon',
  'polygon_mask',
  'freehand_mask',
  'semantic_seg',
  'instance_seg',
  'area',
  'mask',
])

export const POLYLINE_TYPES = new Set([
  'polyline',
  'line',
  'freehand',
  'brush',
  'arc',
  'measure',
  'mask_refine',
])

export const MASK_TYPES = new Set([
  'polygon_mask',
  'freehand_mask',
  'semantic_seg',
  'instance_seg',
  'brush',
  'mask',
  'mask_refine',
])

export const RECT_TYPES = new Set(['bbox', 'rotated_bbox', 'roi', 'cuboid', 'bbox3d'])

/** Auto-complete after this many clicks. Undefined = user finishes with Enter. */
export const AUTO_POINTS: Record<string, number> = {
  line: 2,
  measure: 2,
  arc: 3,
  angle: 3,
}

export function asPoints(raw: unknown): Point[] {
  if (!Array.isArray(raw) || raw.length === 0) return []
  if (typeof raw[0] === 'number') {
    const out: Point[] = []
    for (let i = 0; i < raw.length - 1; i += 2) out.push({ x: Number(raw[i]), y: Number(raw[i + 1]) })
    return out
  }
  return raw.map((p: { x?: number; y?: number } | number[]) =>
    Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p.x), y: Number(p.y) },
  )
}

export function quadraticArc(a: Point, b: Point, c: Point, samples = 48): Point[] {
  const out: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const u = 1 - t
    out.push({
      x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
      y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    })
  }
  return out
}

export function angleDegrees(a: Point, vertex: Point, c: Point) {
  const v1x = a.x - vertex.x
  const v1y = a.y - vertex.y
  const v2x = c.x - vertex.x
  const v2y = c.y - vertex.y
  const dot = v1x * v2x + v1y * v2y
  const det = v1x * v2y - v1y * v2x
  return Math.abs((Math.atan2(det, dot) * 180) / Math.PI)
}

const COCO_EDGES: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 4],
  [5, 6],
  [5, 7],
  [7, 9],
  [6, 8],
  [8, 10],
  [5, 11],
  [6, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
]

export const COCO_KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
]

export function skeletonEdges(count: number): [number, number][] {
  if (count >= 17) return COCO_EDGES
  const edges: [number, number][] = []
  for (let i = 0; i < count - 1; i++) edges.push([i, i + 1])
  if (count >= 5) {
    edges.push([0, 2])
    edges.push([1, 3])
  }
  return edges
}

export function convexHull(points: Point[]): Point[] {
  const pts = points
    .slice()
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y)
  if (pts.length <= 2) return pts
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Point[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Point[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

export function buildPointGeometry(tool: string, pts: Point[]): Record<string, unknown> {
  if (tool === 'arc' && pts.length >= 3) {
    const control = pts.slice(0, 3)
    return { points: quadraticArc(control[0], control[1], control[2]), control }
  }
  if (tool === 'angle' && pts.length >= 3) {
    const trio = pts.slice(0, 3)
    return { points: trio, degrees: Math.round(angleDegrees(trio[0], trio[1], trio[2]) * 10) / 10 }
  }
  if (tool === 'line' || tool === 'measure') {
    const pair = pts.slice(0, 2)
    return { points: pair, length: Math.round(dist(pair[0], pair[1]) * 10) / 10 }
  }
  if (tool === 'area') {
    return { points: pts, area: Math.round(polygonArea(pts)) }
  }
  if (tool === 'skeleton') {
    return { points: pts, edges: skeletonEdges(pts.length) }
  }
  if (tool === 'brush' || tool === 'mask_refine') {
    return { points: pts, strokeWidth: 16 }
  }
  if (tool === 'freehand_mask') {
    return { points: pts, closed: true }
  }
  return { points: pts }
}

export function cuboidGeometry(x: number, y: number, w: number, h: number) {
  return {
    x,
    y,
    w,
    h,
    dx: Math.max(12, Math.min(w * 0.35, 48)),
    dy: -Math.max(12, Math.min(h * 0.35, 48)),
  }
}
