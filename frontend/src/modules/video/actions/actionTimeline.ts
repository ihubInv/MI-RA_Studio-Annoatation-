import type { VideoAction } from '@/modules/video/actions/actionTypes'
import type { ActionDefinition } from '@/modules/video/schema/actionStore'

export interface ActionTimelineRow {
  id: string
  label: string
  color: string
  items: VideoAction[]
}

export function buildActionTimelineRows(
  actions: VideoAction[],
  definitions: ActionDefinition[],
): ActionTimelineRow[] {
  const enabled = definitions.filter((d) => d.enabled)
  const rows: ActionTimelineRow[] = enabled.map((def) => ({
    id: def.id,
    label: def.name,
    color: def.color,
    items: actions.filter(
      (a) => a.action_def_id === def.id || (!a.action_def_id && a.label === def.name),
    ),
  }))

  const known = new Set(enabled.flatMap((d) => [d.id, d.name]))
  const orphans = actions.filter((a) => !a.action_def_id || !known.has(a.action_def_id))
  const labels = [...new Set(orphans.map((a) => a.label))]
  for (const label of labels) {
    if (known.has(label)) continue
    const group = orphans.filter((a) => a.label === label)
    rows.push({
      id: `orphan:${label}`,
      label,
      color: group[0]?.color ?? '#f59e0b',
      items: group,
    })
  }
  return rows
}
