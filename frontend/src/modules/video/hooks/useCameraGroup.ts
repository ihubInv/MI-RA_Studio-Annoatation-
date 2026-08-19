import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  emptyCameraSlot,
  findGroupForItem,
  loadCameraGroups,
  newCameraGroupId,
  saveCameraGroups,
  type CameraGroup,
  type CameraSlot,
  type VideoCameraGroupSchema,
} from '@/modules/video/multicamera/cameraGroupStore'

export function useCameraGroup(datasetId: string | undefined, currentItemId: string | undefined) {
  const [schema, setSchema] = useState<VideoCameraGroupSchema>(() =>
    loadCameraGroups(datasetId ?? 'default'),
  )

  useEffect(() => {
    if (datasetId) setSchema(loadCameraGroups(datasetId))
  }, [datasetId])

  useEffect(() => {
    if (datasetId) saveCameraGroups(schema)
  }, [schema, datasetId])

  const activeGroup = useMemo(
    () => (currentItemId ? findGroupForItem(schema.groups, currentItemId) : null),
    [schema.groups, currentItemId],
  )

  const isMultiCamera = Boolean(activeGroup && activeGroup.cameras.length > 1)

  const currentSlot = useMemo(
    () => activeGroup?.cameras.find((c) => c.item_id === currentItemId) ?? null,
    [activeGroup, currentItemId],
  )

  const createGroup = useCallback(
    (name: string, masterItemId: string, cameras: CameraSlot[]) => {
      const group: CameraGroup = {
        id: newCameraGroupId(),
        name,
        dataset_id: datasetId ?? 'default',
        master_item_id: masterItemId,
        cameras,
      }
      setSchema((prev) => ({ ...prev, groups: [...prev.groups, group] }))
      return group.id
    },
    [datasetId],
  )

  const addCameraToGroup = useCallback(
    (groupId: string, itemId: string, label: string) => {
      setSchema((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.id === groupId
            ? { ...g, cameras: [...g.cameras, emptyCameraSlot(itemId, label)] }
            : g,
        ),
      }))
    },
    [],
  )

  const updateSlot = useCallback((groupId: string, slotId: string, patch: Partial<CameraSlot>) => {
    setSchema((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? { ...g, cameras: g.cameras.map((c) => (c.id === slotId ? { ...c, ...patch } : c)) }
          : g,
      ),
    }))
  }, [])

  const removeCamera = useCallback((groupId: string, slotId: string) => {
    setSchema((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, cameras: g.cameras.filter((c) => c.id !== slotId) } : g,
      ),
    }))
  }, [])

  const setMaster = useCallback((groupId: string, itemId: string) => {
    setSchema((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, master_item_id: itemId } : g)),
    }))
  }, [])

  return {
    schema,
    setSchema,
    activeGroup,
    isMultiCamera,
    currentSlot,
    createGroup,
    addCameraToGroup,
    updateSlot,
    removeCamera,
    setMaster,
  }
}

export type CameraGroupApi = ReturnType<typeof useCameraGroup>
