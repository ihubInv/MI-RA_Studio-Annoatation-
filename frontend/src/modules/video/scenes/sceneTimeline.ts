import type { VideoScene } from '@/modules/video/scenes/sceneTypes'
import type { SceneDefinition } from '@/modules/video/schema/sceneStore'

export interface SceneTimelineRow {
  id: string
  label: string
  color: string
  marker_kind: VideoScene['marker_kind']
  items: VideoScene[]
}

export function buildSceneTimelineRows(
  scenes: VideoScene[],
  definitions: SceneDefinition[],
): SceneTimelineRow[] {
  const kinds: VideoScene['marker_kind'][] = ['scene', 'shot_boundary', 'camera_cut']
  return kinds.map((kind) => {
    const def = definitions.find((d) => d.kind === kind && d.enabled)
    const label =
      kind === 'scene'
        ? 'Scenes'
        : kind === 'shot_boundary'
          ? 'Shot boundaries'
          : 'Camera cuts'
    const color = def?.color ?? (kind === 'scene' ? '#475569' : kind === 'shot_boundary' ? '#f59e0b' : '#ef4444')
    return {
      id: kind,
      label,
      color,
      marker_kind: kind,
      items: scenes.filter((s) => s.marker_kind === kind && s.visible !== false),
    }
  })
}

export function scenesToSpanRows(rows: SceneTimelineRow[]) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    color: row.color,
    items: row.items.map((s) => ({
      id: s.id,
      frame: s.frame,
      end_frame: s.marker_kind === 'scene' ? s.end_frame : s.frame,
      color: s.color,
      title: s.scene_type ? `${s.scene_type} · ${s.label}` : s.label,
      subtitle: s.scene_type ?? (s.auto_detected ? 'auto' : undefined),
    })),
  }))
}
