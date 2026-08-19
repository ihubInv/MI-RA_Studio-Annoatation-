import { ArrowDown, Minus, Plus } from 'lucide-react'
import type { RelationDefinition } from '@/modules/video/schema/relationStore'
import type { VideoRelationsApi } from '@/modules/video/hooks/useVideoRelations'
import type { ObjectManagerEntry } from '@/modules/video/hooks/useVideoAnnotations'
import { cn } from '@/utils/cn'

interface Props {
  definitions: RelationDefinition[]
  relations: VideoRelationsApi
  subjectObjectId: string | null
  objectEntries: ObjectManagerEntry[]
  currentFrame: number
  onOpenManager?: () => void
}

export function RelationPanel({
  definitions,
  relations,
  subjectObjectId,
  objectEntries,
  currentFrame,
  onOpenManager,
}: Props) {
  const enabled = definitions.filter((d) => d.enabled)
  const activeDef = enabled.find((d) => d.id === relations.activeRelationDefId) ?? enabled[0] ?? null
  const targetId = relations.relationTargetId
  const draft = relations.intervalDraft
  const targets = objectEntries.filter((e) => e.object_id !== subjectObjectId)

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1.5 flex items-center justify-between bg-teal-50/50">
        <p className="mira-section-label mb-0 text-teal-900">Relationships</p>
        {onOpenManager && (
          <button type="button" className="text-2xs text-muted-foreground hover:text-foreground" onClick={onOpenManager}>
            Manage
          </button>
        )}
      </div>
      {!subjectObjectId && (
        <p className="px-2 py-2 text-2xs text-muted-foreground">Select subject track (e.g. Person_001).</p>
      )}
      {subjectObjectId && (
        <>
          <div className="px-3 py-2 text-center text-xs font-mono bg-muted/20 mx-2 mt-1 rounded-md">
            <div>{subjectObjectId}</div>
            <ArrowDown className="w-3 h-3 mx-auto text-muted-foreground my-0.5" />
            <div className="text-teal-700">{activeDef?.name ?? 'relation'}</div>
            <ArrowDown className="w-3 h-3 mx-auto text-muted-foreground my-0.5" />
            <select
              className="mira-input h-7 text-xs w-full font-mono mt-0.5"
              value={targetId ?? ''}
              onChange={(e) => relations.setRelationTargetId(e.target.value || null)}
            >
              <option value="">Select object…</option>
              {targets.map((t) => (
                <option key={t.object_id} value={t.object_id}>{t.object_id}</option>
              ))}
            </select>
          </div>
          <div className="p-2 space-y-1 max-h-28 overflow-y-auto">
            {enabled.map((def) => (
              <button
                key={def.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs border',
                  relations.activeRelationDefId === def.id ? 'border-teal-500 bg-teal-50' : 'border-transparent hover:bg-accent',
                )}
                onClick={() => relations.setActiveRelationDefId(def.id)}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: def.color }} />
                <span className="truncate">{def.name}</span>
              </button>
            ))}
          </div>
          {activeDef && targetId && (
            <div className="px-2 pb-2 space-y-1">
              {!draft || draft.relationDefId !== activeDef.id ? (
                <button
                  type="button"
                  className="w-full mira-btn-ghost h-8 text-xs"
                  onClick={() =>
                    relations.beginInterval(activeDef.id, subjectObjectId, targetId, currentFrame)
                  }
                >
                  <Minus className="w-3 h-3 inline mr-1" /> Start · f{currentFrame + 1}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="w-full mira-btn-primary h-8 text-xs"
                    onClick={() =>
                      relations.addRelationSpan(
                        activeDef,
                        subjectObjectId,
                        targetId,
                        draft.startFrame,
                        currentFrame,
                      )
                    }
                  >
                    <Plus className="w-3 h-3 inline mr-1" /> End at f{currentFrame + 1}
                  </button>
                  <button type="button" className="w-full mira-btn-ghost h-7 text-2xs" onClick={relations.cancelIntervalDraft}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
