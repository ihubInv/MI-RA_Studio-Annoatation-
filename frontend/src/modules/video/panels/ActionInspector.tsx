import { Trash2 } from 'lucide-react'
import { formatActionRange, type VideoAction } from '@/modules/video/actions/actionTypes'
import type { ObjectManagerEntry } from '@/modules/video/hooks/useVideoAnnotations'

interface Props {
  action: VideoAction
  maxFrame: number
  objectEntries: ObjectManagerEntry[]
  onChange: (patch: Partial<VideoAction>) => void
  onDelete: () => void
}

export function ActionInspector({ action, maxFrame, objectEntries, onChange, onDelete }: Props) {
  const tracks = objectEntries.map((e) => e.object_id)

  return (
    <div className="p-3 space-y-3 border-t border-border bg-amber-50/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: action.color }} />
          <span className="text-sm font-semibold truncate">{action.label}</span>
        </div>
        <button type="button" className="mira-btn-ghost h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-2xs text-muted-foreground">{formatActionRange(action)}</p>
      <label className="block text-2xs text-muted-foreground">
        Actor
        <select
          className="mira-input h-8 text-xs mt-1 w-full font-mono"
          value={action.actor_object_id}
          onChange={(e) => onChange({ actor_object_id: e.target.value })}
        >
          {tracks.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>
      <label className="block text-2xs text-muted-foreground">
        Target (optional)
        <select
          className="mira-input h-8 text-xs mt-1 w-full font-mono"
          value={action.target_object_id ?? ''}
          onChange={(e) => onChange({ target_object_id: e.target.value || undefined })}
        >
          <option value="">— none —</option>
          {tracks.filter((id) => id !== action.actor_object_id).map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-2xs text-muted-foreground">
          Start
          <input
            type="number"
            min={0}
            max={maxFrame}
            className="mira-input h-8 text-xs mt-1 w-full font-mono"
            value={action.frame}
            onChange={(e) => onChange({ frame: Math.min(maxFrame, Math.max(0, Number(e.target.value) || 0)) })}
          />
        </label>
        <label className="block text-2xs text-muted-foreground">
          End
          <input
            type="number"
            min={action.frame}
            max={maxFrame}
            className="mira-input h-8 text-xs mt-1 w-full font-mono"
            value={action.end_frame}
            onChange={(e) =>
              onChange({ end_frame: Math.min(maxFrame, Math.max(action.frame, Number(e.target.value) || action.frame)) })
            }
          />
        </label>
      </div>
    </div>
  )
}
