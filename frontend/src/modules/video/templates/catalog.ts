/**
 * Authoring catalog for Custom Video Annotation Templates.
 * Maps owner-facing tool ids onto the existing video engine without changing classic mode.
 */
import type { VideoShapeType, VideoTool } from '@/modules/video/canvas/types'
import type { TemplateExportId } from './types'

export const TEMPLATE_TOOL_IDS = [
  'bounding_box',
  'rotated_box',
  'polygon',
  'polyline',
  'point',
  'ellipse',
  'keypoint',
  'skeleton',
  'brush',
  'mask',
  'cuboid',
  'tracking',
  'event',
  'action',
  'relationship',
  'trajectory',
] as const

export type TemplateToolId = (typeof TEMPLATE_TOOL_IDS)[number]

export const TEMPLATE_ATTRIBUTE_TYPES = ['boolean', 'number', 'text', 'select', 'multiselect'] as const
export type TemplateAttributeType = (typeof TEMPLATE_ATTRIBUTE_TYPES)[number]

export const TEMPLATE_LABEL_TYPES = ['object', 'event', 'action', 'relation', 'scene', 'audio'] as const
export type TemplateLabelType = (typeof TEMPLATE_LABEL_TYPES)[number]

/** Owner-facing event/action span kinds. `temporal` maps onto engine interval lanes. */
export const TEMPLATE_TEMPORAL_KINDS = ['temporal', 'instant', 'both'] as const
export type TemplateTemporalKind = (typeof TEMPLATE_TEMPORAL_KINDS)[number]

export function isTemplateTemporalKind(value: string): value is TemplateTemporalKind {
  return (TEMPLATE_TEMPORAL_KINDS as readonly string[]).includes(value)
}

export const TEMPLATE_TIMELINE_TRACKS = [
  'object_tracks',
  'event_tracks',
  'action_tracks',
  'audio_track',
  'speaker_track',
  'scene_tracks',
  'trajectory_tracks',
  'pose_tracks',
  'segmentation_tracks',
  'custom_track',
] as const

export type TemplateTimelineTrackId = (typeof TEMPLATE_TIMELINE_TRACKS)[number]

/** Legacy boolean flags still accepted in authoring JSON. */
export const TEMPLATE_TIMELINE_FLAG_KEYS = TEMPLATE_TIMELINE_TRACKS

export function isTemplateTimelineTrackId(value: string): value is TemplateTimelineTrackId {
  return (TEMPLATE_TIMELINE_TRACKS as readonly string[]).includes(value)
}

export const TEMPLATE_UI_PANELS = [
  'left_toolbar',
  'right_panel',
  'timeline',
  'label_panel',
  'object_panel',
  'properties_panel',
] as const

export type TemplateUiPanelId = (typeof TEMPLATE_UI_PANELS)[number]

export const TEMPLATE_EXPORT_FORMATS = [
  'json',
  'csv',
  'yolo',
  'coco',
  'mot',
  'cvat',
  'srt',
  'vtt',
  'keypoints',
  'kitti',
  'label_studio',
  'nuscenes',
  'waymo',
  'package',
  'annotated_video',
] as const

/** Engine draw tools produced by a catalog tool. Empty = temporal / not yet in the geometry strip. */
export const TEMPLATE_TOOL_ENGINE_MAP: Record<TemplateToolId, VideoTool[]> = {
  bounding_box: ['bbox'],
  rotated_box: ['rotated_rect'],
  polygon: ['polygon'],
  polyline: ['polyline'],
  point: ['point'],
  ellipse: ['ellipse'],
  keypoint: ['point'],
  skeleton: ['keypoints'],
  brush: ['brush'],
  mask: ['mask'],
  cuboid: [],
  tracking: [],
  event: [],
  action: [],
  relationship: [],
  trajectory: [],
}

export const TEMPLATE_TOOL_SHAPE_MAP: Partial<Record<TemplateToolId, VideoShapeType>> = {
  bounding_box: 'bbox',
  rotated_box: 'rotated_rect',
  polygon: 'polygon',
  polyline: 'polyline',
  point: 'point',
  ellipse: 'ellipse',
  keypoint: 'point',
  skeleton: 'keypoints',
  brush: 'brush',
  mask: 'mask',
}

export const ENGINE_TO_TEMPLATE_TOOL: Partial<Record<VideoTool, TemplateToolId>> = {
  bbox: 'bounding_box',
  rotated_rect: 'rotated_box',
  polygon: 'polygon',
  polyline: 'polyline',
  point: 'point',
  ellipse: 'ellipse',
  keypoints: 'skeleton',
  brush: 'brush',
  mask: 'mask',
}

export const TEMPLATE_TOOL_ICON_IDS = [
  'square',
  'rotate-cw',
  'hexagon',
  'pen-line',
  'target',
  'circle',
  'waypoints',
  'paintbrush',
  'box',
  'git-branch',
  'zap',
  'activity',
  'share-2',
  'spline',
  'plus',
] as const

export type TemplateToolIconId = (typeof TEMPLATE_TOOL_ICON_IDS)[number]

export const TEMPLATE_TOOL_DEFAULT_ICONS: Record<TemplateToolId, TemplateToolIconId> = {
  bounding_box: 'square',
  rotated_box: 'rotate-cw',
  polygon: 'hexagon',
  polyline: 'pen-line',
  point: 'target',
  ellipse: 'circle',
  keypoint: 'plus',
  skeleton: 'waypoints',
  brush: 'paintbrush',
  mask: 'hexagon',
  cuboid: 'box',
  tracking: 'git-branch',
  event: 'zap',
  action: 'activity',
  relationship: 'share-2',
  trajectory: 'spline',
}

/** Tools the current engine cannot draw yet. They remain configurable in JSON. */
export const UNIMPLEMENTED_TEMPLATE_TOOLS: TemplateToolId[] = ['cuboid']

/** Geometry tools that need at least one object label they can draw. */
export const DRAW_TEMPLATE_TOOLS: TemplateToolId[] = [
  'bounding_box',
  'rotated_box',
  'polygon',
  'polyline',
  'point',
  'ellipse',
  'keypoint',
  'skeleton',
  'brush',
  'mask',
  'cuboid',
]

export const NAVIGATION_ENGINE_TOOLS: VideoTool[] = ['select', 'pan']

export function isTemplateToolId(value: string): value is TemplateToolId {
  return (TEMPLATE_TOOL_IDS as readonly string[]).includes(value)
}

export function isTemplateExportFormat(value: string): value is TemplateExportId {
  return (TEMPLATE_EXPORT_FORMATS as readonly string[]).includes(value)
}
