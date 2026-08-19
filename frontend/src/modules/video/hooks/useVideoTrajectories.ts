import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import { generateTrajectoryFromTrack } from '@/modules/video/trajectory/generateTrajectory'
import type { VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'

export function useVideoTrajectories(itemId: string | undefined) {
  const [trajectories, setTrajectories] = useState<VideoTrajectory[]>([])
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState<string | null>(null)
  const [showTrajectories, setShowTrajectories] = useState(true)

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setTrajectories(store.trajectories ?? [])
    setSelectedTrajectoryId(null)
  }, [itemId])

  const persist = useCallback(
    (next: VideoTrajectory[]) => {
      if (!itemId) return
      const store = loadAnnotationStore(itemId)
      saveAnnotationStore(itemId, { ...store, trajectories: next })
    },
    [itemId],
  )

  useEffect(() => {
    if (itemId) persist(trajectories)
  }, [itemId, trajectories, persist])

  const selectedTrajectory = useMemo(
    () => trajectories.find((t) => t.id === selectedTrajectoryId) ?? null,
    [trajectories, selectedTrajectoryId],
  )

  const trajectoryForObject = useCallback(
    (objectId: string) => trajectories.find((t) => t.object_id === objectId) ?? null,
    [trajectories],
  )

  const generateForObject = useCallback(
    (objects: VideoRectObject[], objectId: string, fps: number, maxFrame?: number) => {
      const generated = generateTrajectoryFromTrack(objects, objectId, fps, { maxFrame })
      if (!generated) return null
      setTrajectories((prev) => {
        const without = prev.filter((t) => t.object_id !== objectId)
        return [...without, generated]
      })
      setSelectedTrajectoryId(generated.id)
      return generated
    },
    [],
  )

  const removeForObject = useCallback((objectId: string) => {
    setTrajectories((prev) => {
      const removed = prev.find((t) => t.object_id === objectId)
      if (removed) {
        setSelectedTrajectoryId((cur) => (cur === removed.id ? null : cur))
      }
      return prev.filter((t) => t.object_id !== objectId)
    })
  }, [])

  const toggleVisible = useCallback((id: string) => {
    setTrajectories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)),
    )
  }, [])

  const deleteTrajectory = useCallback((id: string) => {
    setTrajectories((prev) => prev.filter((t) => t.id !== id))
    setSelectedTrajectoryId((cur) => (cur === id ? null : cur))
  }, [])

  return {
    trajectories,
    showTrajectories,
    setShowTrajectories,
    selectedTrajectoryId,
    selectedTrajectory,
    selectTrajectory: setSelectedTrajectoryId,
    trajectoryForObject,
    generateForObject,
    removeForObject,
    toggleVisible,
    deleteTrajectory,
  }
}

export type VideoTrajectoriesApi = ReturnType<typeof useVideoTrajectories>
