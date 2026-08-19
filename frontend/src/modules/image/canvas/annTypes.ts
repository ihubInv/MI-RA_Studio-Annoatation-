export interface AnnShape {
  clientId: string
  class_name: string
  tool_type: string
  geometry: Record<string, unknown>
  attributes?: Record<string, unknown>
  visible?: boolean
  locked?: boolean
  instance_id?: string
  track_id?: string
  occluded?: boolean
  linked_object_id?: string
  link_relation?: string
  hierarchical_labels?: string[]
}

export type Point = { x: number; y: number }

export function cloneShapes(shapes: AnnShape[]): AnnShape[] {
  return shapes.map((s) => ({
    ...s,
    geometry: { ...s.geometry, points: Array.isArray(s.geometry.points) ? [...(s.geometry.points as unknown[])] : s.geometry.points },
    attributes: s.attributes ? { ...s.attributes } : undefined,
  }))
}

export function toFlatPoints(points: Point[]): number[] {
  return points.flatMap((p) => [p.x, p.y])
}

export function fromFlatPoints(flat: number[]): Point[] {
  const out: Point[] = []
  for (let i = 0; i < flat.length - 1; i += 2) out.push({ x: flat[i], y: flat[i + 1] })
  return out
}

export function polygonArea(points: Point[]) {
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    area += points[i].x * points[j].y - points[j].x * points[i].y
  }
  return Math.abs(area / 2)
}

export function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}
