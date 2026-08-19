import { useCallback, useEffect, useState } from 'react'
import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import {
  compareStores,
  loadVersions,
  nextVersionNumber,
  saveVersions,
  type AnnotationVersion,
} from '@/modules/video/versions/versionStore'

export function useAnnotationVersions(itemId: string | undefined, username: string) {
  const [versions, setVersions] = useState<AnnotationVersion[]>([])

  useEffect(() => {
    if (itemId) setVersions(loadVersions(itemId))
  }, [itemId])

  useEffect(() => {
    if (itemId) saveVersions(itemId, versions)
  }, [itemId, versions])

  const snapshot = useCallback(
    (store: VideoAnnotationStore, label?: string) => {
      const v: AnnotationVersion = {
        id: crypto.randomUUID(),
        version: nextVersionNumber(versions),
        label: label || `v${nextVersionNumber(versions)}`,
        created_at: new Date().toISOString(),
        created_by: username,
        snapshot: store,
      }
      setVersions((prev) => [...prev, v])
      return v
    },
    [versions, username],
  )

  const restore = useCallback((id: string) => versions.find((v) => v.id === id) ?? null, [versions])

  const diff = useCallback(
    (aId: string, bId: string) => {
      const a = versions.find((v) => v.id === aId)
      const b = versions.find((v) => v.id === bId)
      if (!a || !b) return null
      return compareStores(a.snapshot, b.snapshot)
    },
    [versions],
  )

  return { versions, snapshot, restore, diff }
}
