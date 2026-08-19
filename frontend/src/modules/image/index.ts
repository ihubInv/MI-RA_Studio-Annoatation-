/**
 * Image annotation module — public surface.
 * Other modules should import from here, not from nested files.
 */
export { ImageStudioPage } from './pages/ImageStudioPage'
export { AnnotationOverlay } from './gallery/AnnotationOverlay'
export { ClassManager } from './panels/ClassManager'
export { loadLabelSchema, saveLabelSchema, colorForClass } from './schema/labelStore'
export type { LabelSchema, LabelClass, LabelAttribute } from './schema/labelStore'
export { schemasService } from './api/schemas.service'
export { TOOLS, TOOL_CATEGORIES } from './tools/registry'
