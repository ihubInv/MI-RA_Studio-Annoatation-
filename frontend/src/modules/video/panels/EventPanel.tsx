import { Circle, Minus, Plus } from 'lucide-react'
import type { EventDefinition } from '@/modules/video/schema/eventStore'
import type { VideoEventsApi } from '@/modules/video/hooks/useVideoEvents'
import { cn } from '@/utils/cn'

interface Props {
  schema: EventDefinition[]
  events: VideoEventsApi
  currentFrame: number
  onOpenManager?: () => void
}

export function EventPanel({ schema, events, currentFrame, onOpenManager }: Props) {
  const enabled = schema.filter((d) => d.enabled)
  const activeDef = enabled.find((d) => d.id === events.activeEventDefId) ?? enabled[0] ?? null

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1.5 flex items-center justify-between bg-muted/30">
        <p className="mira-section-label mb-0">Events</p>
        {onOpenManager && (
          <button type="button" className="text-2xs text-muted-foreground hover:text-foreground" onClick={onOpenManager}>
            Manage
          </button>
        )}
      </div>

      <div className="p-2 space-y-2 max-h-40 overflow-y-auto">
        {enabled.map((def) => (
          <button
            key={def.id}
            type="button"
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs border',
              events.activeEventDefId === def.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent',
            )}
            onClick={() => events.setActiveEventDefId(def.id)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: def.color }} />
            <span className="flex-1 truncate font-medium">{def.name}</span>
            <span className="text-2xs text-muted-foreground capitalize">{def.kind}</span>
          </button>
        ))}
      </div>

      {activeDef && (
        <div className="px-2 pb-2 space-y-1">
          {(activeDef.kind === 'instant' || activeDef.kind === 'both') && (
            <button
              type="button"
              className="w-full mira-btn-ghost h-8 text-xs flex items-center justify-center gap-1.5"
              onClick={() => events.addInstantEvent(activeDef, currentFrame)}
            >
              <Circle className="w-3 h-3" /> Mark instant · f{currentFrame + 1}
            </button>
          )}
          {(activeDef.kind === 'interval' || activeDef.kind === 'both') && (
            <>
              {!events.intervalDraft || events.intervalDraft.eventDefId !== activeDef.id ? (
                <button
                  type="button"
                  className="w-full mira-btn-ghost h-8 text-xs flex items-center justify-center gap-1.5"
                  onClick={() => events.beginInterval(activeDef.id, currentFrame)}
                >
                  <Minus className="w-3 h-3" /> Start interval · f{currentFrame + 1}
                </button>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xs text-muted-foreground text-center">
                    Interval start f{events.intervalDraft.startFrame + 1} — seek end frame
                  </p>
                  <button
                    type="button"
                    className="w-full mira-btn-primary h-8 text-xs"
                    onClick={() =>
                      events.addIntervalEvent(activeDef, events.intervalDraft!.startFrame, currentFrame)
                    }
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    End at f{currentFrame + 1}
                  </button>
                  <button
                    type="button"
                    className="w-full mira-btn-ghost h-7 text-2xs"
                    onClick={events.cancelIntervalDraft}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {events.events.length > 0 && (
        <div className="px-2 pb-2 border-t border-border/60 pt-1">
          <p className="text-2xs text-muted-foreground mb-1">{events.events.length} event(s)</p>
        </div>
      )}
    </div>
  )
}
