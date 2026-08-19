import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { buildEventTimelineRows, type EventTimelineRow } from '@/modules/video/events/eventTimeline'
import { newEventId, normalizeEvent, type VideoEvent, type VideoEventKind } from '@/modules/video/events/eventTypes'
import type { EventDefinition } from '@/modules/video/schema/eventStore'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function useVideoEvents(itemId: string | undefined) {
  const [events, setEvents] = useState<VideoEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [activeEventDefId, setActiveEventDefId] = useState<string | null>(null)
  const [intervalDraft, setIntervalDraft] = useState<{ eventDefId: string; startFrame: number } | null>(null)

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setEvents(store.events ?? [])
    setSelectedEventId(null)
    setIntervalDraft(null)
  }, [itemId])

  const persistEvents = useCallback(
    (next: VideoEvent[]) => {
      if (!itemId) return
      const store = loadAnnotationStore(itemId)
      saveAnnotationStore(itemId, { ...store, events: next })
    },
    [itemId],
  )

  useEffect(() => {
    if (itemId) persistEvents(events)
  }, [itemId, events, persistEvents])

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  )

  const timelineRows = useCallback(
    (definitions: EventDefinition[]): EventTimelineRow[] => buildEventTimelineRows(events, definitions),
    [events],
  )

  const addInstantEvent = useCallback(
    (def: EventDefinition, frame: number, attributes?: Record<string, unknown>) => {
      const ev: VideoEvent = {
        id: newEventId(),
        label: def.name,
        color: def.color,
        kind: 'instant',
        frame,
        event_def_id: def.id,
        attributes: attributes ?? {},
        visible: true,
        locked: false,
      }
      setEvents((prev) => [...prev, ev])
      setSelectedEventId(ev.id)
      return ev.id
    },
    [],
  )

  const addIntervalEvent = useCallback(
    (
      def: EventDefinition,
      startFrame: number,
      endFrame: number,
      attributes?: Record<string, unknown>,
    ) => {
      const start = Math.min(startFrame, endFrame)
      const end = Math.max(startFrame, endFrame)
      const ev: VideoEvent = {
        id: newEventId(),
        label: def.name,
        color: def.color,
        kind: 'interval',
        frame: start,
        end_frame: end,
        event_def_id: def.id,
        attributes: attributes ?? {},
        visible: true,
        locked: false,
      }
      setEvents((prev) => [...prev, ev])
      setSelectedEventId(ev.id)
      setIntervalDraft(null)
      return ev.id
    },
    [],
  )

  const beginInterval = useCallback((eventDefId: string, startFrame: number) => {
    setIntervalDraft({ eventDefId, startFrame })
    setActiveEventDefId(eventDefId)
  }, [])

  const cancelIntervalDraft = useCallback(() => setIntervalDraft(null), [])

  const updateEvent = useCallback((id: string, patch: Partial<VideoEvent>) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        const next = { ...e, ...patch }
        if (next.kind === 'instant') delete next.end_frame
        if (next.kind === 'interval' && next.end_frame != null && next.end_frame < next.frame) {
          next.end_frame = next.frame
        }
        return next
      }),
    )
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setSelectedEventId((cur) => (cur === id ? null : cur))
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedEventId) return
    deleteEvent(selectedEventId)
  }, [selectedEventId, deleteEvent])

  const selectEvent = useCallback((id: string | null) => setSelectedEventId(id), [])

  const moveEvent = useCallback((id: string, newStart: number, newEnd?: number) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        if (e.kind === 'instant') return { ...e, frame: newStart }
        const end = newEnd ?? e.end_frame ?? e.frame
        const start = Math.min(newStart, end)
        const endFrame = Math.max(newStart, end)
        return { ...e, frame: start, end_frame: endFrame }
      }),
    )
  }, [])

  const resizeInterval = useCallback((id: string, start: number, end: number) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id || e.kind !== 'interval') return e
        return { ...e, frame: Math.min(start, end), end_frame: Math.max(start, end) }
      }),
    )
  }, [])

  return {
    events,
    selectedEventId,
    selectedEvent,
    activeEventDefId,
    setActiveEventDefId,
    intervalDraft,
    timelineRows,
    addInstantEvent,
    addIntervalEvent,
    beginInterval,
    cancelIntervalDraft,
    updateEvent,
    deleteEvent,
    deleteSelected,
    selectEvent,
    moveEvent,
    resizeInterval,
  }
}

export type VideoEventsApi = ReturnType<typeof useVideoEvents>

export { normalizeEvent, type VideoEvent, type VideoEventKind }
