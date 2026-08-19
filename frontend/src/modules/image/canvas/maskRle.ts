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

function paintStroke(ctx: CanvasRenderingContext2D, pts: Point[], width: number) {
  if (!pts.length) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

function canvasToMask(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Uint8Array(canvas.width * canvas.height)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const mask = new Uint8Array(canvas.width * canvas.height)
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 20 ? 1 : 0
  return mask
}

export function strokeToMaskGeometry(
  pts: Point[],
  imageW: number,
  imageH: number,
  strokeWidth = 16,
  existing?: { rle?: RleMask; points?: unknown; tool_type?: string },
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

  paintStroke(ctx, pts, strokeWidth)
  const mask = canvasToMask(canvas)
  const rle = encodeRle(mask, w, h)
  const box = maskBbox(mask, w, h)
  return {
    points: pts,
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
