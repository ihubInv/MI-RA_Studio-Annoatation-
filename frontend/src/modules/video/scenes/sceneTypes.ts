/** Video scene annotations — Phase 23. */

export type SceneMarkerKind = 'scene' | 'shot_boundary' | 'camera_cut'

export interface VideoScene {
  id: string
  label: string
  color: string
  marker_kind: SceneMarkerKind
  /** Scene type name for interval scenes (Interior, Exterior, …) */
  scene_type?: string
  scene_def_id?: string
  frame: number
  end_frame?: number
  auto_detected?: boolean
  attributes?: Record<string, unknown>
  visible?: boolean
  locked?: boolean
}

export function newSceneId() {
  return crypto.randomUUID()
}

export function isIntervalScene(scene: VideoScene): boolean {
  return scene.marker_kind === 'scene'
}

export function normalizeScene(raw: Record<string, unknown>): VideoScene | null {
  const kind = raw.marker_kind as SceneMarkerKind
  if (!['scene', 'shot_boundary', 'camera_cut'].includes(kind)) return null
  const frame = Number(raw.frame)
  if (!Number.isFinite(frame) || frame < 0) return null
  const end_frame = raw.end_frame != null ? Number(raw.end_frame) : undefined
  if (kind === 'scene' && (end_frame == null || !Number.isFinite(end_frame) || end_frame < frame)) {
    return null
  }
  return {
    id: String(raw.id || newSceneId()),
    label: String(raw.label || 'Scene'),
    color: String(raw.color || '#64748b'),
    marker_kind: kind,
    scene_type: raw.scene_type != null ? String(raw.scene_type) : undefined,
    scene_def_id: raw.scene_def_id != null ? String(raw.scene_def_id) : undefined,
    frame,
    end_frame: kind === 'scene' ? end_frame : undefined,
    auto_detected: Boolean(raw.auto_detected),
    attributes: (raw.attributes as Record<string, unknown>) || {},
    visible: raw.visible !== false,
    locked: Boolean(raw.locked),
  }
}

export function sceneSpan(scene: VideoScene): { start: number; end: number } {
  if (scene.marker_kind !== 'scene') return { start: scene.frame, end: scene.frame }
  return { start: scene.frame, end: scene.end_frame ?? scene.frame }
}

export function formatSceneRange(scene: VideoScene): string {
  if (scene.marker_kind !== 'scene') return `f${scene.frame + 1}`
  return `f${scene.frame + 1}–${(scene.end_frame ?? scene.frame) + 1}`
}
