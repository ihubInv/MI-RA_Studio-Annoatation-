import { useCallback, useEffect, useRef } from 'react'
import type { AudioSegment, TranscriptionSpan, WaveformData } from '@/modules/video/audio/audioTypes'
import { cn } from '@/utils/cn'

interface Viewport {
  xAtFrame: (f: number) => number
  pxPerFrame?: number
}

function xToFrame(x: number, viewport: Viewport, maxFrame: number): number {
  const ppf = viewport.pxPerFrame ?? viewport.xAtFrame(1) - viewport.xAtFrame(0)
  return Math.max(0, Math.min(maxFrame, Math.round(x / Math.max(ppf, 1e-6))))
}

interface Props {
  waveform: WaveformData | null
  viewport: Viewport
  labelWidth: number
  maxFrame: number
  currentFrame: number
  disabled?: boolean
  segments?: AudioSegment[]
  transcriptions?: TranscriptionSpan[]
  selectedSegmentId?: string | null
  segmentDraft?: { startFrame: number; endFrame?: number } | null
  onSeek?: (frame: number) => void
  onSelectSegment?: (id: string) => void
  onCreateSegment?: (start: number, end: number) => void
  onSelectTranscription?: (id: string) => void
}

/** Task 22.2–22.3 — waveform lane synced to video timeline. */
export function AudioWaveformLane({
  waveform,
  viewport,
  labelWidth,
  maxFrame,
  currentFrame,
  disabled,
  segments = [],
  transcriptions = [],
  selectedSegmentId,
  segmentDraft,
  onSeek,
  onSelectSegment,
  onCreateSegment,
  onSelectTranscription,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const laneH = 48

  const drawWaveform = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, w, h)

      if (!waveform?.peaks.length) {
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px monospace'
        ctx.fillText('Extract audio to show waveform', 8, h / 2 + 3)
        return
      }

      const peaks = waveform.peaks
      const mid = h / 2
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let i = 0; i < peaks.length; i++) {
        const x = (i / Math.max(peaks.length - 1, 1)) * w
        const amp = peaks[i] * (h * 0.42)
        ctx.moveTo(x, mid - amp)
        ctx.lineTo(x, mid + amp)
      }
      ctx.stroke()

      for (const seg of segments) {
        const x0 = viewport.xAtFrame(seg.start_frame)
        const x1 = viewport.xAtFrame(seg.end_frame)
        ctx.fillStyle = `${seg.color}44`
        ctx.fillRect(x0, 0, Math.max(2, x1 - x0), h)
        ctx.strokeStyle = seg.color
        ctx.lineWidth = selectedSegmentId === seg.id ? 2 : 1
        ctx.strokeRect(x0, 0, Math.max(2, x1 - x0), h)
      }

      if (segmentDraft?.endFrame != null) {
        const x0 = viewport.xAtFrame(Math.min(segmentDraft.startFrame, segmentDraft.endFrame))
        const x1 = viewport.xAtFrame(Math.max(segmentDraft.startFrame, segmentDraft.endFrame))
        ctx.strokeStyle = '#6366f1'
        ctx.setLineDash([4, 3])
        ctx.strokeRect(x0, 0, Math.max(2, x1 - x0), h)
        ctx.setLineDash([])
      }

      const playX = viewport.xAtFrame(currentFrame)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(playX, 0)
      ctx.lineTo(playX, h)
      ctx.stroke()
    },
    [waveform, segments, selectedSegmentId, segmentDraft, viewport, currentFrame],
  )

  const paint = useCallback(() => {
    const node = canvasRef.current
    if (!node) return
    const parent = node.parentElement
    if (!parent) return
    const w = Math.max(1, parent.clientWidth - labelWidth)
    const h = laneH
    if (node.width !== w || node.height !== h) {
      node.width = w
      node.height = h
    }
    const ctx = node.getContext('2d')
    if (!ctx) return
    drawWaveform(ctx, w, h)
  }, [drawWaveform, labelWidth])

  useEffect(() => {
    paint()
  }, [paint])

  const segmentAtFrame = useCallback(
    (frame: number) => segments.find((s) => frame >= s.start_frame && frame <= s.end_frame) ?? null,
    [segments],
  )

  return (
    <div className="relative border-t-2 border-border/80 bg-indigo-50/20">
      <div className="relative h-12 border-b border-border/40">
        <span
          className="sticky left-0 z-20 h-full pl-1.5 pr-1 text-2xs truncate bg-white/95 border-r border-border/40 flex items-center text-indigo-700 pointer-events-none"
          style={{ width: labelWidth }}
        >
          Audio
        </span>
        <canvas
          ref={canvasRef}
          className="absolute top-0 h-12"
          style={{ left: labelWidth, width: `calc(100% - ${labelWidth}px)` }}
          onPointerDown={(e) => {
            if (disabled) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = e.clientX - rect.left
            const frame = xToFrame(x, viewport, maxFrame)
            const hit = segmentAtFrame(frame)
            if (hit && onSelectSegment) {
              onSelectSegment(hit.id)
              onSeek?.(frame)
              return
            }
            if (e.detail === 2 && onCreateSegment) {
              onCreateSegment(frame, frame)
              return
            }
            onSeek?.(frame)
            if (!onCreateSegment) return
            const start = frame
            const drag = { end: start }
            const onMove = (ev: PointerEvent) => {
              const fx = ev.clientX - rect.left
              drag.end = xToFrame(fx, viewport, maxFrame)
            }
            const onUp = () => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              if (Math.abs(drag.end - start) >= 1) onCreateSegment(start, drag.end)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
        />
      </div>
      {transcriptions.length > 0 && (
        <div className="relative min-h-6 border-b border-border/40 bg-white/50">
          <span
            className="sticky left-0 z-20 h-full pl-1.5 text-2xs text-muted-foreground bg-white/95 border-r border-border/40 flex items-center pointer-events-none absolute inset-y-0"
            style={{ width: labelWidth }}
          >
            ASR
          </span>
          <div className="relative h-6 ml-0" style={{ marginLeft: labelWidth }}>
            {transcriptions.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  'absolute top-0.5 bottom-0.5 rounded px-1 text-[9px] truncate bg-indigo-100 border border-indigo-200 hover:bg-indigo-200',
                )}
                style={{
                  left: viewport.xAtFrame(t.start_frame),
                  width: Math.max(24, viewport.xAtFrame(t.end_frame) - viewport.xAtFrame(t.start_frame)),
                }}
                title={t.text}
                onClick={() => onSelectTranscription?.(t.id)}
              >
                {t.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
