import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { buildRelationTimelineRows, type RelationTimelineRow } from '@/modules/video/relations/relationTimeline'
import { newRelationId, type VideoRelation } from '@/modules/video/relations/relationTypes'
import type { RelationDefinition } from '@/modules/video/schema/relationStore'
import { useCallback, useEffect, useMemo, useState } from 'react'

export function useVideoRelations(itemId: string | undefined) {
  const [relations, setRelations] = useState<VideoRelation[]>([])
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null)
  const [activeRelationDefId, setActiveRelationDefId] = useState<string | null>(null)
  const [relationTargetId, setRelationTargetId] = useState<string | null>(null)
  const [intervalDraft, setIntervalDraft] = useState<{
    relationDefId: string
    subjectId: string
    objectId: string
    startFrame: number
  } | null>(null)

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setRelations(store.relations ?? [])
    setSelectedRelationId(null)
    setIntervalDraft(null)
    setRelationTargetId(null)
  }, [itemId])

  const persist = useCallback(
    (next: VideoRelation[]) => {
      if (!itemId) return
      const store = loadAnnotationStore(itemId)
      saveAnnotationStore(itemId, { ...store, relations: next })
    },
    [itemId],
  )

  useEffect(() => {
    if (itemId) persist(relations)
  }, [itemId, relations, persist])

  const selectedRelation = useMemo(
    () => relations.find((r) => r.id === selectedRelationId) ?? null,
    [relations, selectedRelationId],
  )

  const timelineRows = useCallback(
    (definitions: RelationDefinition[]): RelationTimelineRow[] =>
      buildRelationTimelineRows(relations, definitions),
    [relations],
  )

  const addRelationSpan = useCallback(
    (
      def: RelationDefinition,
      subjectObjectId: string,
      objectObjectId: string,
      startFrame: number,
      endFrame: number,
    ) => {
      const start = Math.min(startFrame, endFrame)
      const end = Math.max(startFrame, endFrame)
      const rel: VideoRelation = {
        id: newRelationId(),
        label: def.name,
        color: def.color,
        relation_def_id: def.id,
        subject_object_id: subjectObjectId,
        object_object_id: objectObjectId,
        frame: start,
        end_frame: end,
        visible: true,
        locked: false,
      }
      setRelations((prev) => [...prev, rel])
      setSelectedRelationId(rel.id)
      setIntervalDraft(null)
      return rel.id
    },
    [],
  )

  const beginInterval = useCallback(
    (relationDefId: string, subjectId: string, objectId: string, startFrame: number) => {
      setIntervalDraft({ relationDefId, subjectId, objectId, startFrame })
      setActiveRelationDefId(relationDefId)
    },
    [],
  )

  const cancelIntervalDraft = useCallback(() => setIntervalDraft(null), [])

  const updateRelation = useCallback((id: string, patch: Partial<VideoRelation>) => {
    setRelations((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        if (next.end_frame != null && next.end_frame < next.frame) next.end_frame = next.frame
        return next
      }),
    )
  }, [])

  const deleteRelation = useCallback((id: string) => {
    setRelations((prev) => prev.filter((r) => r.id !== id))
    setSelectedRelationId((cur) => (cur === id ? null : cur))
  }, [])

  const deleteSelected = useCallback(() => {
    if (selectedRelationId) deleteRelation(selectedRelationId)
  }, [selectedRelationId, deleteRelation])

  return {
    relations,
    selectedRelationId,
    selectedRelation,
    activeRelationDefId,
    setActiveRelationDefId,
    relationTargetId,
    setRelationTargetId,
    intervalDraft,
    timelineRows,
    addRelationSpan,
    beginInterval,
    cancelIntervalDraft,
    updateRelation,
    deleteRelation,
    deleteSelected,
    selectRelation: setSelectedRelationId,
  }
}

export type VideoRelationsApi = ReturnType<typeof useVideoRelations>
