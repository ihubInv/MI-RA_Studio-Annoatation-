import { formatRelationLabel, type VideoRelation } from '@/modules/video/relations/relationTypes'
import type { RelationDefinition } from '@/modules/video/schema/relationStore'

export interface RelationTimelineRow {
  id: string
  label: string
  color: string
  items: VideoRelation[]
}

export function buildRelationTimelineRows(
  relations: VideoRelation[],
  definitions: RelationDefinition[],
): RelationTimelineRow[] {
  const enabled = definitions.filter((d) => d.enabled)
  return enabled.map((def) => ({
    id: def.id,
    label: def.name,
    color: def.color,
    items: relations.filter(
      (r) => r.relation_def_id === def.id || (!r.relation_def_id && r.label === def.name),
    ),
  }))
}

export function relationRowTitle(r: VideoRelation): string {
  return formatRelationLabel(r)
}
