import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  findLinkForObject,
  loadCrossCameraLinks,
  newCrossCameraLinkId,
  nextGlobalObjectId,
  saveCrossCameraLinks,
  suggestReIdCandidates,
  type CrossCameraLink,
  type CrossCameraSchema,
  type ReIdCandidate,
} from '@/modules/video/multicamera/crossCameraStore'

export function useCrossCameraLinks(datasetId: string | undefined) {
  const [schema, setSchema] = useState<CrossCameraSchema>(() =>
    loadCrossCameraLinks(datasetId ?? 'default'),
  )

  useEffect(() => {
    if (datasetId) setSchema(loadCrossCameraLinks(datasetId))
  }, [datasetId])

  useEffect(() => {
    if (datasetId) saveCrossCameraLinks(schema)
  }, [schema, datasetId])

  const linkObject = useCallback(
    (
      itemId: string,
      objectId: string,
      label: string,
      globalId?: string,
      mergeLinkId?: string,
    ) => {
      const existing = findLinkForObject(schema.links, itemId, objectId)
      if (existing) return existing.id

      if (mergeLinkId) {
        setSchema((prev) => ({
          ...prev,
          links: prev.links.map((l) =>
            l.id === mergeLinkId
              ? {
                  ...l,
                  entries: [...l.entries, { item_id: itemId, object_id: objectId, label }],
                }
              : l,
          ),
        }))
        return mergeLinkId
      }

      const gid = globalId ?? nextGlobalObjectId(schema.links, label)
      const link: CrossCameraLink = {
        id: newCrossCameraLinkId(),
        global_object_id: gid,
        entries: [{ item_id: itemId, object_id: objectId, label }],
      }
      setSchema((prev) => ({ ...prev, links: [...prev.links, link] }))
      return link.id
    },
    [schema.links],
  )

  const unlinkObject = useCallback((itemId: string, objectId: string) => {
    setSchema((prev) => ({
      ...prev,
      links: prev.links
        .map((l) => ({
          ...l,
          entries: l.entries.filter((e) => !(e.item_id === itemId && e.object_id === objectId)),
        }))
        .filter((l) => l.entries.length > 0),
    }))
  }, [])

  const getGlobalId = useCallback(
    (itemId: string, objectId: string) =>
      findLinkForObject(schema.links, itemId, objectId)?.global_object_id ?? null,
    [schema.links],
  )

  const suggestReId = useCallback(
    (
      itemId: string,
      objectId: string,
      label: string,
      masterFrame: number,
      otherObjects: { item_id: string; object_id: string; label: string; frame: number }[],
      fps: number,
    ): ReIdCandidate[] =>
      suggestReIdCandidates(schema.links, itemId, objectId, label, masterFrame, otherObjects, fps),
    [schema.links],
  )

  const links = useMemo(() => schema.links, [schema.links])

  return {
    links,
    linkObject,
    unlinkObject,
    getGlobalId,
    suggestReId,
  }
}

export type CrossCameraApi = ReturnType<typeof useCrossCameraLinks>
