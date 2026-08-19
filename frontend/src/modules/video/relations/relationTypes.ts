/** Video relationship annotations — Phase 20. */

export interface VideoRelation {
  id: string
  label: string
  color: string
  relation_def_id?: string
  /** Subject track, e.g. Person_001 */
  subject_object_id: string
  /** Object track, e.g. Bag_002 */
  object_object_id: string
  frame: number
  end_frame: number
  attributes?: Record<string, unknown>
  visible?: boolean
  locked?: boolean
}

export function newRelationId() {
  return crypto.randomUUID()
}

export function normalizeRelation(raw: Record<string, unknown>): VideoRelation | null {
  const frame = Number(raw.frame)
  const end = Number(raw.end_frame ?? raw.frame)
  if (!Number.isFinite(frame) || frame < 0) return null
  const subject = String(raw.subject_object_id || '')
  const object = String(raw.object_object_id || '')
  if (!subject || !object) return null
  return {
    id: String(raw.id || newRelationId()),
    label: String(raw.label || 'Relation'),
    color: String(raw.color || '#14b8a6'),
    relation_def_id: raw.relation_def_id != null ? String(raw.relation_def_id) : undefined,
    subject_object_id: subject,
    object_object_id: object,
    frame,
    end_frame: Math.max(frame, end),
    attributes: (raw.attributes as Record<string, unknown>) || {},
    visible: raw.visible !== false,
    locked: Boolean(raw.locked),
  }
}

export function relationsAtFrame(relations: VideoRelation[], frame: number): VideoRelation[] {
  return relations.filter(
    (r) => r.visible !== false && frame >= r.frame && frame <= (r.end_frame ?? r.frame),
  )
}

export function formatRelationLabel(r: VideoRelation): string {
  return `${r.subject_object_id} → ${r.label} → ${r.object_object_id}`
}

export function formatRelationRange(r: VideoRelation): string {
  if (r.frame === r.end_frame) return `f${r.frame + 1}`
  return `f${r.frame + 1}–${r.end_frame + 1}`
}
