/** Relationship type definitions — Phase 20 (user-configurable). */

export interface RelationDefinition {
  id: string
  name: string
  color: string
  description?: string
  enabled: boolean
}

export interface VideoRelationSchema {
  version: 1
  datasetKey: string
  relations: RelationDefinition[]
}

const DEFAULT_RELATIONS: RelationDefinition[] = [
  { id: 'holding', name: 'Holding', color: '#14b8a6', enabled: true },
  { id: 'driving', name: 'Driving', color: '#0ea5e9', enabled: true },
  { id: 'riding', name: 'Riding', color: '#6366f1', enabled: true },
  { id: 'following', name: 'Following', color: '#22c55e', enabled: true },
  { id: 'near', name: 'Near', color: '#94a3b8', enabled: true },
  { id: 'inside', name: 'Inside', color: '#a855f7', enabled: true },
  { id: 'touching', name: 'Touching', color: '#f59e0b', enabled: true },
  { id: 'looking_at', name: 'Looking at', color: '#ec4899', enabled: true },
  { id: 'talking_to', name: 'Talking to', color: '#3b82f6', enabled: true },
]

function storageKey(datasetKey: string) {
  return `mira.video.relation-schema.${datasetKey}`
}

export function loadVideoRelationSchema(datasetKey: string): VideoRelationSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetKey))
    if (raw) {
      const parsed = JSON.parse(raw) as VideoRelationSchema
      if (parsed?.relations?.length) return { ...parsed, datasetKey, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, datasetKey, relations: DEFAULT_RELATIONS.map((r) => ({ ...r })) }
}

export function saveVideoRelationSchema(schema: VideoRelationSchema) {
  localStorage.setItem(storageKey(schema.datasetKey), JSON.stringify(schema))
}

export function newRelationDefId() {
  return crypto.randomUUID()
}

export function emptyRelationDefinition(): RelationDefinition {
  return { id: newRelationDefId(), name: 'Custom relation', color: '#14b8a6', enabled: true }
}
