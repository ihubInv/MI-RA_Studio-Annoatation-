import {
  NAVIGATION_ENGINE_TOOLS,
  TEMPLATE_ATTRIBUTE_TYPES,
  TEMPLATE_EXPORT_FORMATS,
  TEMPLATE_LABEL_TYPES,
  TEMPLATE_TIMELINE_TRACKS,
  TEMPLATE_TOOL_IDS,
  TEMPLATE_UI_PANELS,
  UNIMPLEMENTED_TEMPLATE_TOOLS,
  isTemplateToolId,
} from './catalog'
import type {
  TemplateAiConfig,
  TemplateAttributeDef,
  TemplateDocumentIssue,
  TemplateDocumentValidation,
  TemplateExportConfig,
  TemplateLabelDef,
  TemplateTimelineConfig,
  TemplateToolConfig,
  TemplateUiConfig,
  TemplateValidationConfig,
  VideoTemplateDocument,
} from './document'

const COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function err(errors: TemplateDocumentIssue[], path: string, code: string, message: string) {
  errors.push({ path, code, message })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asStringArray(value: unknown, path: string, errors: TemplateDocumentIssue[]): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    err(errors, path, 'type', 'Expected an array of strings')
    return undefined
  }
  return value as string[]
}

function validateToolConfig(value: unknown, path: string, errors: TemplateDocumentIssue[]) {
  if (!isObject(value)) {
    err(errors, path, 'type', 'Tool config must be an object')
    return
  }
  if (typeof value.enabled !== 'boolean') {
    err(errors, `${path}.enabled`, 'required', '`enabled` must be a boolean')
  }
  for (const key of ['visible', 'required', 'interpolation'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      err(errors, `${path}.${key}`, 'type', `\`${key}\` must be a boolean`)
    }
  }
  if (value.hotkey !== undefined && typeof value.hotkey !== 'string') {
    err(errors, `${path}.hotkey`, 'type', '`hotkey` must be a string')
  }
  if (value.min_points !== undefined && (!Number.isInteger(value.min_points) || (value.min_points as number) < 1)) {
    err(errors, `${path}.min_points`, 'type', '`min_points` must be a positive integer')
  }
  if (value.max_points !== undefined && (!Number.isInteger(value.max_points) || (value.max_points as number) < 1)) {
    err(errors, `${path}.max_points`, 'type', '`max_points` must be a positive integer')
  }
  if (value.options !== undefined && !isObject(value.options)) {
    err(errors, `${path}.options`, 'type', '`options` must be an object')
  }
  const allowed = new Set(['enabled', 'visible', 'required', 'hotkey', 'interpolation', 'min_points', 'max_points', 'options'])
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) err(errors, `${path}.${key}`, 'unknown', `Unknown tool property “${key}”`)
  }
}

function validateLabel(value: unknown, path: string, errors: TemplateDocumentIssue[], attrIds: Set<string>) {
  if (!isObject(value)) {
    err(errors, path, 'type', 'Label must be an object')
    return
  }
  if (typeof value.id !== 'string' || !value.id) err(errors, `${path}.id`, 'required', 'Label id is required')
  if (typeof value.name !== 'string' || !value.name) err(errors, `${path}.name`, 'required', 'Label name is required')
  if (typeof value.color !== 'string' || !COLOR.test(value.color)) {
    err(errors, `${path}.color`, 'format', 'Label color must be #RGB or #RRGGBB')
  }
  if (value.type !== undefined && !(TEMPLATE_LABEL_TYPES as readonly string[]).includes(value.type as string)) {
    err(errors, `${path}.type`, 'enum', `Invalid label type “${String(value.type)}”`)
  }
  const tools = asStringArray(value.allowed_tools, `${path}.allowed_tools`, errors)
  for (const tool of tools ?? []) {
    if (!isTemplateToolId(tool)) err(errors, `${path}.allowed_tools`, 'enum', `Unknown tool “${tool}”`)
  }
  const attrs = asStringArray(value.attributes, `${path}.attributes`, errors)
  for (const id of attrs ?? []) {
    if (attrIds.size && !attrIds.has(id)) {
      err(errors, `${path}.attributes`, 'ref', `Attribute “${id}” is not defined in attributes[]`)
    }
  }
}

