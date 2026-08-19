import type { Point } from './annTypes'
import { asPoints } from './geometryDraw'

export interface RleMask {
  counts: number[]
  size: [number, number]
}

function fortranPixels(mask: Uint8Array, w: number, h: number) {
  const out = new Uint8Array(w * h)
  let i = 0
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) out[i++] = mask[y * w + x] ? 1 : 0
  }
  return out
}

export function encodeRle(mask: Uint8Array, w: number, h: number): RleMask {
  const pix = fortranPixels(mask, w, h)
  const counts: number[] = []
  let last = 0
  let run = 0
  for (let i = 0; i < pix.length; i++) {
    const v = pix[i]
    if (v !== last) {
      counts.push(run)
      run = 0
      last = v
    }
    run++
  }
  counts.push(run)
  return { counts, size: [h, w] }
}

export function decodeRle(rle: RleMask): Uint8Array {
  const [h, w] = rle.size
  const rowMajor = new Uint8Array(w * h)
  let i = 0
  let val = 0
  for (const run of rle.counts) {
    for (let n = 0; n < run; n++) {
      const x = Math.floor(i / h)
      const y = i % h
      if (x < w && y < h) rowMajor[y * w + x] = val
      i++
    }
    val = val ? 0 : 1
  }
  return rowMajor
}

export function rleToCanvas(rle: RleMask, color: string, alpha = 90) {
  const [h, w] = rle.size
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const img = ctx.createImageData(w, h)
  const mask = decodeRle(rle)
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16) || 13
  const g = parseInt(hex.slice(2, 4), 16) || 85
  const b = parseInt(hex.slice(4, 6), 16) || 158
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const o = p * 4
    img.data[o] = r
    img.data[o + 1] = g
    img.data[o + 2] = b
    img.data[o + 3] = alpha
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function maskBbox(mask: Uint8Array, w: number, h: number) {
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export type StrokeMode = 'add' | 'subtract'

function paintStroke(ctx: CanvasRenderingContext2D, pts: Point[], width: number, mode: StrokeMode = 'add') {
  if (!pts.length) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = width
  if (mode === 'subtract') ctx.globalCompositeOperation = 'destination-out'
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.restore()
}

function canvasToMask(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Uint8Array(canvas.width * canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const mask = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 20 ? 1 : 0
  return mask
}

export function maskIsEmpty(rle?: RleMask | null) {
  if (!rle?.counts?.length) return true
  const mask = decodeRle(rle)
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) return false
  }
  return true
}

export function rleToHullPoints(rle: RleMask): Point[] {
  const [h, w] = rle.size
  const mask = decodeRle(rle)
  const pts: Point[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      const edge =
        x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[y * w + x - 1] || !mask[y * w + x + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x]
      if (edge) pts.push({ x, y })
    }
  }
  if (pts.length < 3) {
    const box = maskBbox(mask, w, h)
    if (box.w <= 0) return []
    return [
      { x: box.x, y: box.y },
      { x: box.x + box.w, y: box.y },
      { x: box.x + box.w, y: box.y + box.h },
      { x: box.x, y: box.y + box.h },
    ]
  }
  return pts
}

export function strokeToMaskGeometry(
  pts: Point[],
  imageW: number,
  imageH: number,
  strokeWidth = 16,
  existing?: { rle?: RleMask; points?: unknown; tool_type?: string },
  mode: StrokeMode = 'add',
) {
  const w = Math.max(1, Math.round(imageW))
  const h = Math.max(1, Math.round(imageH))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { points: pts, strokeWidth }

  if (existing?.rle?.counts) {
    const prev = rleToCanvas(existing.rle, '#ffffff', 255)
    ctx.drawImage(prev, 0, 0)
  } else if (existing?.points) {
    const poly = asPoints(existing.points)
    if (poly.length >= 3) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(poly[0].x, poly[0].y)
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
      ctx.closePath()
      ctx.fill()
    }
  }

  paintStroke(ctx, pts, strokeWidth, mode)
  const mask = canvasToMask(canvas)
  const rle = encodeRle(mask, w, h)
  const box = maskBbox(mask, w, h)
  const hull = rleToHullPoints(rle)
  return {
    points: hull.length >= 3 ? hull : pts,
    strokeWidth,
    rle,
    width: w,
    height: h,
    ...box,
  }
}

