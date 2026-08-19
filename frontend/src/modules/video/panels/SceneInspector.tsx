import { Trash2 } from 'lucide-react'
import { formatSceneRange, type VideoScene } from '@/modules/video/scenes/sceneTypes'
import type { SceneDefinition } from '@/modules/video/schema/sceneStore'

interface Props {
  scene: VideoScene
  definitions: SceneDefinition[]
  maxFrame: number
  onChange: (patch: Partial<VideoScene>) => void
  onDelete: () => void
}

export function SceneInspector({ scene, definitions, maxFrame, onChange, onDelete }: Props) {
  const sceneTypes = definitions.filter((d) => d.kind === 'scene')

  return (
    <div className="p-3 space-y-3 border-t border-border bg-slate-50/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: scene.color }} />
          <span className="text-sm font-semibold truncate">{scene.label}</span>
          {scene.auto_detected && (
            <span className="text-2xs px-1 rounded bg-amber-100 text-amber-800">auto</span>
          )}
        </div>
        <button type="button" className="mira-btn-ghost h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-2xs text-muted-foreground capitalize">
        {scene.marker_kind.replace('_', ' ')} · {formatSceneRange(scene)}
      </p>
      {scene.marker_kind === 'scene' && (
        <label className="block text-2xs text-muted-foreground">
          Scene type
          <select
            className="mira-input h-8 text-xs mt-1 w-full"
            value={scene.scene_type ?? scene.label}
            onChange={(e) => {
              const def = sceneTypes.find((d) => d.name === e.target.value)
              onChange({
                scene_type: e.target.value,
                label: e.target.value,
                color: def?.color ?? scene.color,
                scene_def_id: def?.id,
              })
            }}
          >
            {sceneTypes.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
      )}
      {scene.marker_kind === 'scene' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-2xs text-muted-foreground">
            Start
            <input
              type="number"
              min={0}
              max={maxFrame}
              className="mira-input h-8 text-xs mt-1 w-full font-mono"
              value={scene.frame}
              onChange={(e) => onChange({ frame: Math.min(maxFrame, Math.max(0, Number(e.target.value) || 0)) })}
            />
          </label>
          <label className="block text-2xs text-muted-foreground">
            End
            <input
              type="number"
              min={scene.frame}
              max={maxFrame}
              className="mira-input h-8 text-xs mt-1 w-full font-mono"
              value={scene.end_frame ?? scene.frame}
              onChange={(e) =>
                onChange({
                  end_frame: Math.min(maxFrame, Math.max(scene.frame, Number(e.target.value) || scene.frame)),
                })
              }
            />
          </label>
        </div>
      ) : (
        <label className="block text-2xs text-muted-foreground">
          Frame
          <input
            type="number"
            min={0}
            max={maxFrame}
            className="mira-input h-8 text-xs mt-1 w-full font-mono"
            value={scene.frame}
            onChange={(e) => onChange({ frame: Math.min(maxFrame, Math.max(0, Number(e.target.value) || 0)) })}
          />
        </label>
      )}
    </div>
  )
}
