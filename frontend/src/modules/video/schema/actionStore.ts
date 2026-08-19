/** Action class definitions — Phase 19 (user-configurable). */

export interface ActionDefinition {
  id: string
  name: string
  color: string
  description?: string
  hotkey?: string
  enabled: boolean
}

export interface VideoActionSchema {
  version: 1
  datasetKey: string
  actions: ActionDefinition[]
}

const DEFAULT_ACTIONS: ActionDefinition[] = [
  { id: 'walking', name: 'Walking', color: '#22c55e', enabled: true, hotkey: 'w' },
  { id: 'running', name: 'Running', color: '#3b82f6', enabled: true },
  { id: 'sitting', name: 'Sitting', color: '#8b5cf6', enabled: true },
  { id: 'standing', name: 'Standing', color: '#64748b', enabled: true },
  { id: 'falling', name: 'Falling', color: '#ef4444', enabled: true },
  { id: 'jumping', name: 'Jumping', color: '#f97316', enabled: true },
  { id: 'fighting', name: 'Fighting', color: '#dc2626', enabled: true },
  { id: 'driving', name: 'Driving', color: '#0ea5e9', enabled: true },
]

function storageKey(datasetKey: string) {
  return `mira.video.action-schema.${datasetKey}`
}

export function loadVideoActionSchema(datasetKey: string): VideoActionSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetKey))
    if (raw) {
      const parsed = JSON.parse(raw) as VideoActionSchema
      if (parsed?.actions?.length) return { ...parsed, datasetKey, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, datasetKey, actions: DEFAULT_ACTIONS.map((a) => ({ ...a })) }
}

export function saveVideoActionSchema(schema: VideoActionSchema) {
  localStorage.setItem(storageKey(schema.datasetKey), JSON.stringify(schema))
}

export function newActionDefId() {
  return crypto.randomUUID()
}

export function emptyActionDefinition(): ActionDefinition {
  return { id: newActionDefId(), name: 'Custom action', color: '#f59e0b', enabled: true }
}
