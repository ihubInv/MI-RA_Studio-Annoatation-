import type { DetectOptions, DetectedObject } from '../api/inference.service'
import { inferenceService } from '../api/inference.service'
import type { Point } from '../canvas/annTypes'
import { skeletonEdges } from '../canvas/geometryDraw'

export type { DetectOptions, DetectedObject }

function rasterize(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h), w, h, scale }
}

function colorDist(data: Uint8ClampedArray, i: number, r: number, g: number, b: number) {
  const dr = data[i] - r
  const dg = data[i + 1] - g
  const db = data[i + 2] - b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points
  let maxD = 0
  let idx = 0
  const a = points[0]
  const b = points[points.length - 1]
  const lab = Math.hypot(b.x - a.x, b.y - a.y) || 1
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / lab
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD > epsilon) {
    const left = rdp(points.slice(0, idx + 1), epsilon)
    const right = rdp(points.slice(idx), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [a, b]
}

function maskToPolygon(mask: Uint8Array, w: number, h: number, scale: number): Point[] {
  const pts: Point[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!mask[i]) continue
      const edge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]
      if (edge) pts.push({ x, y })
    }
  }
  if (pts.length < 3) return []
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
  pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  const simplified = rdp(pts, 2.2)
  if (simplified.length < 3) return []
  return simplified.map((p) => ({ x: p.x / scale, y: p.y / scale }))
}

function connectedBoxes(mask: Uint8Array, w: number, h: number, scale: number, minArea: number) {
  const seen = new Uint8Array(w * h)
  const boxes: { x: number; y: number; w: number; h: number }[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    const q = [i]
    seen[i] = 1
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    let area = 0
    let head = 0
    while (head < q.length) {
      const cur = q[head++]
      const x = cur % w
      const y = (cur / w) | 0
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      area += 1
      const neigh = [cur - 1, cur + 1, cur - w, cur + w]
      const ok = [x > 0, x < w - 1, y > 0, y < h - 1]
      for (let n = 0; n < 4; n++) {
        if (!ok[n] || seen[neigh[n]] || !mask[neigh[n]]) continue
        seen[neigh[n]] = 1
        q.push(neigh[n])
      }
    }
    if (area < minArea) continue
    boxes.push({
      x: minX / scale,
      y: minY / scale,
      w: (maxX - minX + 1) / scale,
      h: (maxY - minY + 1) / scale,
    })
  }
  boxes.sort((a, b) => b.w * b.h - a.w * a.h)
  return boxes.slice(0, 24)
}

function edgeAwareGrow(
  image: ImageData,
  seeds: { x: number; y: number }[],
  negative: { x: number; y: number }[],
  tolerance: number,
) {
  const { width: w, height: h, data } = image
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    lum[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }
  const grad = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      grad[i] = Math.hypot(lum[i + 1] - lum[i - 1], lum[i + w] - lum[i - w])
    }
  }

  const negBarrier = new Uint8Array(w * h)
  for (const pt of negative) {
    const cx = Math.round(pt.x)
    const cy = Math.round(pt.y)
    const r = 14
    for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) negBarrier[y * w + x] = 1
      }
    }
  }

  const seedColors = seeds.map((s) => {
    const sx = Math.max(0, Math.min(w - 1, Math.round(s.x)))
    const sy = Math.max(0, Math.min(h - 1, Math.round(s.y)))
    const o = (sy * w + sx) * 4
    return { r: data[o], g: data[o + 1], b: data[o + 2] }
  })
  const avg = seedColors.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 },
  )
  avg.r /= Math.max(1, seedColors.length)
  avg.g /= Math.max(1, seedColors.length)
  avg.b /= Math.max(1, seedColors.length)

  const mask = new Uint8Array(w * h)
  const seen = new Uint8Array(w * h)
  const q: number[] = []
  for (const s of seeds) {
    const sx = Math.max(0, Math.min(w - 1, Math.round(s.x)))
    const sy = Math.max(0, Math.min(h - 1, Math.round(s.y)))
    const i = sy * w + sx
    if (negBarrier[i]) continue
    seen[i] = 1
    q.push(i)
  }

  let head = 0
  const max = w * h
  while (head < q.length && q.length < max) {
    const i = q[head++]
    const x = i % w
    const y = (i / w) | 0
    const pix = i * 4
    const edgePenalty = grad[i] > 22 ? tolerance * 0.55 : 0
    if (colorDist(data, pix, avg.r, avg.g, avg.b) > tolerance + edgePenalty) continue
    mask[i] = 1
    const neigh = [i - 1, i + 1, i - w, i + w]
    const ok = [x > 0, x < w - 1, y > 0, y < h - 1]
    for (let n = 0; n < 4; n++) {
      if (!ok[n] || seen[neigh[n]] || negBarrier[neigh[n]]) continue
      seen[neigh[n]] = 1
      q.push(neigh[n])
    }
  }
  return mask
}

