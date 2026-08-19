import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { buildSceneTimelineRows, type SceneTimelineRow } from '@/modules/video/scenes/sceneTimeline'
import { newSceneId, type SceneMarkerKind, type VideoScene } from '@/modules/video/scenes/sceneTypes'
import type { SceneDefinition } from '@/modules/video/schema/sceneStore'

export function useVideoScenes(itemId: string | undefined) {
  const [scenes, setScenes] = useState<VideoScene[]>([])
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [activeSceneDefId, setActiveSceneDefId] = useState<string | null>(null)
  const [intervalDraft, setIntervalDraft] = useState<{
    sceneDefId: string
    startFrame: number
  } | null>(null)
  const [detecting, setDetecting] = useState(false)

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setScenes(store.scenes ?? [])
    setSelectedSceneId(null)
    setIntervalDraft(null)
  }, [itemId])

  const persist = useCallback(
    (next: VideoScene[]) => {
      if (!itemId) return
      const store = loadAnnotationStore(itemId)
      saveAnnotationStore(itemId, { ...store, scenes: next })
    },
    [itemId],
  )

  useEffect(() => {
    if (itemId) persist(scenes)
  }, [itemId, scenes, persist])

  const selectedScene = useMemo(
    () => scenes.find((s) => s.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  const timelineRows = useCallback(
    (definitions: SceneDefinition[]): SceneTimelineRow[] => buildSceneTimelineRows(scenes, definitions),
    [scenes],
  )

  const addSceneSpan = useCallback((def: SceneDefinition, startFrame: number, endFrame: number) => {
    const start = Math.min(startFrame, endFrame)
    const end = Math.max(startFrame, endFrame)
    const scene: VideoScene = {
      id: newSceneId(),
      label: def.name,
      color: def.color,
      marker_kind: 'scene',
      scene_type: def.name,
      scene_def_id: def.id,
      frame: start,
      end_frame: end,
      visible: true,
    }
    setScenes((prev) => [...prev, scene])
    setSelectedSceneId(scene.id)
    setIntervalDraft(null)
    return scene.id
  }, [])

  const addMarker = useCallback(
    (def: SceneDefinition, frame: number, kind: 'shot_boundary' | 'camera_cut') => {
      const scene: VideoScene = {
        id: newSceneId(),
        label: def.name,
        color: def.color,
        marker_kind: kind,
        scene_def_id: def.id,
        frame,
        visible: true,
      }
      setScenes((prev) => [...prev, scene])
      setSelectedSceneId(scene.id)
      return scene.id
    },
    [],
  )

  const beginInterval = useCallback((sceneDefId: string, startFrame: number) => {
    setIntervalDraft({ sceneDefId, startFrame })
    setActiveSceneDefId(sceneDefId)
  }, [])

  const cancelIntervalDraft = useCallback(() => setIntervalDraft(null), [])

  const mergeDetected = useCallback((detected: VideoScene[]) => {
    setScenes((prev) => [...prev, ...detected])
  }, [])

  const updateScene = useCallback((id: string, patch: Partial<VideoScene>) => {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s
        const next = { ...s, ...patch }
        if (next.marker_kind !== 'scene') delete next.end_frame
        if (next.end_frame != null && next.end_frame < next.frame) next.end_frame = next.frame
        return next
      }),
    )
  }, [])

  const deleteScene = useCallback((id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id))
    setSelectedSceneId((cur) => (cur === id ? null : cur))
  }, [])

  const deleteSelected = useCallback(() => {
    if (selectedSceneId) deleteScene(selectedSceneId)
  }, [selectedSceneId, deleteScene])

  const clearAutoDetected = useCallback(() => {
    setScenes((prev) => prev.filter((s) => !s.auto_detected))
  }, [])

  return {
    scenes,
    selectedSceneId,
    selectedScene,
    activeSceneDefId,
    setActiveSceneDefId,
    intervalDraft,
    detecting,
    setDetecting,
    timelineRows,
    addSceneSpan,
    addMarker,
    beginInterval,
    cancelIntervalDraft,
    mergeDetected,
    updateScene,
    deleteScene,
    deleteSelected,
    clearAutoDetected,
    selectScene: setSelectedSceneId,
  }
}

export type VideoScenesApi = ReturnType<typeof useVideoScenes>
export type { SceneMarkerKind, VideoScene }