export function orMasks(a: RleMask, b: RleMask): RleMask | null {
  if (a.size[0] !== b.size[0] || a.size[1] !== b.size[1]) return null
  const [h, w] = a.size
  const ma = decodeRle(a)
  const mb = decodeRle(b)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = ma[i] || mb[i] ? 1 : 0
  return encodeRle(out, w, h)
}

export function subtractMasks(a: RleMask, b: RleMask): RleMask | null {
  if (a.size[0] !== b.size[0] || a.size[1] !== b.size[1]) return null
  const [h, w] = a.size
  const ma = decodeRle(a)
  const mb = decodeRle(b)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = ma[i] && !mb[i] ? 1 : 0
  return encodeRle(out, w, h)
}

export function polygonToMaskGeometry(points: Point[], imageW: number, imageH: number) {
  const w = Math.max(1, Math.round(imageW))
  const h = Math.max(1, Math.round(imageH))
  if (points.length < 3) return { points }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return { points }
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.closePath()
  ctx.fill()
  const mask = canvasToMask(canvas)
  const rle = encodeRle(mask, w, h)
  const box = maskBbox(mask, w, h)
  const hull = rleToHullPoints(rle)
  return { points: hull.length >= 3 ? hull : points, rle, width: w, height: h, ...box }
}

export function mergeManyMasks(masks: RleMask[]): RleMask | null {
  if (!masks.length) return null
  let merged = masks[0]
  for (let i = 1; i < masks.length; i++) {
    const next = orMasks(merged, masks[i])
    if (!next) return null
    merged = next
  }
  return merged
}

function maskFromExisting(
  existing: { rle?: RleMask; points?: unknown },
  w: number,
  h: number,
): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Uint8Array(w * h)
  if (existing.rle?.counts) {
    ctx.drawImage(rleToCanvas(existing.rle, '#ffffff', 255), 0, 0)
  } else if (existing.points) {
    const poly = asPoints(existing.points)
    if (poly.length >= 3) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(poly[0].x, poly[0].y)
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
      ctx.closePath()
      ctx.fill()
    }
  }
  return canvasToMask(canvas)
}

function cutLineOnMask(mask: Uint8Array, w: number, h: number, a: Point, b: Point, thickness = 4) {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const cx = a.x + (b.x - a.x) * t
    const cy = a.y + (b.y - a.y) * t
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) {
        const x = Math.round(cx + dx)
        const y = Math.round(cy + dy)
        if (x >= 0 && x < w && y >= 0 && y < h) mask[y * w + x] = 0
      }
    }
  }
}

function largestComponents(mask: Uint8Array, w: number, h: number, keep = 2): Uint8Array[] {
  const seen = new Uint8Array(w * h)
  const comps: { area: number; pixels: number[] }[] = []
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue
    const q = [i]
    seen[i] = 1
    const pixels: number[] = []
    let head = 0
    while (head < q.length) {
      const cur = q[head++]
      pixels.push(cur)
      const x = cur % w
      const y = (cur / w) | 0
      const neigh = [cur - 1, cur + 1, cur - w, cur + w]
      const ok = [x > 0, x < w - 1, y > 0, y < h - 1]
      for (let n = 0; n < 4; n++) {
        if (!ok[n] || seen[neigh[n]] || !mask[neigh[n]]) continue
        seen[neigh[n]] = 1
        q.push(neigh[n])
      }
    }
    comps.push({ area: pixels.length, pixels })
  }
  comps.sort((a, b) => b.area - a.area)
  return comps.slice(0, keep).map((c) => {
    const out = new Uint8Array(w * h)
    for (const p of c.pixels) out[p] = 1
    return out
  })
}

export function splitMaskByLine(
  existing: { rle?: RleMask; points?: unknown },
  lineA: Point,
  lineB: Point,
  imageW: number,
  imageH: number,
): [{ rle: RleMask; points: Point[] } | null, { rle: RleMask; points: Point[] } | null] {
  const w = Math.max(1, Math.round(imageW))
  const h = Math.max(1, Math.round(imageH))
  const mask = maskFromExisting(existing, w, h)
  cutLineOnMask(mask, w, h, lineA, lineB)
  const parts = largestComponents(mask, w, h, 2)
  if (parts.length < 2) return [null, null]
  return parts.map((part) => {
    const rle = encodeRle(part, w, h)
    const points = rleToHullPoints(rle)
    return { rle, points }
  }) as [{ rle: RleMask; points: Point[] } | null, { rle: RleMask; points: Point[] } | null]
}
