import type { TemplateExportId, TemplateTimelineTrackId, TemplateToolId } from './catalog'
import type { VideoTemplateDocument } from './document'

export type { TemplateExportId }

export type VideoAnnotationMode = 'classic' | 'custom'

export type VideoTemplateStatus = 'draft' | 'active' | 'archived'

/** API / list-row shape for a saved custom template. */
export interface VideoTemplateRecord {
  id: string
  name: string
  description?: string | null
  version: number
  status: VideoTemplateStatus | string
  created_by?: string | { username?: string; email?: string } | null
  created_at?: string
  updated_at?: string
  document?: VideoTemplateDocument
  tools?: VideoTemplateDocument['tools']
  labels?: VideoTemplateDocument['labels']
  events?: VideoTemplateDocument['events']
  actions?: VideoTemplateDocument['actions']
  relations?: VideoTemplateDocument['relations']
  timeline?: VideoTemplateDocument['timeline']
  ai?: VideoTemplateDocument['ai']
  export?: VideoTemplateDocument['export']
}

export type { TemplateTimelineTrackId, TemplateToolId }
