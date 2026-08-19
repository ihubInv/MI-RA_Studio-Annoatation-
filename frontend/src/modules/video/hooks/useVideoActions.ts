import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { buildActionTimelineRows, type ActionTimelineRow } from '@/modules/video/actions/actionTimeline'
import { newActionId, type VideoAction } from '@/modules/video/actions/actionTypes'
import type { ActionDefinition } from '@/modules/video/schema/actionStore'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function useVideoActions(itemId: string | undefined) {
  const [actions, setActions] = useState<VideoAction[]>([])
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const [activeActionDefId, setActiveActionDefId] = useState<string | null>(null)
  const [intervalDraft, setIntervalDraft] = useState<{
    actionDefId: string
    actorId: string
    startFrame: number
  } | null>(null)

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setActions(store.actions ?? [])
    setSelectedActionId(null)
    setIntervalDraft(null)
  }, [itemId])

  const persist = useCallback(
    (next: VideoAction[]) => {
      if (!itemId) return
      const store = loadAnnotationStore(itemId)
      saveAnnotationStore(itemId, { ...store, actions: next })
    },
    [itemId],
  )

  useEffect(() => {
    if (itemId) persist(actions)
  }, [itemId, actions, persist])

  const selectedAction = useMemo(
    () => actions.find((a) => a.id === selectedActionId) ?? null,
    [actions, selectedActionId],
  )

  const timelineRows = useCallback(
    (definitions: ActionDefinition[]): ActionTimelineRow[] =>
      buildActionTimelineRows(actions, definitions),
    [actions],
  )

  const addActionSpan = useCallback(
    (
      def: ActionDefinition,
      actorObjectId: string,
      startFrame: number,
      endFrame: number,
      targetObjectId?: string,
    ) => {
      const start = Math.min(startFrame, endFrame)
      const end = Math.max(startFrame, endFrame)
      const action: VideoAction = {
        id: newActionId(),
        label: def.name,
        color: def.color,
        action_def_id: def.id,
        actor_object_id: actorObjectId,
        target_object_id: targetObjectId,
        frame: start,
        end_frame: end,
        visible: true,
        locked: false,
      }
      setActions((prev) => [...prev, action])
      setSelectedActionId(action.id)
      setIntervalDraft(null)
      return action.id
    },
    [],
  )

  const beginInterval = useCallback((actionDefId: string, actorId: string, startFrame: number) => {
    setIntervalDraft({ actionDefId, actorId, startFrame })
    setActiveActionDefId(actionDefId)
  }, [])

  const cancelIntervalDraft = useCallback(() => setIntervalDraft(null), [])

  const updateAction = useCallback((id: string, patch: Partial<VideoAction>) => {
    setActions((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const next = { ...a, ...patch }
        if (next.end_frame != null && next.end_frame < next.frame) next.end_frame = next.frame
        return next
      }),
    )
  }, [])

  const deleteAction = useCallback((id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id))
    setSelectedActionId((cur) => (cur === id ? null : cur))
  }, [])

  const deleteSelected = useCallback(() => {
    if (selectedActionId) deleteAction(selectedActionId)
  }, [selectedActionId, deleteAction])

  return {
    actions,
    selectedActionId,
    selectedAction,
    activeActionDefId,
    setActiveActionDefId,
    intervalDraft,
    timelineRows,
    addActionSpan,
    beginInterval,
    cancelIntervalDraft,
    updateAction,
    deleteAction,
    deleteSelected,
    selectAction: setSelectedActionId,
  }
}

export type VideoActionsApi = ReturnType<typeof useVideoActions>
