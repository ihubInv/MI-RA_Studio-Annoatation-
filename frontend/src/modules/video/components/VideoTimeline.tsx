import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Diamond, Minus, Plus, Maximize2, Magnet, Trash2, ArrowRight, ArrowLeft, Split } from 'lucide-react'
import type { FrameIndex } from '@/modules/video/api/video.service'
import type { VideoPlayer } from '@/modules/video/hooks/useVideoPlayer'
import { frameToTimeSec } from '@/modules/video/frameIndex'
import { useTimelineViewport } from '@/modules/video/hooks/useTimelineViewport'
import { useTimelineSelection } from '@/modules/video/hooks/useTimelineSelection'
import type { TimelineTrack } from '@/modules/video/timeline/timeline.types'
import type { EventTimelineRow } from '@/modules/video/events/eventTimeline'
import type { EventDefinition } from '@/modules/video/schema/eventStore'
import { TimelineSpanLanes, type SpanLaneRow } from '@/modules/video/components/TimelineSpanLanes'
import { AudioWaveformLane } from '@/modules/video/components/AudioWaveformLane'
import { cn } from '@/utils/cn'

interface Props {
  player: VideoPlayer
  disabled?: boolean
  /** Real object tracks (Phase 10). Falls back to empty when none. */
  tracks?: TimelineTrack[]
  /** Phase 18 event lanes */
  eventRows?: EventTimelineRow[]
  eventDefinitions?: EventDefinition[]
  selectedEventId?: string | null
  intervalDraft?: { eventDefId: string; startFrame: number } | null
  onSelectEvent?: (eventId: string) => void
  onCreateInstantEvent?: (eventDefId: string, frame: number) => void
  onCreateIntervalEvent?: (eventDefId: string, startFrame: number, endFrame: number) => void
  /** Phase 19 action lanes */
  actionSpanRows?: SpanLaneRow[]
  selectedActionId?: string | null
  actionIntervalDraft?: { rowId: string; startFrame: number; endFrame?: number } | null
  onSelectAction?: (actionId: string) => void
  onCreateActionSpan?: (actionDefId: string, startFrame: number, endFrame: number) => void
  /** Phase 20 relation lanes */
  relationSpanRows?: SpanLaneRow[]
  selectedRelationId?: string | null
  relationIntervalDraft?: { rowId: string; startFrame: number; endFrame?: number } | null
  onSelectRelation?: (relationId: string) => void
  onCreateRelationSpan?: (relationDefId: string, startFrame: number, endFrame: number) => void
  /** Phase 23 scene lanes */
  sceneSpanRows?: SpanLaneRow[]
  selectedSceneId?: string | null
  sceneIntervalDraft?: { rowId: string; startFrame: number; endFrame?: number } | null
  onSelectScene?: (sceneId: string) => void
  onCreateSceneSpan?: (rowId: string, startFrame: number, endFrame: number) => void
  onCreateSceneMarker?: (rowId: string, frame: number) => void
  /** Phase 22 audio waveform */
  showAudioLane?: boolean
  audioWaveform?: import('@/modules/video/audio/audioTypes').WaveformData | null
  audioSegments?: import('@/modules/video/audio/audioTypes').AudioSegment[]
  audioTranscriptions?: import('@/modules/video/audio/audioTypes').TranscriptionSpan[]
  selectedAudioSegmentId?: string | null
  audioSegmentDraft?: { startFrame: number; endFrame?: number } | null
  onSelectAudioSegment?: (id: string) => void
  onCreateAudioSegment?: (start: number, end: number) => void
  onSelectTranscription?: (id: string) => void
  selectedObjectId?: string | null
  selectedKeyframeFrame?: number | null
  onSelectTrack?: (objectId: string) => void
  onSelectKeyframe?: (objectId: string, frame: number) => void
  onCreateKeyframe?: (objectId: string, frame: number) => void
  onMoveKeyframe?: (objectId: string, fromFrame: number, toFrame: number) => void
  onDeleteKeyframe?: (objectId: string, frame: number) => void
  onDuplicateKeyframe?: (objectId: string, fromFrame: number, toFrame: number) => void
  onTrackForward?: (objectId: string, fromFrame: number, toFrame: number) => void
  onTrackBackward?: (objectId: string, fromFrame: number, toFrame: number) => void
  onSplitTrack?: (objectId: string, atFrame: number) => void
}

