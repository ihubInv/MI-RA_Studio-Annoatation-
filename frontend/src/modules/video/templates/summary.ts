import { isTemplateToolId, type TemplateToolId } from './catalog'
import type { VideoTemplateDocument } from './document'
import type { VideoTemplateRecord } from './types'

function asDocument(record: VideoTemplateRecord): VideoTemplateDocument {
  if (record.document) return record.document
  return {
    template: {
      name: record.name,
      version: String(record.version ?? '1.0'),
      description: record.description ?? undefined,
      status: record.status === 'active' || record.status === 'archived' ? record.status : 'draft',
    },
    tools: record.tools,
    labels: record.labels,
    events: record.events,
    actions: record.actions,
    relations: record.relations,
    timeline: record.timeline,
    ai: record.ai,
    export: record.export,
  }
}

export function creatorLabel(record: VideoTemplateRecord): string {
  const by = record.created_by
  if (!by) return '—'
  if (typeof by === 'string') return by
  return by.username || by.email || '—'
}

export function formatTemplateDate(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString()
}

export function previewSections(record: VideoTemplateRecord) {
  const doc = asDocument(record)
  const enabledTools = (Object.entries(doc.tools ?? {}) as [string, { enabled?: boolean }][])
    .filter(([, config]) => config?.enabled)
    .map(([id]) => id)
    .filter(isTemplateToolId) as TemplateToolId[]

  const labels = (doc.labels ?? []).filter((l) => !l.type || l.type === 'object')
  const events =
    doc.events ??
    (doc.labels ?? [])
      .filter((l) => l.type === 'event')
      .map((l) => ({ id: l.id, name: l.name, color: l.color }))
  const actions =
    doc.actions ??
    (doc.labels ?? [])
      .filter((l) => l.type === 'action')
      .map((l) => ({ id: l.id, name: l.name, color: l.color }))
  const relations =
    doc.relations ??
    (doc.labels ?? [])
      .filter((l) => l.type === 'relation')
      .map((l) => ({ id: l.id, name: l.name, color: l.color, directional: true as const, source_label: undefined as string | undefined, target_label: undefined as string | undefined }))

  return {
    doc,
    enabledTools,
    labels,
    events,
    actions,
    relations,
    ai: doc.ai ?? { enabled: false },
    exportFormats: doc.export?.formats ?? ['json'],
  }
}
