import type { VideoEvent } from '@/modules/video/events/eventTypes'
import type { EventDefinition } from '@/modules/video/schema/eventStore'

export interface EventTimelineRow {
  id: string
  label: string
  color: string
  kind: 'instant' | 'interval' | 'mixed'
  events: VideoEvent[]
}

/** Build one timeline row per enabled event definition + orphan events. */
export function buildEventTimelineRows(
  events: VideoEvent[],
  definitions: EventDefinition[],
): EventTimelineRow[] {
  const enabled = definitions.filter((d) => d.enabled)
  const rows: EventTimelineRow[] = enabled.map((def) => ({
    id: def.id,
    label: def.name,
    color: def.color,
    kind: def.kind === 'both' ? 'mixed' : def.kind,
    events: events.filter(
      (e) => e.event_def_id === def.id || (!e.event_def_id && e.label === def.name),
    ),
  }))

  const known = new Set(enabled.flatMap((d) => [d.id, d.name]))
  const orphans = events.filter((e) => !e.event_def_id || !known.has(e.event_def_id))
  const orphanLabels = [...new Set(orphans.map((e) => e.label))]
  for (const label of orphanLabels) {
    if (known.has(label)) continue
    const group = orphans.filter((e) => e.label === label)
    rows.push({
      id: `orphan:${label}`,
      label,
      color: group[0]?.color ?? '#6366f1',
      kind: group.some((e) => e.kind === 'interval') ? 'mixed' : 'instant',
      events: group,
    })
  }

  return rows
}

export function eventsForRow(rowId: string, events: VideoEvent[], definitions: EventDefinition[]) {
  const def = definitions.find((d) => d.id === rowId)
  if (def) {
    return events.filter((e) => e.event_def_id === def.id || (!e.event_def_id && e.label === def.name))
  }
  if (rowId.startsWith('orphan:')) {
    const label = rowId.slice('orphan:'.length)
    return events.filter((e) => e.label === label)
  }
  return []
}
