export interface LabelAttribute {
  name: string
  input_type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect'
  values?: string[]
  required?: boolean
}

export interface LabelClass {
  id: string
  name: string
  display_name?: string
  color: string
  category: string
  parent_id?: string | null
  hotkey?: string
  annotation_type?: string
  description?: string
  enabled: boolean
  icon?: string
  attributes: LabelAttribute[]
}

export interface LabelSchema {
  version: 1
  projectKey: string
  classes: LabelClass[]
}

const DEFAULT_CLASSES: LabelClass[] = [
  { id: 'person', name: 'Person', color: '#0d559e', category: 'People', hotkey: '1', enabled: true, annotation_type: 'bbox', attributes: [{ name: 'Occluded', input_type: 'boolean' }, { name: 'Truncated', input_type: 'boolean' }] },
  { id: 'adult', name: 'Adult', color: '#0d559e', category: 'People', parent_id: 'person', enabled: true, annotation_type: 'bbox', attributes: [] },
  { id: 'child', name: 'Child', color: '#1d6fbf', category: 'People', parent_id: 'person', enabled: true, annotation_type: 'bbox', attributes: [] },
  { id: 'car', name: 'Car', color: '#0d559e', category: 'Vehicles', hotkey: '2', enabled: true, annotation_type: 'bbox', attributes: [{ name: 'Direction', input_type: 'select', values: ['Front', 'Rear', 'Left', 'Right'] }] },
  { id: 'bus', name: 'Bus', color: '#165a9e', category: 'Vehicles', enabled: true, annotation_type: 'bbox', attributes: [] },
  { id: 'truck', name: 'Truck', color: '#0a447d', category: 'Vehicles', enabled: true, annotation_type: 'bbox', attributes: [] },
  { id: 'motorcycle', name: 'Motorcycle', color: '#fc6900', category: 'Vehicles', hotkey: '3', enabled: true, annotation_type: 'bbox', attributes: [] },
  { id: 'object', name: 'Object', color: '#0d559e', category: 'Other', hotkey: '4', enabled: true, annotation_type: 'bbox', attributes: [] },
]

function keyFor(projectKey: string) {
  return `mira.label-schema.${projectKey}`
}

export function loadLabelSchema(projectKey: string): LabelSchema {
  try {
    const raw = localStorage.getItem(keyFor(projectKey))
    if (raw) {
      const parsed = JSON.parse(raw) as LabelSchema
      if (parsed?.classes?.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return { version: 1, projectKey, classes: DEFAULT_CLASSES.map((c) => ({ ...c })) }
}

export function saveLabelSchema(schema: LabelSchema) {
  localStorage.setItem(keyFor(schema.projectKey), JSON.stringify(schema))
}

export function exportSchema(schema: LabelSchema, format: 'json' | 'yaml' | 'csv') {
  if (format === 'json') return JSON.stringify(schema, null, 2)
  if (format === 'csv') {
    const header = 'id,name,color,category,parent_id,hotkey,enabled'
    const rows = schema.classes.map((c) =>
      [c.id, c.name, c.color, c.category, c.parent_id ?? '', c.hotkey ?? '', c.enabled].join(','),
    )
    return [header, ...rows].join('\n')
  }
  return schema.classes
    .map((c) => `- id: ${c.id}\n  name: ${c.name}\n  color: ${c.color}\n  category: ${c.category}\n  enabled: ${c.enabled}`)
    .join('\n')
}

export function importSchema(projectKey: string, text: string): LabelSchema {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as LabelSchema
    return { ...parsed, projectKey, version: 1, classes: parsed.classes || [] }
  }
  if (trimmed.includes(',') && trimmed.toLowerCase().includes('name')) {
    const lines = trimmed.split(/\r?\n/).filter(Boolean)
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const classes: LabelClass[] = lines.slice(1).map((line, i) => {
      const cols = line.split(',')
      const get = (name: string) => cols[header.indexOf(name)]?.trim() || ''
      return {
        id: get('id') || `cls-${i}`,
        name: get('name') || `Class ${i + 1}`,
        color: get('color') || '#0d559e',
        category: get('category') || 'Other',
        parent_id: get('parent_id') || null,
        hotkey: get('hotkey') || undefined,
        enabled: get('enabled') !== 'false',
        attributes: [],
      }
    })
    return { version: 1, projectKey, classes }
  }
  throw new Error('Unrecognized schema format')
}

export function colorForClass(classes: LabelClass[], name: string) {
  return classes.find((c) => c.name === name || c.id === name)?.color ?? '#0d559e'
}
