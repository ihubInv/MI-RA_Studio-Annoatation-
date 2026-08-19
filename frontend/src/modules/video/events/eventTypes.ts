/** Video event annotations — Phase 18. */

export type VideoEventKind = 'instant' | 'interval'

export interface VideoEvent {
  id: string
  /** Event type name, e.g. Walking, Falling */
  label: string
  color: string
  kind: VideoEventKind
  /** Start frame (instant events use this only) */
  frame: number
  /** End frame (interval events only, inclusive) */
  end_frame?: number
  event_def_id?: string
  attributes?: Record<string, unknown>
  visible?: boolean
  locked?: boolean
}

export function newEventId() {
  return crypto.randomUUID()
}

export function normalizeEvent(raw: Record<string, unknown>): VideoEvent | null {
  const kind = raw.kind === 'interval' ? 'interval' : raw.kind === 'instant' ? 'instant' : null
  if (!kind) return null
  const frame = Number(raw.frame)
  if (!Number.isFinite(frame) || frame < 0) return null
  const end_frame = raw.end_frame != null ? Number(raw.end_frame) : undefined
  if (kind === 'interval' && (end_frame == null || !Number.isFinite(end_frame) || end_frame < frame)) {
    return null
  }
  return {
    id: String(raw.id || newEventId()),
    label: String(raw.label || 'Event'),
    color: String(raw.color || '#6366f1'),
    kind,
    frame,
    end_frame: kind === 'interval' ? end_frame : undefined,
    event_def_id: raw.event_def_id != null ? String(raw.event_def_id) : undefined,
    attributes: (raw.attributes as Record<string, unknown>) || {},
    visible: raw.visible !== false,
    locked: Boolean(raw.locked),
  }
}

export function eventSpan(event: VideoEvent): { start: number; end: number } {
  if (event.kind === 'instant') return { start: event.frame, end: event.frame }
  return { start: event.frame, end: event.end_frame ?? event.frame }
}

export function eventsAtFrame(events: VideoEvent[], frame: number): VideoEvent[] {
  return events.filter((e) => {
    if (e.visible === false) return false
    const { start, end } = eventSpan(e)
    return frame >= start && frame <= end
  })
}

export function formatEventRange(event: VideoEvent): string {
  if (event.kind === 'instant') return `f${event.frame + 1}`
  return `f${event.frame + 1}–${(event.end_frame ?? event.frame) + 1}`
}