export async function segmentWithPrompts(
  img: HTMLImageElement,
  positive: Point[],
  negative: Point[] = [],
  tolerance = 36,
  model = 'mobile_sam',
) {
  if (!positive.length) return []
  try {
    const result = await inferenceService.segment(img, positive, negative, model)
    if (result.points.length >= 3) {
      return result.points.map((p) => ({ x: p.x, y: p.y }))
    }
  } catch (err) {
    console.warn('[segment] SAM unavailable, using on-device fallback', err)
  }
  const { data, w, h, scale } = rasterize(img, 480)
  const pos = positive.map((p) => ({
    x: Math.max(0, Math.min(w - 1, Math.round(p.x * scale))),
    y: Math.max(0, Math.min(h - 1, Math.round(p.y * scale))),
  }))
  const neg = negative.map((p) => ({
    x: Math.max(0, Math.min(w - 1, Math.round(p.x * scale))),
    y: Math.max(0, Math.min(h - 1, Math.round(p.y * scale))),
  }))
  const mask = edgeAwareGrow(data, pos, neg, tolerance)
  return maskToPolygon(mask, w, h, scale)
}

export async function segmentAt(img: HTMLImageElement, point: Point, tolerance = 32) {
  return segmentWithPrompts(img, [point], [], tolerance)
}

export async function detectObjects(img: HTMLImageElement, opts: DetectOptions = {}) {
  try {
    const result = await inferenceService.detect(img, opts)
    if (result.objects.length) {
      return { objects: result.objects, engine: 'yolo' as const, model: result.model, output: result.output }
    }
  } catch (err) {
    console.warn('[detect] pretrained model unavailable, using heuristic fallback', err)
  }
  const boxes = detectObjectsHeuristic(img)
  return {
    objects: boxes.map((b) => ({
      class_name: 'Object',
      confidence: 0,
      tool_type: 'bbox',
      geometry: { ...b, rotation: 0 },
    })),
    engine: 'heuristic' as const,
    output: opts.output ?? 'bbox',
  }
}

function detectObjectsHeuristic(img: HTMLImageElement) {
  const { data, w, h, scale } = rasterize(img, 240)
  const px = data.data
  let lumSum = 0
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    lum[i] = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]
    lumSum += lum[i]
  }
  const mean = lumSum / (w * h)
  const mask = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx = lum[i + 1] - lum[i - 1]
      const gy = lum[i + w] - lum[i - w]
      const edge = Math.hypot(gx, gy)
      const contrast = Math.abs(lum[i] - mean)
      if (edge > 18 || contrast > 28) mask[i] = 1
    }
  }
  return connectedBoxes(mask, w, h, scale, Math.max(40, (w * h) / 180))
}

const POSE_TEMPLATE: Point[] = [
  { x: 0.5, y: 0.08 },
  { x: 0.44, y: 0.06 },
  { x: 0.56, y: 0.06 },
  { x: 0.38, y: 0.1 },
  { x: 0.62, y: 0.1 },
  { x: 0.32, y: 0.28 },
  { x: 0.68, y: 0.28 },
  { x: 0.22, y: 0.48 },
  { x: 0.78, y: 0.48 },
  { x: 0.16, y: 0.66 },
  { x: 0.84, y: 0.66 },
  { x: 0.38, y: 0.58 },
  { x: 0.62, y: 0.58 },
  { x: 0.4, y: 0.78 },
  { x: 0.6, y: 0.78 },
  { x: 0.4, y: 0.96 },
  { x: 0.6, y: 0.96 },
]

export async function estimatePose(img: HTMLImageElement, point: Point, model = 'yolov8n-pose') {
  try {
    const result = await inferenceService.pose(img, point, model)
    if (result.geometry?.points) {
      const g = result.geometry as {
        points: Point[]
        edges?: [number, number][]
        names?: string[]
        visibility?: number[]
      }
      return {
        points: g.points,
        edges: g.edges || skeletonEdges(g.points.length),
        names: g.names,
        visibility: g.visibility,
      }
    }
  } catch (err) {
    console.warn('[pose] YOLO-pose unavailable, using template fallback', err)
  }
  return poseAt(point, img.naturalWidth || img.width, img.naturalHeight || img.height)
}

export function poseAt(point: Point, imageW: number, imageH: number) {
  const size = Math.max(80, Math.min(imageW, imageH) * 0.42)
  const left = point.x - size / 2
  const top = point.y - size * 0.15
  const points = POSE_TEMPLATE.map((p) => ({
    x: left + p.x * size * 0.7,
    y: top + p.y * size,
  }))
  return { points, edges: skeletonEdges(points.length) }
}

export type AiToolId = 'magic_wand' | 'ai_segment' | 'ai_detect' | 'ai_pose'