function formatRulerTime(sec: number) {
  if (sec < 60) return `${sec % 1 === 0 ? sec : sec.toFixed(1)}s`
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function pickFrameStep(totalFrames: number, pxPerFrame: number) {
  const minPx = 72
  const candidates = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
  for (const step of candidates) {
    if (step * pxPerFrame >= minPx && step <= totalFrames) return step
  }
  return Math.max(1, Math.ceil(totalFrames / 10))
}

function pickTimeStep(durationSec: number, pxPerFrame: number, fps: number) {
  const frameStep = pickFrameStep(Math.ceil(durationSec * fps), pxPerFrame)
  return frameStep / Math.max(fps, 1)
}

const LABEL_W = 104

export function VideoTimeline({
  player,
  disabled,
  tracks = [],
  eventRows = [],
  eventDefinitions = [],
  selectedEventId,
  intervalDraft,
  onSelectEvent,
  onCreateInstantEvent,
  onCreateIntervalEvent,
  actionSpanRows = [],
  selectedActionId,
  actionIntervalDraft,
  onSelectAction,
  onCreateActionSpan,
  relationSpanRows = [],
  selectedRelationId,
  relationIntervalDraft,
  onSelectRelation,
  onCreateRelationSpan,
  sceneSpanRows = [],
  selectedSceneId,
  sceneIntervalDraft,
  onSelectScene,
  onCreateSceneSpan,
  onCreateSceneMarker,
  showAudioLane,
  audioWaveform,
  audioSegments = [],
  audioTranscriptions = [],
  selectedAudioSegmentId,
  audioSegmentDraft,
  onSelectAudioSegment,
  onCreateAudioSegment,
  onSelectTranscription,
  selectedObjectId,
  selectedKeyframeFrame,
  onSelectTrack,
  onSelectKeyframe,
  onCreateKeyframe,
  onMoveKeyframe,
  onDeleteKeyframe,
  onDuplicateKeyframe,
  onTrackForward,
  onTrackBackward,
  onSplitTrack,
}: Props) {
  const { currentFrame, maxFrame, seekToFrame, index, pause } = player
  const frameIndex: FrameIndex | null = index
  const fps = frameIndex?.fps ?? 30
  const duration =
    frameIndex?.duration_sec ??
    frameToTimeSec(maxFrame, frameIndex ?? { version: '1', frame_count: maxFrame, fps, duration_sec: 0 })

  const viewport = useTimelineViewport(maxFrame)
  const selectionState = useTimelineSelection(frameIndex, maxFrame)
  const { selection, snapToFrame, setSnapToFrame } = selectionState

  const draggingPlayhead = useRef(false)
  const draggingRange = useRef(false)
  const [rangeDragStart, setRangeDragStart] = useState<number | null>(null)
  const kfDrag = useRef<{ objectId: string; fromFrame: number } | null>(null)
  const [kfDragFrame, setKfDragFrame] = useState<number | null>(null)
  const eventDrag = useRef<{ rowId: string; startFrame: number } | null>(null)
  const [eventDragFrame, setEventDragFrame] = useState<number | null>(null)

  const frameStep = pickFrameStep(maxFrame, viewport.pxPerFrame)
  const timeStep = pickTimeStep(duration, viewport.pxPerFrame, fps)

  const frameTicks = useMemo(() => {
    const ticks: number[] = []
    for (let f = 0; f <= maxFrame; f += frameStep) ticks.push(f)
    return ticks
  }, [maxFrame, frameStep])

  const timeTicks = useMemo(() => {
    const ticks: number[] = []
    for (let t = 0; t <= duration + 0.001; t += timeStep) ticks.push(t)
    return ticks
  }, [duration, timeStep])

  const activeTrack = tracks.find((t) => t.id === selectedObjectId) ?? null
  const isKeyframeHere =
    Boolean(selectedObjectId) &&
    Boolean(activeTrack?.keyframes.includes(currentFrame))

  const trackSourceFrame =
    selectedKeyframeFrame ??
    activeTrack?.keyframes.find((f) => f <= currentFrame) ??
    activeTrack?.startFrame ??
    null

  const canTrackForward =
    Boolean(selectedObjectId) &&
    trackSourceFrame != null &&
    currentFrame > trackSourceFrame

  const trackBackSource =
    selectedKeyframeFrame ??
    [...(activeTrack?.keyframes ?? [])].reverse().find((f) => f >= currentFrame) ??
    activeTrack?.endFrame ??
    null

  const canTrackBackward =
    Boolean(selectedObjectId) &&
    trackBackSource != null &&
    currentFrame < trackBackSource

  useEffect(() => {
    if (!draggingPlayhead.current && !kfDrag.current) viewport.scrollToFrame(currentFrame)
  }, [currentFrame, viewport])

  const clientToFrame = useCallback(
    (clientX: number) => {
      const el = viewport.scrollRef.current
      if (!el) return 0
      const rect = el.getBoundingClientRect()
      const raw = viewport.frameAtX(clientX, rect, el.scrollLeft)
      return selectionState.snap(Math.min(maxFrame, Math.max(0, raw)))
    },
    [viewport, selectionState, maxFrame],
  )

  const onRulerPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    pause()
    const frame = clientToFrame(e.clientX)
    if (e.shiftKey) {
      selectionState.beginRange(frame)
      setRangeDragStart(frame)
      draggingRange.current = true
    } else {
      const f = selectionState.selectFrame(frame)
      seekToFrame(f)
      draggingPlayhead.current = true
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onRulerPointerMove = (e: React.PointerEvent) => {
    if (draggingPlayhead.current) {
      const frame = clientToFrame(e.clientX)
      seekToFrame(frame)
      selectionState.selectFrame(frame)
    }
    if (draggingRange.current && rangeDragStart != null) {
      selectionState.extendRange(clientToFrame(e.clientX))
    }
    if (kfDrag.current) {
      setKfDragFrame(clientToFrame(e.clientX))
    }
  }

  const onRulerPointerUp = (e?: React.PointerEvent) => {
    if (kfDrag.current && e) {
      const to = clientToFrame(e.clientX)
      const { objectId, fromFrame } = kfDrag.current
      if (to !== fromFrame) onMoveKeyframe?.(objectId, fromFrame, to)
      seekToFrame(to)
      onSelectKeyframe?.(objectId, to)
    }
    draggingPlayhead.current = false
    draggingRange.current = false
    kfDrag.current = null
    setKfDragFrame(null)
    setRangeDragStart(null)
  }

  const playheadX = viewport.xAtFrame(currentFrame)

  const selectedKf =
    selectedObjectId && selectedKeyframeFrame != null
      ? { objectId: selectedObjectId, frame: selectedKeyframeFrame }
      : null

  return (
    <div className="shrink-0 border-t border-border bg-white flex flex-col select-none">
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/60 bg-muted/20">
        <span className="text-2xs font-semibold text-muted-foreground mr-2">Timeline</span>
        <button
          type="button"
          disabled={disabled}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40"
          title="Zoom out"
          onClick={() => viewport.zoomTimeline(1 / 1.25, currentFrame)}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40"
          title="Fit timeline"
          onClick={viewport.fitTimeline}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent disabled:opacity-40"
          title="Zoom in"
          onClick={() => viewport.zoomTimeline(1.25, currentFrame)}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'h-7 px-2 text-2xs rounded inline-flex items-center gap-1',
            snapToFrame ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
          )}
          title="Frame snapping"
          onClick={() => setSnapToFrame((v) => !v)}
        >
          <Magnet className="w-3 h-3" /> Snap
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        <button
          type="button"
          disabled={disabled || !selectedObjectId}
          className="h-7 px-2 text-2xs rounded inline-flex items-center gap-1 hover:bg-accent disabled:opacity-40"
          title="Add keyframe at playhead (K)"
          onClick={() => {
            if (!selectedObjectId) return
            onCreateKeyframe?.(selectedObjectId, currentFrame)
            seekToFrame(currentFrame)
          }}
        >
          <Diamond className="w-3 h-3" /> Keyframe
        </button>
        <button
          type="button"
          disabled={disabled || !selectedKf}
          className="h-7 px-2 text-2xs rounded inline-flex items-center gap-1 hover:bg-accent disabled:opacity-40"
          title="Duplicate keyframe to playhead"
          onClick={() => {
            if (!selectedKf) return
            onDuplicateKeyframe?.(selectedKf.objectId, selectedKf.frame, currentFrame)
          }}
        >
          <Copy className="w-3 h-3" /> Duplicate
        </button>
        <button
          type="button"
          disabled={disabled || !selectedKf}
          className="h-7 px-2 text-2xs rounded inline-flex items-center gap-1 text-destructive hover:bg-accent disabled:opacity-40"
          title="Delete keyframe"
          onClick={() => {
            if (!selectedKf) return
            onDeleteKeyframe?.(selectedKf.objectId, selectedKf.frame)
          }}
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>

        <button
          type="button"
          disabled={disabled || !canTrackForward}
          className="h-7 px-2 text-2xs rounded inline-flex items-center gap-1 hover:bg-accent disabled:opacity-40"
          title="Track forward to playhead (copy pose from earlier keyframe)"
          onClick={() => {
            if (!selectedObjectId || trackSourceFrame == null) return
            onTrackForward?.(selectedObjectId, trackSourceFrame, currentFrame)
            seekToFrame(currentFrame)
          }}
        >
          <ArrowRight className="w-3 h-3" /> Track →
        </button>
        <button
          type="button"
          disabled={disabled || !canTrackBackward}
          className="h-7 px-2 text-2xs rounded inline-flex items-center gap-1 hover:bg-accent disabled:opacity-40"
          title="Track backward to playhead"
          onClick={() => {
            if (!selectedObjectId || trackBackSource == null) return
            onTrackBackward?.(selectedObjectId, trackBackSource, currentFrame)
            seekToFrame(currentFrame)
          }}
        >
          <ArrowLeft className="w-3 h-3" /> Track ←
        </button>
        <button
          type="button"
          disabled={disabled || !selectedObjectId}
          className="h-7 px-2 text-2xs rounded inline-flex items-center gap-1 hover:bg-accent disabled:opacity-40"
          title="Split track at playhead"
          onClick={() => {
            if (!selectedObjectId) return
            onSplitTrack?.(selectedObjectId, currentFrame)
          }}
        >
          <Split className="w-3 h-3" /> Split
        </button>

        <span className="text-2xs font-mono tabular-nums text-muted-foreground ml-auto flex items-center gap-2">
          {isKeyframeHere && (
            <span className="text-primary font-semibold">
              Frame {currentFrame} ●
            </span>
          )}
          {!isKeyframeHere && <span>Frame {currentFrame}</span>}
          <span className="text-muted-foreground/70">
            {Math.round(viewport.pxPerFrame * 100) / 100} px/f
          </span>
        </span>
      </div>

      <div
        ref={viewport.scrollRef}
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight: 220 }}
        onPointerMove={(e) => {
          if (draggingPlayhead.current || draggingRange.current || kfDrag.current) onRulerPointerMove(e)
        }}
        onPointerUp={(e) => onRulerPointerUp(e)}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            viewport.zoomTimeline(e.deltaY > 0 ? 1 / 1.1 : 1.1, currentFrame)
          }
        }}
      >
        <div className="relative min-h-[120px]" style={{ width: viewport.contentWidth, minWidth: '100%' }}>
          <div
            className="relative h-7 border-b border-border/80 bg-muted/30 cursor-pointer"
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={(e) => onRulerPointerUp(e)}
            onPointerLeave={() => {
              if (!kfDrag.current) onRulerPointerUp()
            }}
          >
            <span
              className="sticky left-0 z-20 h-full flex items-center pl-1 text-2xs font-semibold text-muted-foreground bg-muted/90 border-r border-border/50"
              style={{ width: LABEL_W }}
            >
              Frames
            </span>
            {frameTicks.map((f) => (
              <div
                key={f}
                className="absolute top-0 bottom-0 border-l border-border/50"
                style={{ left: viewport.xAtFrame(f) }}
              >
                <span className="absolute top-3 left-0.5 text-2xs font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                  {f}
                </span>
              </div>
            ))}
          </div>

          <div
            className="relative h-7 border-b border-border bg-muted/10 cursor-pointer"
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={(e) => onRulerPointerUp(e)}
          >
            <span
              className="sticky left-0 z-20 h-full flex items-center pl-1 text-2xs font-semibold text-muted-foreground bg-white/95 border-r border-border/50"
              style={{ width: LABEL_W }}
            >
              Time
            </span>
            {timeTicks.map((t) => {
              const f = Math.round(t * fps)
              return (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 border-l border-border/40"
                  style={{ left: viewport.xAtFrame(f) }}
                >
                  <span className="absolute top-3 left-0.5 text-2xs font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatRulerTime(t)}
                  </span>
                </div>
              )
            })}
          </div>

          {selection.range && (
            <div
              className="absolute top-14 bottom-0 bg-primary/10 border-x border-primary/30 pointer-events-none z-[5]"
              style={{
                left: viewport.xAtFrame(selection.range.startFrame),
                width: viewport.xAtFrame(selection.range.endFrame) - viewport.xAtFrame(selection.range.startFrame),
              }}
            />
          )}

          <div className="relative">
            {!tracks.length && (
              <div className="h-10 flex items-center text-2xs text-muted-foreground px-2 border-b border-border/40">
                <span style={{ width: LABEL_W }} className="shrink-0" />
                Draw objects to see keyframe tracks
              </div>
            )}
            {tracks.map((track) => {
              const selected = selectedObjectId === track.id
              const lineLeft = track.keyframes.length
                ? viewport.xAtFrame(track.keyframes[0])
                : 0
              const lineRight = track.keyframes.length
                ? viewport.xAtFrame(track.keyframes[track.keyframes.length - 1])
                : 0
              return (
                <div
                  key={track.id}
                  className={cn(
                    'relative h-9 border-b border-border/40 cursor-pointer',
                    selected && 'bg-sky-50/80',
                  )}
                  onClick={() => {
                    selectionState.selectTrack(track.id)
                    onSelectTrack?.(track.id)
                  }}
                >
                  <span
                    className="sticky left-0 z-20 h-full pl-1.5 pr-1 text-2xs font-mono truncate bg-white/95 border-r border-border/40 flex items-center pointer-events-none"
                    style={{ width: LABEL_W, color: track.color }}
                    title={track.label}
                  >
                    {track.label}
                  </span>
                  {track.startFrame != null && track.endFrame != null && track.endFrame > track.startFrame && (
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm opacity-20 pointer-events-none"
                      style={{
                        left: viewport.xAtFrame(track.startFrame),
                        width: Math.max(0, viewport.xAtFrame(track.endFrame) - viewport.xAtFrame(track.startFrame)),
                        background: track.color,
                      }}
                    />
                  )}
                  {track.keyframes.length > 1 && (
                    <div
                      className="absolute top-1/2 h-px -translate-y-1/2 opacity-40 pointer-events-none"
                      style={{
                        left: lineLeft,
                        width: Math.max(0, lineRight - lineLeft),
                        background: track.color,
                      }}
                    />
                  )}
                  {track.keyframes.map((kf) => {
                    const draggingThis =
                      kfDrag.current?.objectId === track.id && kfDrag.current.fromFrame === kf
                    const displayFrame =
                      draggingThis && kfDragFrame != null ? kfDragFrame : kf
                    const isSel =
                      selectedObjectId === track.id && selectedKeyframeFrame === kf
                    return (
                      <button
                        key={`${track.id}-${kf}`}
                        type="button"
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 border-2 z-10 cursor-ew-resize',
                          isSel ? 'bg-primary border-primary scale-110' : 'bg-white border-current',
                        )}
                        style={{
                          left: viewport.xAtFrame(displayFrame),
                          borderColor: track.color,
                          color: track.color,
                        }}
                        title={`Frame ${kf} ●`}
                        onPointerDown={(e) => {
                          if (disabled) return
                          e.stopPropagation()
                          e.preventDefault()
                          pause()
                          kfDrag.current = { objectId: track.id, fromFrame: kf }
                          setKfDragFrame(kf)
                          onSelectKeyframe?.(track.id, kf)
                          seekToFrame(kf)
                          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                        }}
                        onPointerMove={(e) => {
                          if (!kfDrag.current) return
                          setKfDragFrame(clientToFrame(e.clientX))
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation()
                          onRulerPointerUp(e)
                        }}
                      />
                    )
                  })}
                  {track.keyframes.map((kf) => (
                    <span
                      key={`${track.id}-lbl-${kf}`}
                      className="absolute bottom-0 -translate-x-1/2 text-[9px] font-mono tabular-nums text-muted-foreground pointer-events-none z-[5]"
                      style={{ left: viewport.xAtFrame(kf) }}
                    >
                      {kf}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>

          {eventRows.length > 0 && (
            <div className="relative border-t-2 border-border/80 bg-violet-50/30">
              {eventRows.map((row) => {
                const def = eventDefinitions.find((d) => d.id === row.id)
                const canInterval = def?.kind === 'interval' || def?.kind === 'both'
                const canInstant = def?.kind === 'instant' || def?.kind === 'both'
                const draftActive = intervalDraft?.eventDefId === row.id
                return (
                  <div
                    key={row.id}
                    className="relative h-8 border-b border-border/40"
                    onPointerDown={(e) => {
                      if (disabled || !canInterval) return
                      const frame = clientToFrame(e.clientX)
                      if (frame < 0) return
                      eventDrag.current = { rowId: row.id, startFrame: frame }
                      setEventDragFrame(frame)
                      pause()
                      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                    }}
                    onPointerMove={(e) => {
                      if (!eventDrag.current || eventDrag.current.rowId !== row.id) return
                      setEventDragFrame(clientToFrame(e.clientX))
                    }}
                    onPointerUp={(e) => {
                      if (!eventDrag.current || eventDrag.current.rowId !== row.id) return
                      const end = clientToFrame(e.clientX)
                      const start = eventDrag.current.startFrame
                      eventDrag.current = null
                      setEventDragFrame(null)
                      if (Math.abs(end - start) >= 1) {
                        onCreateIntervalEvent?.(row.id, start, end)
                      } else if (canInstant) {
                        onCreateInstantEvent?.(row.id, start)
                      }
                      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                    }}
                    onDoubleClick={(e) => {
                      if (disabled || !canInstant) return
                      const frame = clientToFrame(e.clientX)
                      if (frame >= 0) onCreateInstantEvent?.(row.id, frame)
                    }}
                  >
                    <span
                      className="sticky left-0 z-20 h-full pl-1.5 pr-1 text-2xs truncate bg-white/95 border-r border-border/40 flex items-center pointer-events-none"
                      style={{ width: LABEL_W, color: row.color }}
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    {draftActive && intervalDraft && (
                      <div
                        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm border border-dashed border-violet-500 bg-violet-200/50 pointer-events-none"
                        style={{
                          left: viewport.xAtFrame(intervalDraft.startFrame),
                          width: Math.max(
                            4,
                            viewport.xAtFrame(currentFrame) - viewport.xAtFrame(intervalDraft.startFrame),
                          ),
                        }}
                      />
                    )}
                    {eventDrag.current?.rowId === row.id &&
                      eventDragFrame != null &&
                      eventDrag.current && (
                        <div
                          className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm opacity-50 pointer-events-none"
                          style={{
                            left: viewport.xAtFrame(Math.min(eventDrag.current.startFrame, eventDragFrame)),
                            width: Math.max(
                              4,
                              Math.abs(viewport.xAtFrame(eventDragFrame) - viewport.xAtFrame(eventDrag.current.startFrame)),
                            ),
                            background: row.color,
                          }}
                        />
                      )}
                    {row.events.map((ev) => {
                      if (ev.kind === 'interval') {
                        const end = ev.end_frame ?? ev.frame
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            className={cn(
                              'absolute top-1/2 h-3 -translate-y-1/2 rounded-sm z-10 hover:brightness-110',
                              selectedEventId === ev.id && 'ring-2 ring-violet-600 ring-offset-1',
                            )}
                            style={{
                              left: viewport.xAtFrame(ev.frame),
                              width: Math.max(4, viewport.xAtFrame(end) - viewport.xAtFrame(ev.frame)),
                              background: ev.color,
                              opacity: 0.75,
                            }}
                            title={`${ev.label} f${ev.frame + 1}–${end + 1}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectEvent?.(ev.id)
                              seekToFrame(ev.frame)
                            }}
                          />
                        )
                      }
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          className={cn(
                            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-2 z-10',
                            selectedEventId === ev.id ? 'scale-125 ring-2 ring-violet-600' : '',
                          )}
                          style={{
                            left: viewport.xAtFrame(ev.frame),
                            background: ev.color,
                            borderColor: ev.color,
                          }}
                          title={`${ev.label} f${ev.frame + 1}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent?.(ev.id)
                            seekToFrame(ev.frame)
                          }}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          <TimelineSpanLanes
            rows={actionSpanRows}
            viewport={viewport}
            labelWidth={LABEL_W}
            sectionClass="bg-amber-50/30"
            selectedId={selectedActionId}
            disabled={disabled}
            draft={actionIntervalDraft}
            onSelect={(id) => {
              onSelectAction?.(id)
              const item = actionSpanRows.flatMap((r) => r.items).find((i) => i.id === id)
              if (item) seekToFrame(item.frame)
            }}
            onDragCreate={(rowId, start, end) => onCreateActionSpan?.(rowId, start, end)}
          />

          <TimelineSpanLanes
            rows={relationSpanRows}
            viewport={viewport}
            labelWidth={LABEL_W}
            sectionClass="bg-teal-50/30"
            selectedId={selectedRelationId}
            disabled={disabled}
            draft={relationIntervalDraft}
            onSelect={(id) => {
              onSelectRelation?.(id)
              const item = relationSpanRows.flatMap((r) => r.items).find((i) => i.id === id)
              if (item) seekToFrame(item.frame)
            }}
            onDragCreate={(rowId, start, end) => onCreateRelationSpan?.(rowId, start, end)}
          />

          <TimelineSpanLanes
            rows={sceneSpanRows}
            viewport={viewport}
            labelWidth={LABEL_W}
            sectionClass="bg-slate-100/50"
            selectedId={selectedSceneId}
            disabled={disabled}
            draft={sceneIntervalDraft}
            onSelect={(id) => {
              onSelectScene?.(id)
              const item = sceneSpanRows.flatMap((r) => r.items).find((i) => i.id === id)
              if (item) seekToFrame(item.frame)
            }}
            onDragCreate={(rowId, start, end) => {
              if (rowId === 'scene') onCreateSceneSpan?.(rowId, start, end)
              else if (Math.abs(end - start) < 1) onCreateSceneMarker?.(rowId, start)
              else onCreateSceneSpan?.(rowId, start, end)
            }}
          />

          {showAudioLane && (
            <AudioWaveformLane
              waveform={audioWaveform ?? null}
              viewport={{ xAtFrame: viewport.xAtFrame, pxPerFrame: viewport.pxPerFrame }}
              labelWidth={LABEL_W}
              maxFrame={maxFrame}
              currentFrame={currentFrame}
              disabled={disabled}
              segments={audioSegments}
              transcriptions={audioTranscriptions}
              selectedSegmentId={selectedAudioSegmentId}
              segmentDraft={audioSegmentDraft}
              onSeek={seekToFrame}
              onSelectSegment={onSelectAudioSegment}
              onCreateSegment={onCreateAudioSegment}
              onSelectTranscription={onSelectTranscription}
            />
          )}

          <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: playheadX }}>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 -translate-x-1/2 pointer-events-auto cursor-ew-resize"
              onPointerDown={(e) => {
                if (disabled) return
                e.stopPropagation()
                pause()
                draggingPlayhead.current = true
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              }}
            />
            <div className="absolute top-0 -translate-x-1/2 flex flex-col items-center pointer-events-none">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 py-1 text-2xs text-muted-foreground border-t border-border/60 flex gap-3 flex-wrap">
        {selectedObjectId && <span className="font-mono text-foreground">{selectedObjectId}</span>}
        {selectedKeyframeFrame != null && (
          <span>
            Keyframe ● {selectedKeyframeFrame}
          </span>
        )}
        {isKeyframeHere && <span className="text-primary">Playhead on keyframe</span>}
        <span className="text-muted-foreground/70">
          Track → / ← extend · Split at playhead · Events: drag span · dbl-click instant
        </span>
      </div>
    </div>
  )
}
