export type ToolCategory =
  | 'favorites'
  | 'selection'
  | 'geometry'
  | 'segmentation'
  | 'pose'
  | 'classification'
  | 'relations'
  | 'measurement'
  | '3d'
  | 'ai'
  | 'navigation'

export type DrawMode =
  | 'select'
  | 'pan'
  | 'rect'
  | 'rotated-rect'
  | 'circle'
  | 'ellipse'
  | 'points'
  | 'polyline'
  | 'polygon'
  | 'freehand'
  | 'click-point'
  | 'keypoints'
  | 'erase'
  | 'classify'
  | 'measure-line'
  | 'measure-angle'
  | 'ai'

export interface ToolDef {
  id: string
  label: string
  category: ToolCategory
  shortcut?: string
  description: string
  drawMode: DrawMode
  implemented: boolean
  ai?: boolean
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
  { id: 'favorites', label: 'Favorites' },
  { id: 'selection', label: 'Selection' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'segmentation', label: 'Segmentation' },
  { id: 'pose', label: 'Keypoints & Pose' },
  { id: 'classification', label: 'Classification' },
  { id: 'relations', label: 'Relations' },
  { id: 'measurement', label: 'Measurement' },
  { id: '3d', label: '3D' },
  { id: 'ai', label: 'AI Tools' },
]

