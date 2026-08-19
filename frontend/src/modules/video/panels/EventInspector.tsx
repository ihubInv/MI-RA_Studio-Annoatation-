import { Trash2 } from 'lucide-react'
import { formatEventRange, type VideoEvent } from '@/modules/video/events/eventTypes'

interface Props {
  event: VideoEvent
  maxFrame: number
  onChange: (patch: Partial<VideoEvent>) => void
  onDelete: () => void
}

export function EventInspector({ event, maxFrame, onChange, onDelete }: Props) {
  return (
    <div className="p-3 space-y-3 border-t border-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: event.color }} />
          <span className="text-sm font-semibold truncate">{event.label}</span>
        </div>
        <button type="button" className="mira-btn-ghost h-7 w-7 p-0 text-destructive" onClick={onDelete} title="Delete event">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-2xs text-muted-foreground capitalize">
        {event.kind} · {formatEventRange(event)}
      </p>

      <label className="block text-2xs text-muted-foreground">
        Frame
        <input
          type="number"
          min={0}
          max={maxFrame}
          className="mira-input h-8 text-xs mt-1 w-full font-mono"
          value={event.frame}
          onChange={(e) => onChange({ frame: Math.min(maxFrame, Math.max(0, Number(e.target.value) || 0)) })}
        />
      </label>

      {event.kind === 'interval' && (
        <label className="block text-2xs text-muted-foreground">
          End frame
          <input
            type="number"
            min={event.frame}
            max={maxFrame}
            className="mira-input h-8 text-xs mt-1 w-full font-mono"
            value={event.end_frame ?? event.frame}
            onChange={(e) =>
              onChange({
                end_frame: Math.min(maxFrame, Math.max(event.frame, Number(e.target.value) || event.frame)),
              })
            }
          />
        </label>
      )}

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={event.visible !== false}
          onChange={(e) => onChange({ visible: e.target.checked })}
        />
        Visible
      </label>
    </div>
  )
}
