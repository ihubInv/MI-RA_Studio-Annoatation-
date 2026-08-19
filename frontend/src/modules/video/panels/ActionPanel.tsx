import { Minus, Plus } from 'lucide-react'
import type { ActionDefinition } from '@/modules/video/schema/actionStore'
import type { VideoActionsApi } from '@/modules/video/hooks/useVideoActions'
import type { ObjectManagerEntry } from '@/modules/video/hooks/useVideoAnnotations'
import { cn } from '@/utils/cn'

interface Props {
  definitions: ActionDefinition[]
  actions: VideoActionsApi
  actorObjectId: string | null
  objectEntries: ObjectManagerEntry[]
  currentFrame: number
  onOpenManager?: () => void
}

export function ActionPanel({
  definitions,
  actions,
  actorObjectId,
  currentFrame,
  onOpenManager,
}: Props) {
  const enabled = definitions.filter((d) => d.enabled)
  const activeDef = enabled.find((d) => d.id === actions.activeActionDefId) ?? enabled[0] ?? null
  const draft = actions.intervalDraft

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1.5 flex items-center justify-between bg-amber-50/50">
        <p className="mira-section-label mb-0 text-amber-900">Actions</p>
        {onOpenManager && (
          <button type="button" className="text-2xs text-muted-foreground hover:text-foreground" onClick={onOpenManager}>
            Manage
          </button>
        )}
      </div>
      {!actorObjectId && (
        <p className="px-2 py-2 text-2xs text-muted-foreground">Select an object track as the actor.</p>
      )}
      {actorObjectId && (
        <>
          <p className="px-2 pt-1 text-2xs font-mono text-foreground truncate">Actor: {actorObjectId}</p>
          <div className="p-2 space-y-1 max-h-32 overflow-y-auto">
            {enabled.map((def) => (
              <button
                key={def.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs border',
                  actions.activeActionDefId === def.id ? 'border-amber-500 bg-amber-50' : 'border-transparent hover:bg-accent',
                )}
                onClick={() => actions.setActiveActionDefId(def.id)}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: def.color }} />
                <span className="truncate">{def.name}</span>
              </button>
            ))}
          </div>
          {activeDef && (
            <div className="px-2 pb-2 space-y-1">
              {!draft || draft.actionDefId !== activeDef.id ? (
                <button
                  type="button"
                  className="w-full mira-btn-ghost h-8 text-xs flex items-center justify-center gap-1.5"
                  onClick={() => actions.beginInterval(activeDef.id, actorObjectId, currentFrame)}
                >
                  <Minus className="w-3 h-3" /> Start {activeDef.name} · f{currentFrame + 1}
                </button>
              ) : (
                <>
                  <p className="text-2xs text-center text-muted-foreground">
                    Started f{draft.startFrame + 1} — seek end frame
                  </p>
                  <button
                    type="button"
                    className="w-full mira-btn-primary h-8 text-xs"
                    onClick={() =>
                      actions.addActionSpan(activeDef, actorObjectId, draft.startFrame, currentFrame)
                    }
                  >
                    <Plus className="w-3 h-3 inline mr-1" /> End at f{currentFrame + 1}
                  </button>
                  <button type="button" className="w-full mira-btn-ghost h-7 text-2xs" onClick={actions.cancelIntervalDraft}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
      {actions.actions.length > 0 && (
        <p className="px-2 pb-2 text-2xs text-muted-foreground">{actions.actions.length} action span(s)</p>
      )}
    </div>
  )
}
