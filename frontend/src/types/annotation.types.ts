/**
 * MI-RA Studio — Core TypeScript types
 * Shared across all modalities and components.
 */

// ── Modalities ───────────────────────────────────────────────────
export type DatasetModality =
  | 'image' | 'video' | 'audio' | 'text' | 'document'
  | 'pose_2d' | 'pose_3d' | 'lidar' | 'point_cloud'
  | 'depth' | 'medical' | 'geospatial' | 'time_series'
  | 'multimodal' | 'other'

// ── Tool types ────────────────────────────────────────────────────
export type ToolType =
  | 'select' | 'bbox' | 'rotated_bbox' | 'polygon' | 'polyline'
  | 'point' | 'ellipse' | 'circle' | 'line' | 'freehand' | 'arc'
  | 'brush' | 'eraser' | 'mask' | 'polygon_mask' | 'freehand_mask'
  | 'semantic_seg' | 'instance_seg'
  | 'keypoint' | 'skeleton' | 'cuboid' | 'bbox3d' | 'roi' | 'measure' | 'angle' | 'area'
  | 'classify' | 'multilabel' | 'tags' | 'attributes'
  | 'span' | 'segment' | 'geopolygon' | 'geopoint'

// ── Geometry (JSONB-compatible, matches backend) ──────────────────
export interface BboxGeometry    { x: number; y: number; w: number; h: number }
export interface PolygonGeometry { points: [number, number][] }
export interface PointGeometry   { x: number; y: number }
export interface SpanGeometry    { start: number; end: number }
export interface SegmentGeometry { start_sec: number; end_sec: number }
export interface Bbox3DGeometry  { x: number; y: number; z: number; l: number; w: number; h: number; yaw: number }

export type Geometry =
  | BboxGeometry | PolygonGeometry | PointGeometry
  | SpanGeometry | SegmentGeometry | Bbox3DGeometry
  | Record<string, unknown>

// ── Annotation object ─────────────────────────────────────────────
export interface AnnotationObject {
  id: string
  annotation_id: string
  class_name: string
  class_id?: string
  tool_type: ToolType
  geometry: Geometry
  attributes?: Record<string, unknown>
  hierarchical_labels?: string[]
  extra_labels?: string[]
  frame_index?: number
  is_keyframe?: boolean
  confidence?: number
  is_locked?: boolean
  is_hidden?: boolean
  linked_object_id?: string
  link_relation?: string
  comment?: string
}

// ── Annotation ────────────────────────────────────────────────────
export interface Annotation {
  id: string
  item_id: string
  annotator_id: string
  version: number
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'consensus'
  is_ground_truth: boolean
  labels?: string[]
  objects: AnnotationObject[]
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Schema ───────────────────────────────────────────────────────
export interface AnnotationClass {
  id?: string
  name: string
  display_name?: string
  color?: string
  tools?: ToolType[]
  parent_id?: string
  hotkey?: string
}

export interface AnnotationAttribute {
  name: string
  input_type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'radio'
  values?: string[]
  default_value?: unknown
  is_required?: boolean
}

export interface AnnotationSchema {
  id?: string
  name: string
  version?: string
  modalities?: DatasetModality[]
  classes: AnnotationClass[]
  validation_rules?: Record<string, unknown>
}

// ── User ─────────────────────────────────────────────────────────
export type UserRole =
  | 'super_admin' | 'org_admin' | 'project_manager'
  | 'annotator' | 'qa' | 'reviewer' | 'viewer'

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  avatar_url?: string
}

// ── Project ──────────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  organization_id: string
  created_at: string
}

// ── Dataset ──────────────────────────────────────────────────────
export interface Dataset {
  id: string
  name: string
  description?: string
  modality: DatasetModality
  status: 'uploading' | 'processing' | 'ready' | 'error'
  item_count: number
  total_size_bytes: number
  project_id: string
  created_at: string
  storage_mode?: 'local' | 'cloud' | 'server'
}

// ── Dataset Item ─────────────────────────────────────────────────
export interface DatasetItem {
  id: string
  dataset_id: string
  filename: string
  storage_path: string
  thumbnail_path?: string
  original_filename?: string
  media_url?: string
  thumbnail_url?: string
  mime_type: string
  file_size_bytes: number
  status: 'pending' | 'processing' | 'ready' | 'annotating' | 'annotated' | 'in_review' | 'approved' | 'rejected' | 'error'
  width?: number
  height?: number
  duration_seconds?: number
  frame_count?: number
  fps?: number
  preview_url?: string
  playback_url?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  relative_path?: string
  parent_folder?: string
  is_local?: boolean
}

export interface Task {
  id: string
  project_id: string
  dataset_id?: string
  name: string
  description?: string
  status: 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'in_review' | 'approved' | 'rejected'
  priority: number
  item_ids?: string[]
  created_at: string
}

// ── API response ──────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}
