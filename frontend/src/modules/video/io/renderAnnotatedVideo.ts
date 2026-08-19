import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import type { VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'
import { eventsAtFrame } from '@/modules/video/events/eventTypes'

export interface OverlayOptions {
  boxes: boolean
  labels: boolean
  ids: boolean
  masks: boolean
  skeleton: boolean
  keypoints: boolean
  trajectory: boolean
  events: boolean
  timestamp: boolean
  frameNumber: boolean
}

export const DEFAULT_OVERLAYS: OverlayOptions = {
  boxes: true,
  labels: true,
  ids: true,
  masks: true,
  skeleton: true,
  keypoints: true,
  trajectory: true,
  events: true,
  timestamp: true,
  frameNumber: true,
}

function pickRecorderMime(): string {
  const candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

export function drawAnnotationFrame(
  ctx: CanvasRenderingContext2D,
  store: VideoAnnotationStore,
  frame: number,
  fps: number,
  trajectories: VideoTrajectory[],
  overlays: OverlayOptions,
) {
  if (overlays.boxes) {
    for (const r of store.rects.filter((o) => o.frame === frame && o.visible !== false)) {
      ctx.save()
      ctx.strokeStyle = r.color
      ctx.fillStyle = r.color
      ctx.lineWidth = 2
      const cx = r.x + r.width / 2
      const cy = r.y + r.height / 2
      if (r.tool_type === 'ellipse') {
        ctx.beginPath()
        ctx.ellipse(cx, cy, r.width / 2, r.height / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else if (r.tool_type === 'point') {
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fill()
      } else if ((r.tool_type === 'polygon' || r.tool_type === 'polyline') && r.points?.length) {
        ctx.beginPath()
        r.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        if (r.tool_type === 'polygon') ctx.closePath()
        ctx.stroke()
      } else {
        if (r.tool_type === 'rotated_rect' && r.rotation) {
          ctx.translate(cx, cy)
          ctx.rotate((r.rotation * Math.PI) / 180)
          ctx.strokeRect(-r.width / 2, -r.height / 2, r.width, r.height)
          ctx.setTransform(1, 0, 0, 1, 0, 0)
        } else {
          ctx.strokeRect(r.x, r.y, r.width, r.height)
        }
      }
      if (overlays.labels || overlays.ids) {
        ctx.font = '12px sans-serif'
        const text = [overlays.ids ? r.object_id : '', overlays.labels ? r.label : ''].filter(Boolean).join(' · ')
        ctx.fillText(text, r.x, Math.max(12, r.y - 4))
      }
      ctx.restore()
    }
  }
  if (overlays.skeleton || overlays.keypoints) {
    for (const s of store.skeletons.filter((o) => o.frame === frame && o.visible !== false)) {
      ctx.fillStyle = s.color
      for (const kp of s.joints ?? []) {
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  if (overlays.trajectory) {
    for (const tr of trajectories) {
      if (!tr.points.length) continue
      ctx.strokeStyle = tr.color
      ctx.beginPath()
      tr.points.forEach((p, i) => {
        if (p.frame > frame) return
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()
    }
  }
  if (overlays.events) {
    const evs = eventsAtFrame(store.events, frame)
    if (evs.length) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(8, 8, 280, 20 + evs.length * 14)
      ctx.fillStyle = '#fff'
      ctx.font = '11px sans-serif'
      evs.forEach((e, i) => ctx.fillText(e.label, 14, 24 + i * 14))
    }
  }
  const pad = ctx.canvas.height - 22
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, pad, ctx.canvas.width, 22)
  ctx.fillStyle = '#fff'
  ctx.font = '11px monospace'
  const parts: string[] = []
  if (overlays.frameNumber) parts.push(`f${frame + 1}`)
  if (overlays.timestamp) {
    const t = frame / Math.max(fps, 1)
    parts.push(`${t.toFixed(2)}s`)
  }
  ctx.fillText(parts.join(' · '), 8, pad + 15)
}

export interface RenderAnnotatedOptions {
  /** When omitted, records the entire video from t=0. */
  maxSeconds?: number
  fromPlayhead?: boolean
  onProgress?: (ratio: number) => void
}

/** Record the playing video + overlays. Full file by default (not a short clip). */
export async function renderAnnotatedClip(
  video: HTMLVideoElement,
  store: VideoAnnotationStore,
  trajectories: VideoTrajectory[],
  overlays: OverlayOptions,
  fps: number,
  maxSecondsOrOpts?: number | RenderAnnotatedOptions,
): Promise<{ blob: Blob; ext: string; mime: string }> {
  const opts: RenderAnnotatedOptions = typeof maxSecondsOrOpts === 'number' ? { maxSeconds: maxSecondsOrOpts, fromPlayhead: true } : maxSecondsOrOpts ?? {}
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 1280
  canvas.height = video.videoHeight || 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  const mime = pickRecorderMime()
  const ext = mime.includes('mp4') ? 'mp4' : 'webm'
  const stream = canvas.captureStream(Math.min(Math.max(fps, 1), 30))
  const rec = new MediaRecorder(stream, { mimeType: mime })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }

  const savedTime = video.currentTime
  const savedPaused = video.paused
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const start = opts.fromPlayhead ? video.currentTime : 0
  const end = opts.maxSeconds != null ? Math.min(duration || start + opts.maxSeconds, start + opts.maxSeconds) : duration || start

  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = start
  })

  rec.start(500)
  video.playbackRate = 1
  await video.play().catch(() => undefined)

  await new Promise<void>((resolve) => {
    const draw = () => {
      if (video.ended || video.currentTime >= end - 0.04) {
        rec.stop()
        return
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frame = Math.round(video.currentTime * Math.max(fps, 1))
      drawAnnotationFrame(ctx, store, frame, fps, trajectories, overlays)
      const span = Math.max(end - start, 0.001)
      opts.onProgress?.((video.currentTime - start) / span)
      requestAnimationFrame(draw)
    }
    rec.addEventListener('stop', () => resolve(), { once: true })
    requestAnimationFrame(draw)
  })

  video.pause()
  video.currentTime = savedTime
  if (!savedPaused) void video.play().catch(() => undefined)

  return { blob: new Blob(chunks, { type: mime }), ext, mime }
}
