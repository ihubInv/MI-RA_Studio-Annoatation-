import type {
  TemplateAttributeType,
  TemplateExportId,
  TemplateLabelType,
  TemplateTemporalKind,
  TemplateTimelineTrackId,
  TemplateToolId,
  TemplateUiPanelId,
} from './catalog'

export interface TemplateDocumentIssue {
  path: string
  code: string
  message: string
}

export type TemplateDocumentWarning = TemplateDocumentIssue

export interface TemplateToolConfig {
  enabled: boolean
  visible?: boolean
  required?: boolean
  hotkey?: string
  interpolation?: boolean
  min_points?: number
  max_points?: number
  display_name?: string
  icon?: string
  options?: Record<string, unknown>
}

export interface TemplateLabelDef {
  id: string
  name: string
  color: string
  type?: TemplateLabelType
  description?: string
  allowed_tools?: TemplateToolId[]
  attributes?: string[]
}

export interface TemplateAttributeDef {
  id: string
  name: string
  type: TemplateAttributeType
  options?: string[]
  required?: boolean
  default?: unknown
  applicable_to?: string[]
}

export interface TemplateEventDef {
  id: string
  name: string
  color?: string
  type?: TemplateTemporalKind
  description?: string
}

export interface TemplateActionDef {
  id: string
  name: string
  color?: string
  type?: TemplateTemporalKind
  description?: string
}

export interface TemplateRelationDef {
  id: string
  name: string
  color?: string
  source_label?: string
  target_label?: string
  directional?: boolean
}

export type TemplateTimelineConfig = Partial<Record<TemplateTimelineTrackId, boolean>>

export interface TemplateAiConfig {
  enabled?: boolean
  detect?: boolean
  segment?: boolean
  pose?: boolean
  track?: boolean
  smart_analysis?: boolean
}

export interface TemplateValidationConfig {
  required_fields?: string[]
  required_tools?: TemplateToolId[]
  require_label?: boolean
  min_objects?: number
  max_objects?: number
}

export type TemplateUiConfig = Partial<Record<TemplateUiPanelId, { visible?: boolean; collapsed?: boolean } | boolean>>

export interface TemplateExportConfig {
  formats?: TemplateExportId[]
  default_format?: TemplateExportId
  class_map?: Record<string, string>
}

export interface VideoTemplateDocument {
  template: {
    name: string
    version: string
    description?: string
    status?: 'draft' | 'active' | 'archived'
  }
  tools?: Partial<Record<TemplateToolId, TemplateToolConfig>>
  labels?: TemplateLabelDef[]
  attributes?: TemplateAttributeDef[]
  events?: TemplateEventDef[]
  actions?: TemplateActionDef[]
  relations?: TemplateRelationDef[]
  timeline?: TemplateTimelineConfig
  ai?: TemplateAiConfig
  validation?: TemplateValidationConfig
  ui?: TemplateUiConfig
  export?: TemplateExportConfig
}

export interface TemplateDocumentValidation {
  ok: boolean
  errors: TemplateDocumentIssue[]
  warnings: TemplateDocumentWarning[]
  document?: VideoTemplateDocument
}