export const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', category: 'selection', shortcut: 'V', description: 'Select and transform objects', drawMode: 'select', implemented: true },
  { id: 'pointer', label: 'Pointer', category: 'selection', shortcut: 'I', description: 'Inspect object under cursor', drawMode: 'select', implemented: true },
  { id: 'pan', label: 'Hand / Pan', category: 'navigation', shortcut: 'H', description: 'Click-drag to move the canvas', drawMode: 'pan', implemented: true },
  { id: 'zoom', label: 'Zoom', category: 'navigation', shortcut: 'Z', description: 'Scroll or click to zoom toward cursor', drawMode: 'pan', implemented: true },

  { id: 'bbox', label: 'Bounding Box', category: 'geometry', shortcut: 'B', description: 'Draw an axis-aligned rectangle', drawMode: 'rect', implemented: true },
  { id: 'rotated_bbox', label: 'Rotated Box', category: 'geometry', shortcut: 'R', description: 'Draw a box, then rotate with Select', drawMode: 'rotated-rect', implemented: true },
  { id: 'polygon', label: 'Polygon', category: 'geometry', shortcut: 'P', description: 'Click vertices, Enter or S to close', drawMode: 'polygon', implemented: true },
  { id: 'polyline', label: 'Polyline', category: 'geometry', shortcut: 'L', description: 'Open polyline of connected segments', drawMode: 'polyline', implemented: true },
  { id: 'line', label: 'Line', category: 'geometry', description: 'Two-point line', drawMode: 'polyline', implemented: true },
  { id: 'freehand', label: 'Freehand', category: 'geometry', shortcut: 'F', description: 'Draw a freehand stroke', drawMode: 'freehand', implemented: true },
  { id: 'point', label: 'Point', category: 'geometry', description: 'Place a single point', drawMode: 'click-point', implemented: true },
  { id: 'circle', label: 'Circle', category: 'geometry', description: 'Drag from center to radius', drawMode: 'circle', implemented: true },
  { id: 'ellipse', label: 'Ellipse', category: 'geometry', description: 'Drag an ellipse', drawMode: 'ellipse', implemented: true },
  { id: 'arc', label: 'Arc', category: 'geometry', description: 'Three-point arc', drawMode: 'polyline', implemented: true },

  { id: 'brush', label: 'Brush Mask', category: 'segmentation', shortcut: 'M', description: 'Paint a segmentation mask', drawMode: 'freehand', implemented: true },
  { id: 'eraser', label: 'Eraser', category: 'segmentation', shortcut: 'E', description: 'Click an object to delete it', drawMode: 'erase', implemented: true },
  { id: 'polygon_mask', label: 'Polygon Mask', category: 'segmentation', description: 'Closed polygon as instance mask', drawMode: 'polygon', implemented: true },
  { id: 'freehand_mask', label: 'Freehand Mask', category: 'segmentation', description: 'Freehand closed mask', drawMode: 'freehand', implemented: true },
  { id: 'semantic_seg', label: 'Semantic Segmentation', category: 'segmentation', description: 'Class-level region mask', drawMode: 'polygon', implemented: true },
  { id: 'instance_seg', label: 'Instance Segmentation', category: 'segmentation', description: 'Instance mask for one object', drawMode: 'polygon', implemented: true },
  { id: 'magic_wand', label: 'Magic Wand', category: 'segmentation', shortcut: 'W', description: 'Click a region to auto-select similar pixels', drawMode: 'ai', implemented: true, ai: true },
  { id: 'mask_refine', label: 'Mask Refinement', category: 'segmentation', description: 'Refine an existing mask', drawMode: 'freehand', implemented: true },
  { id: 'mask_merge', label: 'Mask Merge', category: 'segmentation', description: 'Merge selected masks', drawMode: 'select', implemented: true },
  { id: 'mask_split', label: 'Mask Split', category: 'segmentation', description: 'Split a mask into instances', drawMode: 'select', implemented: true },

  { id: 'keypoint', label: 'Keypoint', category: 'pose', shortcut: 'K', description: 'Place skeleton keypoints', drawMode: 'keypoints', implemented: true },
  { id: 'skeleton', label: 'Skeleton', category: 'pose', description: 'Place a COCO-17 pose at the click', drawMode: 'click-point', implemented: true },
  { id: 'pose_edit', label: 'Pose Edit', category: 'pose', description: 'Drag joints on an existing pose', drawMode: 'select', implemented: true },

  { id: 'classify', label: 'Classification', category: 'classification', description: 'Assign image-level class', drawMode: 'classify', implemented: true },
  { id: 'multilabel', label: 'Multi-label', category: 'classification', description: 'Assign multiple image labels', drawMode: 'classify', implemented: true },
  { id: 'attributes', label: 'Attributes', category: 'classification', description: 'Edit attributes of the selection', drawMode: 'select', implemented: true },
  { id: 'tags', label: 'Tags', category: 'classification', description: 'Freeform tags', drawMode: 'select', implemented: true },

  { id: 'relation', label: 'Relation', category: 'relations', description: 'Click source, then target object', drawMode: 'select', implemented: true },
  { id: 'hierarchy', label: 'Hierarchy', category: 'relations', description: 'Click parent, then child object', drawMode: 'select', implemented: true },
  { id: 'track_id', label: 'Track ID', category: 'relations', description: 'Click an object to assign a track ID', drawMode: 'select', implemented: true },

  { id: 'measure', label: 'Distance', category: 'measurement', description: 'Measure pixel distance', drawMode: 'measure-line', implemented: true },
  { id: 'angle', label: 'Angle', category: 'measurement', description: 'Measure an angle', drawMode: 'measure-angle', implemented: true },
  { id: 'area', label: 'Area', category: 'measurement', description: 'Measure polygon area', drawMode: 'polygon', implemented: true },
  { id: 'roi', label: 'ROI', category: 'measurement', description: 'Region of interest', drawMode: 'rect', implemented: true },
  { id: 'grid', label: 'Grid', category: 'measurement', description: 'Toggle canvas grid', drawMode: 'select', implemented: true },

  { id: 'cuboid', label: 'Cuboid', category: '3d', description: '2.5D cuboid on image', drawMode: 'rect', implemented: true },
  { id: 'bbox3d', label: '3D Box', category: '3d', description: '3D box (LiDAR workspace)', drawMode: 'rect', implemented: true },

  { id: 'ai_segment', label: 'AI Segmentation', category: 'ai', description: 'Click an object to generate an instance mask', drawMode: 'ai', implemented: true, ai: true },
  { id: 'ai_detect', label: 'AI Detect', category: 'ai', description: 'Find objects and draw bounding boxes', drawMode: 'ai', implemented: true, ai: true },
  { id: 'ai_pose', label: 'AI Pose', category: 'ai', description: 'Place a skeleton pose at the click', drawMode: 'ai', implemented: true, ai: true },
]

export const TOOL_BY_ID = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<string, ToolDef>

export const DEFAULT_SHORTCUTS: Record<string, string> = Object.fromEntries(
  TOOLS.filter((t) => t.shortcut).map((t) => [t.shortcut!.toLowerCase(), t.id]),
)

export function toolsByCategory(category: ToolCategory) {
  return TOOLS.filter((t) => t.category === category)
}
