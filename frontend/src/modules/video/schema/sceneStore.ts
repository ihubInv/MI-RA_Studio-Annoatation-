/** Scene type definitions — Phase 23 (user-configurable). */

export type SceneDefKind = 'scene' | 'shot_boundary' | 'camera_cut'

export interface SceneDefinition {
  id: string
  name: string
  color: string
  kind: SceneDefKind
  description?: string
  enabled: boolean
}

export interface VideoSceneSchema {
  version: 1
  datasetKey: string
  scenes: SceneDefinition[]
}

const DEFAULT_SCENES: SceneDefinition[] = [
  { id: 'interior', name: 'Interior', color: '#64748b', kind: 'scene', enabled: true },
  { id: 'exterior', name: 'Exterior', color: '#22c55e', kind: 'scene', enabled: true },
  { id: 'action', name: 'Action', color: '#ef4444', kind: 'scene', enabled: true },
  { id: 'dialogue', name: 'Dialogue', color: '#3b82f6', kind: 'scene', enabled: true },
  { id: 'transition', name: 'Transition', color: '#a855f7', kind: 'scene', enabled: true },
  { id: 'shot_boundary', name: 'Shot boundary', color: '#f59e0b', kind: 'shot_boundary', enabled: true },
  { id: 'camera_cut', name: 'Camera cut', color: '#dc2626', kind: 'camera_cut', enabled: true },
]

function storageKey(datasetKey: string) {
  return `mira.video.scene-schema.${datasetKey}`
}

export function loadVideoSceneSchema(datasetKey: string): VideoSceneSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetKey))
    if (raw) {
      const parsed = JSON.parse(raw) as VideoSceneSchema
      if (parsed?.scenes?.length) return { ...parsed, datasetKey, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, datasetKey, scenes: DEFAULT_SCENES.map((s) => ({ ...s })) }
}

export function saveVideoSceneSchema(schema: VideoSceneSchema) {
  localStorage.setItem(storageKey(schema.datasetKey), JSON.stringify(schema))
}

export function newSceneDefId() {
  return crypto.randomUUID()
}

export function emptySceneDefinition(kind: SceneDefKind = 'scene'): SceneDefinition {
  return {
    id: newSceneDefId(),
    name: kind === 'scene' ? 'Custom scene' : kind === 'shot_boundary' ? 'Shot boundary' : 'Camera cut',
    color: '#64748b',
    kind,
    enabled: true,
  }
}
