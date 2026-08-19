/** Video action annotations — Phase 19 (temporal spans on actor tracks). */

export interface VideoAction {
  id: string
  label: string
  color: string
  action_def_id?: string
  /** Actor track, e.g. Person_001 */
  actor_object_id: string
  /** Optional target track for transitive actions */
  target_object_id?: string
  frame: number
  end_frame: number
  attributes?: Record<string, unknown>
  visible?: boolean
  locked?: boolean
}

export function newActionId() {
  return crypto.randomUUID()
}

export function normalizeAction(raw: Record<string, unknown>): VideoAction | null {
  const frame = Number(raw.frame)
  const end = Number(raw.end_frame ?? raw.frame)
  if (!Number.isFinite(frame) || frame < 0) return null
  const actor = String(raw.actor_object_id || '')
  if (!actor) return null
  return {
    id: String(raw.id || newActionId()),
    label: String(raw.label || 'Action'),
    color: String(raw.color || '#f59e0b'),
    action_def_id: raw.action_def_id != null ? String(raw.action_def_id) : undefined,
    actor_object_id: actor,
    target_object_id: raw.target_object_id != null ? String(raw.target_object_id) : undefined,
    frame,
    end_frame: Math.max(frame, end),
    attributes: (raw.attributes as Record<string, unknown>) || {},
    visible: raw.visible !== false,
    locked: Boolean(raw.locked),
  }
}

export function actionsAtFrame(actions: VideoAction[], frame: number): VideoAction[] {
  return actions.filter(
    (a) => a.visible !== false && frame >= a.frame && frame <= (a.end_frame ?? a.frame),
  )
}

export function formatActionRange(a: VideoAction): string {
  if (a.frame === a.end_frame) return `f${a.frame + 1}`
  return `f${a.frame + 1}–${a.end_frame + 1}`
}