function validateAttribute(value: unknown, path: string, errors: TemplateDocumentIssue[]) {
  if (!isObject(value)) {
    err(errors, path, 'type', 'Attribute must be an object')
    return
  }
  if (typeof value.id !== 'string' || !value.id) err(errors, `${path}.id`, 'required', 'Attribute id is required')
  if (typeof value.name !== 'string' || !value.name) err(errors, `${path}.name`, 'required', 'Attribute name is required')
  if (!(TEMPLATE_ATTRIBUTE_TYPES as readonly string[]).includes(value.type as string)) {
    err(errors, `${path}.type`, 'enum', 'Attribute type must be boolean, number, text, select, or multiselect')
  }
  if ((value.type === 'select' || value.type === 'multiselect') && (!Array.isArray(value.options) || value.options.length === 0)) {
    err(errors, `${path}.options`, 'required', 'select/multiselect attributes need a non-empty options list')
  }
  asStringArray(value.applicable_to, `${path}.applicable_to`, errors)
}

/**
 * Validate an owner-authored template document. Does not touch classic studio state.
 */
export function validateTemplateDocument(input: unknown): TemplateDocumentValidation {
  const errors: TemplateDocumentIssue[] = []
  const warnings: TemplateDocumentValidation['warnings'] = []

  if (!isObject(input)) {
    return { ok: false, errors: [{ path: '', code: 'type', message: 'Template document must be an object' }], warnings }
  }

  const extraRoot = Object.keys(input).filter(
    (key) => !['template', 'tools', 'labels', 'attributes', 'timeline', 'ai', 'validation', 'ui', 'export'].includes(key),
  )
  for (const key of extraRoot) err(errors, key, 'unknown', `Unknown top-level property “${key}”`)

  if (!isObject(input.template)) {
    err(errors, 'template', 'required', '`template` with name and version is required')
  } else {
    if (typeof input.template.name !== 'string' || !input.template.name) {
      err(errors, 'template.name', 'required', 'Template name is required')
    }
    if (typeof input.template.version !== 'string' || !input.template.version) {
      err(errors, 'template.version', 'required', 'Template version is required')
    }
    if (input.template.status !== undefined && !['draft', 'active', 'archived'].includes(input.template.status as string)) {
      err(errors, 'template.status', 'enum', 'status must be draft, active, or archived')
    }
  }

  const attributes = Array.isArray(input.attributes) ? input.attributes : []
  const attrIds = new Set<string>()
  if (input.attributes !== undefined) {
    if (!Array.isArray(input.attributes)) err(errors, 'attributes', 'type', '`attributes` must be an array')
    else {
      attributes.forEach((item, i) => {
        validateAttribute(item, `attributes[${i}]`, errors)
        if (isObject(item) && typeof item.id === 'string') {
          if (attrIds.has(item.id)) err(errors, `attributes[${i}].id`, 'duplicate', `Duplicate attribute id “${item.id}”`)
          attrIds.add(item.id)
        }
      })
    }
  }

  if (input.labels !== undefined) {
    if (!Array.isArray(input.labels)) err(errors, 'labels', 'type', '`labels` must be an array')
    else {
      const ids = new Set<string>()
      input.labels.forEach((item, i) => {
        validateLabel(item, `labels[${i}]`, errors, attrIds)
        if (isObject(item) && typeof item.id === 'string') {
          if (ids.has(item.id)) err(errors, `labels[${i}].id`, 'duplicate', `Duplicate label id “${item.id}”`)
          ids.add(item.id)
        }
      })
    }
  }

  if (input.tools !== undefined) {
    if (!isObject(input.tools)) err(errors, 'tools', 'type', '`tools` must be an object')
    else {
      for (const [key, config] of Object.entries(input.tools)) {
        if (!isTemplateToolId(key)) err(errors, `tools.${key}`, 'enum', `Unknown tool “${key}”`)
        else {
          validateToolConfig(config, `tools.${key}`, errors)
          if (UNIMPLEMENTED_TEMPLATE_TOOLS.includes(key) && isObject(config) && config.enabled === true) {
            warnings.push({
              path: `tools.${key}`,
              code: 'unimplemented',
              message: `“${key}” is configurable but not yet implemented in the video engine; it will be ignored at runtime`,
            })
          }
        }
      }
    }
  }

  if (input.timeline !== undefined) {
    if (!isObject(input.timeline)) err(errors, 'timeline', 'type', '`timeline` must be an object')
    else {
      for (const key of Object.keys(input.timeline)) {
        if (!(TEMPLATE_TIMELINE_TRACKS as readonly string[]).includes(key)) {
          err(errors, `timeline.${key}`, 'unknown', `Unknown timeline track “${key}”`)
        } else if (typeof input.timeline[key] !== 'boolean') {
          err(errors, `timeline.${key}`, 'type', 'Timeline track flags must be booleans')
        }
      }
    }
  }

  if (input.ai !== undefined) {
    if (!isObject(input.ai)) err(errors, 'ai', 'type', '`ai` must be an object')
    else {
      for (const key of Object.keys(input.ai)) {
        if (!['enabled', 'detect', 'segment', 'pose', 'track', 'smart_analysis'].includes(key)) {
          err(errors, `ai.${key}`, 'unknown', `Unknown AI property “${key}”`)
        } else if (typeof input.ai[key] !== 'boolean') {
          err(errors, `ai.${key}`, 'type', 'AI flags must be booleans')
        }
      }
    }
  }

  if (input.validation !== undefined) {
    if (!isObject(input.validation)) err(errors, 'validation', 'type', '`validation` must be an object')
    else {
      asStringArray(input.validation.required_fields, 'validation.required_fields', errors)
      const tools = asStringArray(input.validation.required_tools, 'validation.required_tools', errors)
      for (const tool of tools ?? []) {
        if (!isTemplateToolId(tool)) err(errors, 'validation.required_tools', 'enum', `Unknown tool “${tool}”`)
      }
      if (input.validation.min_objects !== undefined && (!Number.isInteger(input.validation.min_objects) || (input.validation.min_objects as number) < 0)) {
        err(errors, 'validation.min_objects', 'type', '`min_objects` must be a non-negative integer')
      }
    }
  }

  if (input.ui !== undefined) {
    if (!isObject(input.ui)) err(errors, 'ui', 'type', '`ui` must be an object')
    else {
      for (const key of Object.keys(input.ui)) {
        if (!(TEMPLATE_UI_PANELS as readonly string[]).includes(key)) {
          err(errors, `ui.${key}`, 'unknown', `Unknown UI panel “${key}”`)
        }
      }
    }
  }

  if (input.export !== undefined) {
    if (!isObject(input.export)) err(errors, 'export', 'type', '`export` must be an object')
    else {
      const formats = asStringArray(input.export.formats, 'export.formats', errors)
      for (const format of formats ?? []) {
        if (!(TEMPLATE_EXPORT_FORMATS as readonly string[]).includes(format)) {
          err(errors, 'export.formats', 'enum', `Unknown export format “${format}”`)
        }
      }
      if (input.export.default_format !== undefined) {
        if (typeof input.export.default_format !== 'string' || !(TEMPLATE_EXPORT_FORMATS as readonly string[]).includes(input.export.default_format)) {
          err(errors, 'export.default_format', 'enum', 'Invalid default_format')
        }
      }
    }
  }

  if (errors.length) return { ok: false, errors, warnings }

  return {
    ok: true,
    errors,
    warnings,
    document: input as unknown as VideoTemplateDocument,
  }
}

export function isAuthoringDocument(value: unknown): value is VideoTemplateDocument {
  return isObject(value) && isObject(value.template) && typeof value.template.name === 'string'
}

export type {
  TemplateAiConfig,
  TemplateAttributeDef,
  TemplateExportConfig,
  TemplateLabelDef,
  TemplateTimelineConfig,
  TemplateToolConfig,
  TemplateUiConfig,
  TemplateValidationConfig,
}
