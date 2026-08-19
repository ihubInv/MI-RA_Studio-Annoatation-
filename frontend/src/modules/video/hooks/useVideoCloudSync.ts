import { useEffect, useRef, useState } from 'react'
import { annotationsService } from '@/services/annotations.service'
import { saveAnnotationLocalFirst } from '@/features/datasets/local/syncQueue'
import { loadAnnotationStore, saveAnnotationStore, type VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { buildVideoSavePayload, isVideoBundle, objectsToVideoStore } from '@/modules/video/io/serverSync'
import { saveRgbDState } from '@/modules/video/rgbd/rgbdStore'
import { saveLidarState, loadLidarState } from '@/modules/lidar/lidarStore'
import { saveCollab, loadCollab } from '@/modules/video/collab/collabStore'
import { saveReview, loadReview } from '@/modules/video/review/reviewStore'

type SyncState = 'idle' | 'loading' | 'synced' | 'pending' | 'error'

export function useVideoCloudSync(itemId: string | undefined) {
  const [annotationId, setAnnotationId] = useState<string | null>(null)
  const [state, setState] = useState<SyncState>('idle')
  const [error, setError] = useState<string | null>(null)
  const loaded = useRef(false)
  const skipUntil = useRef(0)
  const lastHash = useRef('')
  const idRef = useRef<string | null>(null)

  useEffect(() => {
    idRef.current = annotationId
  }, [annotationId])

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    loaded.current = false
    setState('loading')
    annotationsService
      .latest(itemId)
      .then((ann) => {
        if (cancelled || !ann) {
          if (!cancelled) {
            loaded.current = true
            skipUntil.current = Date.now() + 800
            setState('idle')
          }
          return
        }
        setAnnotationId(ann.id)
        const meta = (ann.metadata || (ann as { meta?: Record<string, unknown> }).meta) as Record<string, unknown> | undefined
        if (isVideoBundle(meta)) {
          saveAnnotationStore(itemId, meta.video_bundle as VideoAnnotationStore)
          if (meta.rgbd) saveRgbDState(itemId, meta.rgbd as never)
          if (meta.lidar) saveLidarState(itemId, { ...loadLidarState(itemId), ...(meta.lidar as object) })
          if (meta.collab) saveCollab(itemId, meta.collab as never)
          if (meta.review) saveReview(itemId, meta.review as never)
        } else if (ann.objects?.length) {
          saveAnnotationStore(itemId, objectsToVideoStore(ann.objects as never))
        }
        skipUntil.current = Date.now() + 1200
        loaded.current = true
        setState('synced')
        lastHash.current = JSON.stringify(loadAnnotationStore(itemId))
        window.dispatchEvent(new CustomEvent('mira-studio-hydrate', { detail: { itemId } }))
      })
      .catch((err) => {
        if (cancelled) return
        loaded.current = true
        setState('error')
        setError(err instanceof Error ? err.message : 'Failed to load server annotations')
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  useEffect(() => {
    if (!itemId) return
    const timer = window.setInterval(() => {
      if (!loaded.current || Date.now() < skipUntil.current) return
      const store = loadAnnotationStore(itemId)
      const hash = JSON.stringify([store, loadReview(itemId), loadCollab(itemId)])
      if (hash === lastHash.current) return
      lastHash.current = hash
      const payload = buildVideoSavePayload(itemId)
      setState('pending')
      saveAnnotationLocalFirst(idRef.current, payload)
        .then(({ annotation, state: s }) => {
          if (annotation?.id) {
            setAnnotationId(annotation.id)
            idRef.current = annotation.id
          }
          setState(s === 'synced' ? 'synced' : s === 'pending' ? 'pending' : 'error')
        })
        .catch(() => setState('error'))
    }, 2500)
    return () => window.clearInterval(timer)
  }, [itemId])

  const flushNow = async () => {
    if (!itemId) return
    const payload = buildVideoSavePayload(itemId)
    const { annotation, state: s } = await saveAnnotationLocalFirst(idRef.current, payload)
    if (annotation?.id) {
      setAnnotationId(annotation.id)
      idRef.current = annotation.id
    }
    setState(s === 'synced' ? 'synced' : 'pending')
    return annotation
  }

  const submit = async () => {
    const saved = await flushNow()
    const id = saved?.id || idRef.current
    if (!id) throw new Error('Nothing to submit yet')
    return annotationsService.submit(id)
  }

  return { annotationId, state, error, flushNow, submit }
}
