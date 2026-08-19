/** Event type definitions — Phase 18. */

export type EventDefKind = 'instant' | 'interval' | 'both'

export interface EventDefinition {
  id: string
  name: string
  color: string
  kind: EventDefKind
  description?: string
  hotkey?: string
  enabled: boolean
}

export interface VideoEventSchema {
  version: 1
  datasetKey: string
  events: EventDefinition[]
}

const DEFAULT_EVENTS: EventDefinition[] = [
  {
    id: 'walking',
    name: 'Walking',
    color: '#22c55e',
    kind: 'interval',
    hotkey: '4',
    enabled: true,
    description: 'Person walking (temporal span)',
  },
  {
    id: 'running',
    name: 'Running',
    color: '#3b82f6',
    kind: 'interval',
    enabled: true,
    description: 'Person running (temporal span)',
  },
  {
    id: 'falling',
    name: 'Falling',
    color: '#ef4444',
    kind: 'instant',
    hotkey: '5',
    enabled: true,
    description: 'Fall at a single frame',
  },
  {
    id: 'stopped',
    name: 'Stopped',
    color: '#a855f7',
    kind: 'interval',
    enabled: true,
  },
]

function storageKey(datasetKey: string) {
  return `mira.video.event-schema.${datasetKey}`
}

export function loadVideoEventSchema(datasetKey: string): VideoEventSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetKey))
    if (raw) {
      const parsed = JSON.parse(raw) as VideoEventSchema
      if (parsed?.events?.length) return { ...parsed, datasetKey, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return {
    version: 1,
    datasetKey,
    events: DEFAULT_EVENTS.map((e) => ({ ...e })),
  }
}

export function saveVideoEventSchema(schema: VideoEventSchema) {
  localStorage.setItem(storageKey(schema.datasetKey), JSON.stringify(schema))
}

export function newEventDefId() {
  return crypto.randomUUID()
}

export function emptyEventDefinition(): EventDefinition {
  return {
    id: newEventDefId(),
    name: 'New event',
    color: '#6366f1',
    kind: 'both',
    enabled: true,
  }
}

export function colorForEventDef(defs: EventDefinition[], nameOrId: string) {
  return defs.find((d) => d.name === nameOrId || d.id === nameOrId)?.color ?? '#6366f1'
}
