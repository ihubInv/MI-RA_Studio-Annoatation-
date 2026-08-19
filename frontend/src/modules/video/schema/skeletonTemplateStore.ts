/** Phase 14 — customizable skeleton / keypoint templates. */

export interface SkeletonJointDef {
  id: string
  name: string
  /** Normalized layout offset (for default placement). */
  layout_x?: number
  layout_y?: number
}

export interface SkeletonTemplate {
  id: string
  name: string
  joints: SkeletonJointDef[]
  /** Joint id pairs (bone connections). */
  edges: [string, string][]
}

export interface SkeletonTemplateSchema {
  version: 1
  datasetKey: string
  templates: SkeletonTemplate[]
  activeTemplateId: string
}

const COCO_JOINTS: SkeletonJointDef[] = [
  { id: 'nose', name: 'nose', layout_x: 0, layout_y: -0.45 },
  { id: 'left_eye', name: 'left_eye', layout_x: -0.08, layout_y: -0.48 },
  { id: 'right_eye', name: 'right_eye', layout_x: 0.08, layout_y: -0.48 },
  { id: 'left_ear', name: 'left_ear', layout_x: -0.14, layout_y: -0.42 },
  { id: 'right_ear', name: 'right_ear', layout_x: 0.14, layout_y: -0.42 },
  { id: 'left_shoulder', name: 'left_shoulder', layout_x: -0.22, layout_y: -0.2 },
  { id: 'right_shoulder', name: 'right_shoulder', layout_x: 0.22, layout_y: -0.2 },
  { id: 'left_elbow', name: 'left_elbow', layout_x: -0.3, layout_y: 0.05 },
  { id: 'right_elbow', name: 'right_elbow', layout_x: 0.3, layout_y: 0.05 },
  { id: 'left_wrist', name: 'left_wrist', layout_x: -0.34, layout_y: 0.28 },
  { id: 'right_wrist', name: 'right_wrist', layout_x: 0.34, layout_y: 0.28 },
  { id: 'left_hip', name: 'left_hip', layout_x: -0.12, layout_y: 0.22 },
  { id: 'right_hip', name: 'right_hip', layout_x: 0.12, layout_y: 0.22 },
  { id: 'left_knee', name: 'left_knee', layout_x: -0.12, layout_y: 0.48 },
  { id: 'right_knee', name: 'right_knee', layout_x: 0.12, layout_y: 0.48 },
  { id: 'left_ankle', name: 'left_ankle', layout_x: -0.12, layout_y: 0.72 },
  { id: 'right_ankle', name: 'right_ankle', layout_x: 0.12, layout_y: 0.72 },
]

const COCO_EDGES: [string, string][] = [
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
]

const DEFAULT_TEMPLATES: SkeletonTemplate[] = [
  {
    id: 'coco-17',
    name: 'COCO-17',
    joints: COCO_JOINTS,
    edges: COCO_EDGES,
  },
  {
    id: 'simple-4',
    name: 'Simple 4-point',
    joints: [
      { id: 'head', name: 'head', layout_x: 0, layout_y: -0.4 },
      { id: 'torso', name: 'torso', layout_x: 0, layout_y: 0 },
      { id: 'left_hand', name: 'left_hand', layout_x: -0.35, layout_y: 0.1 },
      { id: 'right_hand', name: 'right_hand', layout_x: 0.35, layout_y: 0.1 },
    ],
    edges: [
      ['head', 'torso'],
      ['torso', 'left_hand'],
      ['torso', 'right_hand'],
    ],
  },
]

function storageKey(datasetKey: string) {
  return `mira.video.skeleton-templates.${datasetKey}`
}

export function loadSkeletonTemplateSchema(datasetKey: string): SkeletonTemplateSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetKey))
    if (raw) {
      const parsed = JSON.parse(raw) as SkeletonTemplateSchema
      if (parsed?.templates?.length) return parsed
    }
  } catch {
    /* ignore */
  }
  return {
    version: 1,
    datasetKey,
    templates: DEFAULT_TEMPLATES.map((t) => ({ ...t, joints: [...t.joints], edges: [...t.edges] })),
    activeTemplateId: 'coco-17',
  }
}

export function saveSkeletonTemplateSchema(schema: SkeletonTemplateSchema) {
  localStorage.setItem(storageKey(schema.datasetKey), JSON.stringify(schema))
}

export function getActiveTemplate(schema: SkeletonTemplateSchema): SkeletonTemplate {
  return schema.templates.find((t) => t.id === schema.activeTemplateId) ?? schema.templates[0]
}

export function layoutJointsFromTemplate(
  template: SkeletonTemplate,
  cx: number,
  cy: number,
  scale = 140,
) {
  return template.joints.map((j) => ({
    joint_id: j.id,
    name: j.name,
    x: cx + (j.layout_x ?? 0) * scale,
    y: cy + (j.layout_y ?? 0) * scale,
    visible: true,
    occlusion: 'visible' as const,
  }))
}
