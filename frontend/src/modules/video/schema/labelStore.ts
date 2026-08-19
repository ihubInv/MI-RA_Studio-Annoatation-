export type AttributeInputType = 'boolean' | 'number' | 'text' | 'select' | 'multiselect'

export interface LabelAttribute {
  id: string
  name: string
  input_type: AttributeInputType
  values?: string[]
  required?: boolean
}

export interface VideoLabel {
  id: string
  name: string
  color: string
  description?: string
  hotkey?: string
  enabled: boolean
  attributes: LabelAttribute[]
}

export interface VideoLabelSchema {
  version: 1
  datasetKey: string
  labels: VideoLabel[]
}

const DEFAULT_LABELS: VideoLabel[] = [
  {
    id: 'vehicle',
    name: 'Vehicle',
    color: '#0d559e',
    hotkey: '1',
    enabled: true,
    attributes: [
      {
        id: 'color',
        name: 'Color',
        input_type: 'select',
        values: ['White', 'Black', 'Red'],
      },
      {
        id: 'type',
        name: 'Type',
        input_type: 'select',
        values: ['Car', 'Bus', 'Truck'],
      },
    ],
  },
  {
    id: 'person',
    name: 'Person',
    color: '#fc6900',
    hotkey: '2',
    enabled: true,
    attributes: [
      { id: 'occluded', name: 'Occluded', input_type: 'boolean' },
      { id: 'age', name: 'Age', input_type: 'number' },
    ],
  },
  {
    id: 'animal',
    name: 'Animal',
    color: '#0f766e',
    hotkey: '3',
    enabled: true,
    attributes: [
      { id: 'notes', name: 'Notes', input_type: 'text' },
      { id: 'species', name: 'Species', input_type: 'select', values: ['Dog', 'Cat', 'Bird', 'Other'] },
    ],
  },
]

function storageKey(datasetKey: string) {
  return `mira.video.label-schema.${datasetKey}`
}

export function loadVideoLabelSchema(datasetKey: string): VideoLabelSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetKey))
    if (raw) {
      const parsed = JSON.parse(raw) as VideoLabelSchema
      if (parsed?.labels?.length) return { ...parsed, datasetKey, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return {
    version: 1,
    datasetKey,
    labels: DEFAULT_LABELS.map((label) => ({
      ...label,
      attributes: label.attributes.map((a) => ({ ...a, values: a.values ? [...a.values] : undefined })),
    })),
  }
}

export function saveVideoLabelSchema(schema: VideoLabelSchema) {
  localStorage.setItem(storageKey(schema.datasetKey), JSON.stringify(schema))
}

export function colorForLabel(labels: VideoLabel[], name: string) {
  return labels.find((l) => l.name === name || l.id === name)?.color ?? '#0d559e'
}

export function newLabelId() {
  return crypto.randomUUID()
}

export function emptyAttribute(): LabelAttribute {
  return { id: newLabelId(), name: 'New attribute', input_type: 'text' }
}

export function emptyLabel(): VideoLabel {
  return {
    id: newLabelId(),
    name: 'New label',
    color: '#0d559e',
    enabled: true,
    attributes: [],
  }
}

export function moveLabel(labels: VideoLabel[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= labels.length || to >= labels.length) return labels
  const next = [...labels]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
