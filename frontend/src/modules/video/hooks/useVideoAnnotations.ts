import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import {
  geometryAtFrame,
  isInterpolatedId,
  parseInterpolatedId,
  resolveDisplayObjects,
  type VideoDisplayObject,
} from '@/modules/video/canvas/interpolation'
import {
  isMaskDisplay,
  maskGeometryAtFrame,
  resolveDisplayMasks,
  type VideoDisplayMask,
} from '@/modules/video/canvas/maskInterpolation'
import {
  isSkeletonDisplay,
  resolveDisplaySkeletons,
  skeletonGeometryAtFrame,
  type VideoDisplaySkeleton,
} from '@/modules/video/canvas/skeletonInterpolation'
import { applyBrushStroke, applyEraserStroke, applyPolygonMask } from '@/modules/video/canvas/maskOps'
import type { SegmentationMode, VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import { useAnnotationHistory } from '@/modules/video/hooks/useAnnotationHistory'
import { nextLabeledObjectId } from '@/modules/video/canvas/objectId'
import { newObjectId, type VideoRectObject } from '@/modules/video/canvas/types'
import {
  findKeyframeAt,
  findMaskKeyframeAt,
  findNearestKeyframe,
  findNearestMaskKeyframe,
  findNearestSkeletonKeyframe,
  findSkeletonKeyframeAt,
  tracksFromAllAnnotations,
  videoTracksFromAll,
} from '@/modules/video/timeline/objectTracks'
import {
  mergeTracks as mergeTracksOp,
  splitTrack as splitTrackOp,
  trackBackward as trackBackwardOp,
  trackForward as trackForwardOp,
} from '@/modules/video/timeline/trackOps'

export type VideoDisplayAnnotation = VideoDisplayObject | VideoDisplaySkeleton | VideoDisplayMask

export function loadVideoAnnotations(itemId: string): VideoRectObject[] {
  return loadAnnotationStore(itemId).rects
}

export function saveVideoAnnotations(itemId: string, objects: VideoRectObject[]) {
  const store = loadAnnotationStore(itemId)
  saveAnnotationStore(itemId, { ...store, rects: objects })
}

export interface ObjectManagerEntry {
  object_id: string
  label: string
  color: string
  visible: boolean
  locked: boolean
  instanceIds: string[]
  primaryId: string
  frames: number[]
  kind: 'rect' | 'skeleton' | 'mask'
}

export function useVideoAnnotations(itemId: string | undefined) {
  const [objects, setObjects] = useState<VideoRectObject[]>([])
  const [skeletons, setSkeletons] = useState<VideoSkeletonObject[]>([])
  const [masks, setMasks] = useState<VideoMaskObject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [segmentationMode, setSegmentationMode] = useState<SegmentationMode>('instance')
  const clipboard = useRef<Omit<VideoRectObject, 'id' | 'frame'>[]>([])
  const skeletonClipboard = useRef<Omit<VideoSkeletonObject, 'id' | 'frame'>[]>([])
  const maskClipboard = useRef<Omit<VideoMaskObject, 'id' | 'frame'>[]>([])
  const history = useAnnotationHistory()
  const imageSize = useRef({ w: 1280, h: 720 })

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setObjects(store.rects)
    setSkeletons(store.skeletons)
    setMasks(store.masks)
    setSelectedId(null)
    history.reset()
    const onHydrate = (e: Event) => {
      const id = (e as CustomEvent).detail?.itemId
      if (id !== itemId) return
      const next = loadAnnotationStore(itemId)
      setObjects(next.rects)
      setSkeletons(next.skeletons)
      setMasks(next.masks)
    }
    window.addEventListener('mira-studio-hydrate', onHydrate)
    return () => window.removeEventListener('mira-studio-hydrate', onHydrate)
  }, [itemId])

  useEffect(() => {
    if (itemId) {
      const store = loadAnnotationStore(itemId)
      saveAnnotationStore(itemId, {
        version: 7,
        rects: objects,
        skeletons,
        masks,
        events: store.events ?? [],
        actions: store.actions ?? [],
        relations: store.relations ?? [],
        trajectories: store.trajectories ?? [],
        audio_segments: store.audio_segments ?? [],
        speaker_labels: store.speaker_labels ?? [],
        transcriptions: store.transcriptions ?? [],
        scenes: store.scenes ?? [],
      })
    }
  }, [itemId, objects, skeletons, masks])

  const snapshot = useCallback(
    () => ({ rects: objects, skeletons, masks }),
    [objects, skeletons, masks],
  )

  const pushHistory = useCallback(() => {
    history.push(snapshot())
  }, [history, snapshot])

  const restoreSnapshot = useCallback(
    (s: { rects: VideoRectObject[]; skeletons: VideoSkeletonObject[]; masks: VideoMaskObject[] }) => {
      setObjects(s.rects)
      setSkeletons(s.skeletons)
      setMasks(s.masks)
      history.clearSuppress()
    },
    [history],
  )

  const selectedKeyframe = objects.find((o) => o.id === selectedId) ?? null
  const selectedSkeletonKeyframe = skeletons.find((o) => o.id === selectedId) ?? null
  const selectedMaskKeyframe = masks.find((o) => o.id === selectedId) ?? null

  const displayRectsAtFrame = useCallback(
    (frame: number) => resolveDisplayObjects(objects, frame),
    [objects],
  )

  const displaySkeletonsAtFrame = useCallback(
    (frame: number) => resolveDisplaySkeletons(skeletons, frame),
    [skeletons],
  )

  const displayMasksAtFrame = useCallback(
    (frame: number) => resolveDisplayMasks(masks, frame),
    [masks],
  )

  const displayAtFrame = useCallback(
    (frame: number): VideoDisplayAnnotation[] => [
      ...displayRectsAtFrame(frame),
      ...displaySkeletonsAtFrame(frame),
      ...displayMasksAtFrame(frame),
    ],
    [displayRectsAtFrame, displaySkeletonsAtFrame, displayMasksAtFrame],
  )

  const selectedAtFrame = useCallback(
    (frame: number): VideoDisplayAnnotation | null => {
      if (!selectedId) return null
      const display = displayAtFrame(frame)
      const fromDisplay = display.find((o) => o.id === selectedId)
      if (fromDisplay) return fromDisplay
      if (isInterpolatedId(selectedId)) {
        const objectId = parseInterpolatedId(selectedId)
        return display.find((o) => o.object_id === objectId) ?? null
      }
      return selectedKeyframe ?? selectedSkeletonKeyframe ?? selectedMaskKeyframe
    },
    [selectedId, displayAtFrame, selectedKeyframe, selectedSkeletonKeyframe, selectedMaskKeyframe],
  )

  const allObjectIds = useCallback(
    () => [
      ...objects.map((o) => o.object_id),
      ...skeletons.map((o) => o.object_id),
      ...masks.map((o) => o.object_id),
    ],
    [objects, skeletons, masks],
  )

  const nextObjectIdLabel = useCallback(
    (label: string) => nextLabeledObjectId(label, allObjectIds()),
    [allObjectIds],
  )

  const updateObject = useCallback((id: string, patch: Partial<VideoRectObject>) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const updateSkeleton = useCallback((id: string, patch: Partial<VideoSkeletonObject>) => {
    setSkeletons((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const updateMask = useCallback((id: string, patch: Partial<VideoMaskObject>) => {
    setMasks((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
  }, [])

  const updateByObjectId = useCallback((objectId: string, patch: Partial<VideoRectObject>) => {
    setObjects((prev) => prev.map((o) => (o.object_id === objectId ? { ...o, ...patch } : o)))
  }, [])

  const updateAtFrame = useCallback(
    (id: string, frame: number, patch: Partial<VideoRectObject>) => {
      if (isInterpolatedId(id)) {
        const objectId = parseInterpolatedId(id)
        setObjects((prev) => {
          const existing = findKeyframeAt(prev, objectId, frame)
          if (existing) {
            return prev.map((o) => (o.id === existing.id ? { ...o, ...patch } : o))
          }
          const geom = geometryAtFrame(prev, objectId, frame)
          const source = findNearestKeyframe(prev, objectId, frame)
          if (!source || !geom) return prev
          const newId = newObjectId()
          queueMicrotask(() => setSelectedId(newId))
          const { id: _id, frame: _f, ...rest } = source
          return [...prev, { ...rest, ...geom, ...patch, id: newId, frame, object_id: objectId, locked: false }]
        })
        return
      }
      updateObject(id, patch)
    },
    [updateObject],
  )

  const updateSkeletonAtFrame = useCallback(
    (id: string, frame: number, patch: Partial<VideoSkeletonObject>) => {
      if (isInterpolatedId(id)) {
        const objectId = parseInterpolatedId(id)
        setSkeletons((prev) => {
          const existing = findSkeletonKeyframeAt(prev, objectId, frame)
          if (existing) {
            return prev.map((o) => (o.id === existing.id ? { ...o, ...patch } : o))
          }
          const geom = skeletonGeometryAtFrame(prev, objectId, frame)
          const source = findNearestSkeletonKeyframe(prev, objectId, frame)
          if (!source || !geom) return prev
          const newId = newObjectId()
          queueMicrotask(() => setSelectedId(newId))
          const { id: _id, frame: _f, ...rest } = source
          return [
            ...prev,
            {
              ...rest,
              ...geom,
              ...patch,
              id: newId,
              frame,
              object_id: objectId,
              tool_type: 'skeleton',
              locked: false,
            },
          ]
        })
        return
      }
      updateSkeleton(id, patch)
    },
    [updateSkeleton],
  )

  const updateMaskAtFrame = useCallback(
    (id: string, frame: number, patch: Partial<VideoMaskObject>) => {
      if (isInterpolatedId(id)) {
        const objectId = parseInterpolatedId(id)
        setMasks((prev) => {
          const existing = findMaskKeyframeAt(prev, objectId, frame)
          if (existing) {
            return prev.map((o) => (o.id === existing.id ? { ...o, ...patch } : o))
          }
          const geom = maskGeometryAtFrame(prev, objectId, frame)
          const source = findNearestMaskKeyframe(prev, objectId, frame)
          if (!source || !geom) return prev
          const newId = newObjectId()
          queueMicrotask(() => setSelectedId(newId))
          const { id: _id, frame: _f, ...rest } = source
          return [
            ...prev,
            {
              ...rest,
              ...geom,
              ...patch,
              id: newId,
              frame,
              object_id: objectId,
              locked: false,
            },
          ]
        })
        return
      }
      updateMask(id, patch)
    },
    [updateMask],
  )

  const addObject = useCallback((obj: Omit<VideoRectObject, 'id'>) => {
    const id = newObjectId()
    const withDefaults: VideoRectObject = { visible: true, locked: false, occlusion: 'visible', ...obj, id }
    setObjects((prev) => [...prev, withDefaults])
    setSelectedId(id)
    return id
  }, [])

  const addSkeleton = useCallback((obj: Omit<VideoSkeletonObject, 'id'>) => {
    const id = newObjectId()
    const withDefaults: VideoSkeletonObject = {
      visible: true,
      locked: false,
      occlusion: 'visible',
      ...obj,
      id,
    }
    setSkeletons((prev) => [...prev, withDefaults])
    setSelectedId(id)
    return id
  }, [])

  const addMask = useCallback((obj: Omit<VideoMaskObject, 'id'>) => {
    const id = newObjectId()
    const withDefaults: VideoMaskObject = {
      visible: true,
      locked: false,
      ...obj,
      id,
    }
    setMasks((prev) => [...prev, withDefaults])
    setSelectedId(id)
    return id
  }, [])

  const deleteSelected = useCallback(() => {
    if (!selectedId || isInterpolatedId(selectedId)) return
    setObjects((prev) => prev.filter((o) => o.id !== selectedId))
    setSkeletons((prev) => prev.filter((o) => o.id !== selectedId))
    setMasks((prev) => prev.filter((o) => o.id !== selectedId))
    setSelectedId(null)
  }, [selectedId])

  const copySelected = useCallback(
    (frame: number) => {
      const sel = selectedAtFrame(frame)
      if (!sel) return
      if (isSkeletonDisplay(sel)) {
        const { id: _id, frame: _frame, interpolated: _i, ...rest } = sel
        skeletonClipboard.current = [rest]
        clipboard.current = []
        maskClipboard.current = []
        return
      }
      if (isMaskDisplay(sel)) {
        const { id: _id, frame: _frame, interpolated: _i, ...rest } = sel
        maskClipboard.current = [rest]
        clipboard.current = []
        skeletonClipboard.current = []
        return
      }
      const { id: _id, frame: _frame, interpolated: _i, ...rest } = sel
      clipboard.current = [rest]
      skeletonClipboard.current = []
      maskClipboard.current = []
    },
    [selectedAtFrame],
  )

  const pasteAtFrame = useCallback(
    (frame: number, offset = 16) => {
      const ids = allObjectIds()
      if (maskClipboard.current.length) {
        const created: string[] = []
        setMasks((prev) => {
          const next = [...prev]
          for (const item of maskClipboard.current) {
            const id = newObjectId()
            created.push(id)
            const object_id = nextLabeledObjectId(item.label, ids)
            ids.push(object_id)
            next.push({ ...item, id, frame, object_id, visible: item.visible !== false, locked: false })
          }
          return next
        })
        if (created[0]) setSelectedId(created[0])
        return
      }
      if (skeletonClipboard.current.length) {
        const created: string[] = []
        setSkeletons((prev) => {
          const next = [...prev]
          for (const item of skeletonClipboard.current) {
            const id = newObjectId()
            created.push(id)
            const object_id = nextLabeledObjectId(item.label, ids)
            ids.push(object_id)
            next.push({
              ...item,
              id,
              frame,
              object_id,
              joints: item.joints.map((j) => ({ ...j, x: j.x + offset, y: j.y + offset })),
              visible: item.visible !== false,
              locked: false,
            })
          }
          return next
        })
        if (created[0]) setSelectedId(created[0])
        return
      }
      if (!clipboard.current.length) return
      const created: string[] = []
      setObjects((prev) => {
        const next = [...prev]
        for (const item of clipboard.current) {
          const id = newObjectId()
          created.push(id)
          const object_id = nextLabeledObjectId(item.label, ids)
          ids.push(object_id)
          next.push({
            ...item,
            id,
            frame,
            object_id,
            x: item.x + offset,
            y: item.y + offset,
            visible: item.visible !== false,
            locked: false,
          })
        }
        return next
      })
      if (created[0]) setSelectedId(created[0])
    },
    [allObjectIds],
  )

  const objectsOnFrame = useCallback((frame: number) => displayRectsAtFrame(frame), [displayRectsAtFrame])
  const skeletonsOnFrame = useCallback((frame: number) => displaySkeletonsAtFrame(frame), [displaySkeletonsAtFrame])
  const masksOnFrame = useCallback((frame: number) => displayMasksAtFrame(frame), [displayMasksAtFrame])

  const setContentSize = useCallback((w: number, h: number) => {
    imageSize.current = { w, h }
  }, [])

  const objectEntries = useMemo((): ObjectManagerEntry[] => {
    const map = new Map<string, ObjectManagerEntry>()
    const ingest = (o: VideoRectObject | VideoSkeletonObject | VideoMaskObject, kind: 'rect' | 'skeleton' | 'mask') => {
      const existing = map.get(o.object_id)
      if (!existing) {
        map.set(o.object_id, {
          object_id: o.object_id,
          label: o.label,
          color: o.color,
          visible: o.visible !== false,
          locked: Boolean(o.locked),
          instanceIds: [o.id],
          primaryId: o.id,
          frames: [o.frame],
          kind,
        })
      } else {
        existing.instanceIds.push(o.id)
        if (!existing.frames.includes(o.frame)) existing.frames.push(o.frame)
        existing.visible = existing.visible && o.visible !== false
        existing.locked = existing.locked || Boolean(o.locked)
      }
    }
    for (const o of objects) ingest(o, 'rect')
    for (const o of skeletons) ingest(o, 'skeleton')
    for (const o of masks) ingest(o, 'mask')
    return Array.from(map.values()).sort((a, b) =>
      a.object_id.localeCompare(b.object_id, undefined, { numeric: true }),
    )
  }, [objects, skeletons, masks])

  const timelineTracks = useMemo(() => tracksFromAllAnnotations(objects, skeletons, masks), [objects, skeletons, masks])
  const tracks = useMemo(() => videoTracksFromAll(objects, skeletons, masks), [objects, skeletons, masks])

  const getTrack = useCallback(
    (objectId: string) => tracks.find((t) => t.object_id === objectId) ?? null,
    [tracks],
  )

  const isMaskObjectId = useCallback(
    (objectId: string) => masks.some((m) => m.object_id === objectId),
    [masks],
  )

  const isSkeletonObjectId = useCallback(
    (objectId: string) => skeletons.some((s) => s.object_id === objectId),
    [skeletons],
  )

  const trackForward = useCallback((objectId: string, fromFrame: number, toFrame: number) => {
    if (isMaskObjectId(objectId)) {
      let createdId: string | null = null
      setMasks((prev) => {
        if (findMaskKeyframeAt(prev, objectId, toFrame)) return prev
        const source =
          findMaskKeyframeAt(prev, objectId, fromFrame) ?? findNearestMaskKeyframe(prev, objectId, fromFrame)
        if (!source) return prev
        const geom = maskGeometryAtFrame(prev, objectId, fromFrame)
        if (!geom) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = source
        return [...prev, { ...rest, ...geom, id, frame: toFrame, object_id: objectId }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return
    }
    if (isSkeletonObjectId(objectId)) {
      let createdId: string | null = null
      setSkeletons((prev) => {
        if (findSkeletonKeyframeAt(prev, objectId, toFrame)) return prev
        const source =
          findSkeletonKeyframeAt(prev, objectId, fromFrame) ??
          findNearestSkeletonKeyframe(prev, objectId, fromFrame)
        if (!source) return prev
        const geom = skeletonGeometryAtFrame(prev, objectId, fromFrame)
        if (!geom) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = source
        return [...prev, { ...rest, ...geom, id, frame: toFrame, object_id: objectId }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return
    }
    let createdId: string | null = null
    setObjects((prev) => {
      const before = prev.length
      const next = trackForwardOp(prev, objectId, fromFrame, toFrame, newObjectId)
      if (next.length > before) createdId = next[next.length - 1].id
      return next
    })
    queueMicrotask(() => {
      if (createdId) setSelectedId(createdId)
    })
  }, [isMaskObjectId, isSkeletonObjectId])

  const trackBackward = useCallback((objectId: string, fromFrame: number, toFrame: number) => {
    if (isMaskObjectId(objectId)) {
      let createdId: string | null = null
      setMasks((prev) => {
        if (findMaskKeyframeAt(prev, objectId, toFrame)) return prev
        const source =
          findMaskKeyframeAt(prev, objectId, fromFrame) ?? findNearestMaskKeyframe(prev, objectId, fromFrame)
        if (!source) return prev
        const geom = maskGeometryAtFrame(prev, objectId, fromFrame)
        if (!geom) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = source
        return [...prev, { ...rest, ...geom, id, frame: toFrame, object_id: objectId }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return
    }
    if (isSkeletonObjectId(objectId)) {
      let createdId: string | null = null
      setSkeletons((prev) => {
        if (findSkeletonKeyframeAt(prev, objectId, toFrame)) return prev
        const source =
          findSkeletonKeyframeAt(prev, objectId, fromFrame) ??
          findNearestSkeletonKeyframe(prev, objectId, fromFrame)
        if (!source) return prev
        const geom = skeletonGeometryAtFrame(prev, objectId, fromFrame)
        if (!geom) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = source
        return [...prev, { ...rest, ...geom, id, frame: toFrame, object_id: objectId }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return
    }
    let createdId: string | null = null
    setObjects((prev) => {
      const before = prev.length
      const next = trackBackwardOp(prev, objectId, fromFrame, toFrame, newObjectId)
      if (next.length > before) createdId = next[next.length - 1].id
      return next
    })
    queueMicrotask(() => {
      if (createdId) setSelectedId(createdId)
    })
  }, [isMaskObjectId, isSkeletonObjectId])

  const selectByObjectId = useCallback(
    (objectId: string, preferFrame?: number) => {
      if (preferFrame != null) {
        const display = displayAtFrame(preferFrame)
        const onDisplay = display.find((o) => o.object_id === objectId)
        if (onDisplay) {
          setSelectedId(onDisplay.id)
          return onDisplay
        }
      }
      const mk = masks.filter((o) => o.object_id === objectId)
      if (mk.length) {
        const pick = mk[0]
        setSelectedId(pick.id)
        return pick
      }
      const sk = skeletons.filter((o) => o.object_id === objectId)
      if (sk.length) {
        const pick = sk[0]
        setSelectedId(pick.id)
        return pick
      }
      const matches = objects.filter((o) => o.object_id === objectId)
      if (!matches.length) return null
      const pick = matches[0]
      setSelectedId(pick.id)
      return pick
    },
    [objects, skeletons, masks, displayAtFrame],
  )

  const splitTrackAt = useCallback(
    (objectId: string, atFrame: number) => {
      if (isMaskObjectId(objectId)) {
        let newObjectId: string | null = null
        setMasks((prev) => {
          const trackKfs = prev.filter((o) => o.object_id === objectId)
          const toMove = trackKfs.filter((o) => o.frame >= atFrame)
          if (!toMove.length || toMove.length === trackKfs.length) return prev
          const label = trackKfs[0].label
          newObjectId = nextLabeledObjectId(label, allObjectIds())
          return prev.map((o) =>
            o.object_id === objectId && o.frame >= atFrame ? { ...o, object_id: newObjectId! } : o,
          )
        })
        queueMicrotask(() => {
          if (newObjectId) selectByObjectId(newObjectId, atFrame)
        })
        return newObjectId
      }
      if (isSkeletonObjectId(objectId)) {
        let newObjectId: string | null = null
        setSkeletons((prev) => {
          const trackKfs = prev.filter((o) => o.object_id === objectId)
          const toMove = trackKfs.filter((o) => o.frame >= atFrame)
          if (!toMove.length || toMove.length === trackKfs.length) return prev
          const label = trackKfs[0].label
          newObjectId = nextLabeledObjectId(label, allObjectIds())
          return prev.map((o) =>
            o.object_id === objectId && o.frame >= atFrame ? { ...o, object_id: newObjectId! } : o,
          )
        })
        queueMicrotask(() => {
          if (newObjectId) selectByObjectId(newObjectId, atFrame)
        })
        return newObjectId
      }
      let newObjectId: string | null = null
      setObjects((prev) => {
        const { objects: next, result } = splitTrackOp(prev, objectId, atFrame, (label) =>
          nextLabeledObjectId(label, prev.map((o) => o.object_id)),
        )
        if (result) newObjectId = result.newObjectId
        return next
      })
      queueMicrotask(() => {
        if (newObjectId) selectByObjectId(newObjectId, atFrame)
      })
      return newObjectId
    },
    [isMaskObjectId, isSkeletonObjectId, allObjectIds, selectByObjectId],
  )

  const mergeTracksWith = useCallback(
    (primaryId: string, secondaryId: string) => {
      setObjects((prev) => {
        const { objects: next } = mergeTracksOp(prev, primaryId, secondaryId)
        return next
      })
      setSkeletons((prev) => {
        const primary = prev.filter((o) => o.object_id === primaryId)
        const secondary = prev.filter((o) => o.object_id === secondaryId)
        if (!primary.length || !secondary.length) return prev
        const primaryFrames = new Set(primary.map((o) => o.frame))
        return prev
          .filter((o) => o.object_id !== secondaryId || !primaryFrames.has(o.frame))
          .map((o) =>
            o.object_id === secondaryId
              ? { ...o, object_id: primaryId, label: primary[0].label, color: primary[0].color }
              : o,
          )
      })
      setMasks((prev) => {
        const primary = prev.filter((o) => o.object_id === primaryId)
        const secondary = prev.filter((o) => o.object_id === secondaryId)
        if (!primary.length || !secondary.length) return prev
        const primaryFrames = new Set(primary.map((o) => o.frame))
        return prev
          .filter((o) => o.object_id !== secondaryId || !primaryFrames.has(o.frame))
          .map((o) =>
            o.object_id === secondaryId
              ? { ...o, object_id: primaryId, label: primary[0].label, color: primary[0].color }
              : o,
          )
      })
      queueMicrotask(() => selectByObjectId(primaryId))
    },
    [selectByObjectId],
  )

  const toggleVisible = useCallback((objectId: string) => {
    setObjects((prev) => {
      const group = prev.filter((o) => o.object_id === objectId)
      if (!group.length) return prev
      const nextVisible = !(group.every((o) => o.visible !== false))
      return prev.map((o) => (o.object_id === objectId ? { ...o, visible: nextVisible } : o))
    })
    setSkeletons((prev) => {
      const group = prev.filter((o) => o.object_id === objectId)
      if (!group.length) return prev
      const nextVisible = !(group.every((o) => o.visible !== false))
      return prev.map((o) => (o.object_id === objectId ? { ...o, visible: nextVisible } : o))
    })
    setMasks((prev) => {
      const group = prev.filter((o) => o.object_id === objectId)
      if (!group.length) return prev
      const nextVisible = !(group.every((o) => o.visible !== false))
      return prev.map((o) => (o.object_id === objectId ? { ...o, visible: nextVisible } : o))
    })
  }, [])

  const toggleLocked = useCallback((objectId: string) => {
    setObjects((prev) => {
      const group = prev.filter((o) => o.object_id === objectId)
      if (!group.length) return prev
      const nextLocked = !group.every((o) => o.locked)
      return prev.map((o) => (o.object_id === objectId ? { ...o, locked: nextLocked } : o))
    })
    setSkeletons((prev) => {
      const group = prev.filter((o) => o.object_id === objectId)
      if (!group.length) return prev
      const nextLocked = !group.every((o) => o.locked)
      return prev.map((o) => (o.object_id === objectId ? { ...o, locked: nextLocked } : o))
    })
    setMasks((prev) => {
      const group = prev.filter((o) => o.object_id === objectId)
      if (!group.length) return prev
      const nextLocked = !group.every((o) => o.locked)
      return prev.map((o) => (o.object_id === objectId ? { ...o, locked: nextLocked } : o))
    })
  }, [])

  const createKeyframe = useCallback(
    (objectId: string, frame: number) => {
      if (isMaskObjectId(objectId)) {
        let createdId: string | null = null
        setMasks((prev) => {
          const existing = findMaskKeyframeAt(prev, objectId, frame)
          if (existing) {
            createdId = existing.id
            return prev
          }
          const geom = maskGeometryAtFrame(prev, objectId, frame)
          const source = findNearestMaskKeyframe(prev, objectId, frame)
          if (!source || !geom) return prev
          const id = newObjectId()
          createdId = id
          const { id: _id, frame: _f, ...rest } = source
          return [...prev, { ...rest, ...geom, id, frame, object_id: objectId }]
        })
        queueMicrotask(() => {
          if (createdId) setSelectedId(createdId)
        })
        return createdId
      }
      if (isSkeletonObjectId(objectId)) {
        let createdId: string | null = null
        setSkeletons((prev) => {
          const existing = findSkeletonKeyframeAt(prev, objectId, frame)
          if (existing) {
            createdId = existing.id
            return prev
          }
          const geom = skeletonGeometryAtFrame(prev, objectId, frame)
          const source = findNearestSkeletonKeyframe(prev, objectId, frame)
          if (!source || !geom) return prev
          const id = newObjectId()
          createdId = id
          const { id: _id, frame: _f, ...rest } = source
          return [...prev, { ...rest, ...geom, id, frame, object_id: objectId, tool_type: 'skeleton' }]
        })
        queueMicrotask(() => {
          if (createdId) setSelectedId(createdId)
        })
        return createdId
      }
      let createdId: string | null = null
      setObjects((prev) => {
        const existing = findKeyframeAt(prev, objectId, frame)
        if (existing) {
          createdId = existing.id
          return prev
        }
        const geom = geometryAtFrame(prev, objectId, frame)
        const source = findNearestKeyframe(prev, objectId, frame)
        if (!source || !geom) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = source
        return [...prev, { ...rest, ...geom, id, frame }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return createdId
    },
    [isMaskObjectId, isSkeletonObjectId],
  )

  const moveKeyframe = useCallback((instanceId: string, toFrame: number) => {
    setObjects((prev) => {
      const src = prev.find((o) => o.id === instanceId)
      if (!src || src.locked) return prev
      const conflict = prev.find(
        (o) => o.object_id === src.object_id && o.frame === toFrame && o.id !== instanceId,
      )
      if (conflict) return prev
      return prev.map((o) => (o.id === instanceId ? { ...o, frame: toFrame } : o))
    })
    setSkeletons((prev) => {
      const src = prev.find((o) => o.id === instanceId)
      if (!src || src.locked) return prev
      const conflict = prev.find(
        (o) => o.object_id === src.object_id && o.frame === toFrame && o.id !== instanceId,
      )
      if (conflict) return prev
      return prev.map((o) => (o.id === instanceId ? { ...o, frame: toFrame } : o))
    })
    setMasks((prev) => {
      const src = prev.find((o) => o.id === instanceId)
      if (!src || src.locked) return prev
      const conflict = prev.find(
        (o) => o.object_id === src.object_id && o.frame === toFrame && o.id !== instanceId,
      )
      if (conflict) return prev
      return prev.map((o) => (o.id === instanceId ? { ...o, frame: toFrame } : o))
    })
  }, [])

  const moveKeyframeAt = useCallback((objectId: string, fromFrame: number, toFrame: number) => {
    setObjects((prev) => {
      const src = prev.find((o) => o.object_id === objectId && o.frame === fromFrame)
      if (!src || src.locked) return prev
      const conflict = prev.find((o) => o.object_id === objectId && o.frame === toFrame && o.id !== src.id)
      if (conflict) return prev
      return prev.map((o) => (o.id === src.id ? { ...o, frame: toFrame } : o))
    })
    setSkeletons((prev) => {
      const src = prev.find((o) => o.object_id === objectId && o.frame === fromFrame)
      if (!src || src.locked) return prev
      const conflict = prev.find((o) => o.object_id === objectId && o.frame === toFrame && o.id !== src.id)
      if (conflict) return prev
      return prev.map((o) => (o.id === src.id ? { ...o, frame: toFrame } : o))
    })
    setMasks((prev) => {
      const src = prev.find((o) => o.object_id === objectId && o.frame === fromFrame)
      if (!src || src.locked) return prev
      const conflict = prev.find((o) => o.object_id === objectId && o.frame === toFrame && o.id !== src.id)
      if (conflict) return prev
      return prev.map((o) => (o.id === src.id ? { ...o, frame: toFrame } : o))
    })
  }, [])

  const duplicateKeyframeAt = useCallback((objectId: string, fromFrame: number, toFrame: number) => {
    let createdId: string | null = null
    const maskSrc = masks.find((o) => o.object_id === objectId && o.frame === fromFrame)
    if (maskSrc) {
      setMasks((prev) => {
        if (findMaskKeyframeAt(prev, objectId, toFrame)) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = maskSrc
        return [...prev, { ...rest, id, frame: toFrame, locked: false }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return createdId
    }
    const skSrc = skeletons.find((o) => o.object_id === objectId && o.frame === fromFrame)
    if (skSrc) {
      setSkeletons((prev) => {
        if (findSkeletonKeyframeAt(prev, objectId, toFrame)) return prev
        const id = newObjectId()
        createdId = id
        const { id: _id, frame: _f, ...rest } = skSrc
        return [...prev, { ...rest, id, frame: toFrame, locked: false }]
      })
      queueMicrotask(() => {
        if (createdId) setSelectedId(createdId)
      })
      return createdId
    }
    setObjects((prev) => {
      const src = prev.find((o) => o.object_id === objectId && o.frame === fromFrame)
      if (!src) return prev
      if (findKeyframeAt(prev, objectId, toFrame)) return prev
      const id = newObjectId()
      createdId = id
      const { id: _id, frame: _f, ...rest } = src
      return [...prev, { ...rest, id, frame: toFrame, locked: false }]
    })
    queueMicrotask(() => {
      if (createdId) setSelectedId(createdId)
    })
    return createdId
  }, [masks, skeletons])

  const deleteKeyframe = useCallback((objectId: string, frame: number) => {
    let removedId: string | null = null
    setObjects((prev) => {
      const target = prev.find((o) => o.object_id === objectId && o.frame === frame)
      if (!target || target.locked) return prev
      removedId = target.id
      return prev.filter((o) => o.id !== target.id)
    })
    setSkeletons((prev) => {
      const target = prev.find((o) => o.object_id === objectId && o.frame === frame)
      if (!target || target.locked) return prev
      removedId = target.id
      return prev.filter((o) => o.id !== target.id)
    })
    setMasks((prev) => {
      const target = prev.find((o) => o.object_id === objectId && o.frame === frame)
      if (!target || target.locked) return prev
      removedId = target.id
      return prev.filter((o) => o.id !== target.id)
    })
    queueMicrotask(() => {
      if (removedId) setSelectedId((cur) => (cur === removedId ? null : cur))
    })
  }, [])

  const getKeyframe = useCallback(
    (objectId: string, frame: number) =>
      findKeyframeAt(objects, objectId, frame) ??
      findSkeletonKeyframeAt(skeletons, objectId, frame) ??
      findMaskKeyframeAt(masks, objectId, frame),
    [objects, skeletons, masks],
  )

  const updateSelectedAtFrame = useCallback(
    (frame: number, patch: Partial<VideoRectObject> | Partial<VideoSkeletonObject> | Partial<VideoMaskObject>) => {
      if (!selectedId) return
      const sel = selectedAtFrame(frame)
      if (sel && isMaskDisplay(sel)) {
        updateMaskAtFrame(selectedId, frame, patch as Partial<VideoMaskObject>)
      } else if (sel && isSkeletonDisplay(sel)) {
        updateSkeletonAtFrame(selectedId, frame, patch as Partial<VideoSkeletonObject>)
      } else {
        updateAtFrame(selectedId, frame, patch as Partial<VideoRectObject>)
      }
    },
    [selectedId, selectedAtFrame, updateAtFrame, updateSkeletonAtFrame, updateMaskAtFrame],
  )

  const handleBrushStroke = useCallback(
    (frame: number, points: { x: number; y: number }[], label: string, color: string) => {
      pushHistory()
      const { w, h } = imageSize.current
      const sel = selectedAtFrame(frame)
      const objectId =
        segmentationMode === 'instance' && sel && isMaskDisplay(sel) ? sel.object_id : undefined
      setMasks((prev) => {
        const next = applyBrushStroke(prev, frame, points, {
          label,
          color,
          segmentationMode,
          imageW: w,
          imageH: h,
          objectId,
          selectedMaskId: selectedId,
          allocateObjectId: (l) => nextLabeledObjectId(l, allObjectIds()),
        })
        const touched =
          next.find((m) => m.id === selectedId && m.frame === frame) ??
          next.find((m) => m.frame === frame && !prev.some((p) => p.id === m.id))
        if (touched) queueMicrotask(() => setSelectedId(touched.id))
        return next
      })
    },
    [pushHistory, segmentationMode, selectedAtFrame, selectedId, allObjectIds],
  )

  const handleEraserStroke = useCallback(
    (points: { x: number; y: number }[], targetId: string) => {
      pushHistory()
      const { w, h } = imageSize.current
      setMasks((prev) => applyEraserStroke(prev, targetId, points, w, h))
    },
    [pushHistory],
  )

  const handlePolygonMask = useCallback(
    (frame: number, points: { x: number; y: number }[], label: string, color: string) => {
      pushHistory()
      const { w, h } = imageSize.current
      setMasks((prev) =>
        applyPolygonMask(prev, frame, points, {
          label,
          color,
          segmentationMode,
          imageW: w,
          imageH: h,
          allocateObjectId: (l) => nextLabeledObjectId(l, allObjectIds()),
        }),
      )
    },
    [pushHistory, segmentationMode, allObjectIds],
  )

  const undo = useCallback(() => {
    const prev = history.undo(snapshot())
    if (prev) restoreSnapshot(prev)
  }, [history, snapshot, restoreSnapshot])

  const redo = useCallback(() => {
    const next = history.redo(snapshot())
    if (next) restoreSnapshot(next)
  }, [history, snapshot, restoreSnapshot])

  return {
    objects,
    skeletons,
    masks,
    segmentationMode,
    setSegmentationMode,
    selected: selectedKeyframe ?? selectedSkeletonKeyframe ?? selectedMaskKeyframe,
    selectedAtFrame,
    selectedId,
    setSelectedId,
    updateObject,
    updateAtFrame,
    updateSkeleton,
    updateSkeletonAtFrame,
    updateMask,
    updateMaskAtFrame,
    updateSelectedAtFrame,
    updateByObjectId,
    addObject,
    addSkeleton,
    addMask,
    deleteSelected,
    copySelected,
    pasteAtFrame,
    nextObjectIdLabel,
    objectsOnFrame,
    skeletonsOnFrame,
    masksOnFrame,
    displayAtFrame,
    objectEntries,
    timelineTracks,
    tracks,
    getTrack,
    trackForward,
    trackBackward,
    splitTrackAt,
    mergeTracksWith,
    selectByObjectId,
    toggleVisible,
    toggleLocked,
    existingObjectIds: allObjectIds,
    createKeyframe,
    moveKeyframe,
    moveKeyframeAt,
    deleteKeyframe,
    duplicateKeyframeAt,
    getKeyframe,
    handleBrushStroke,
    handleEraserStroke,
    handlePolygonMask,
    setContentSize,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  }
}

export type VideoAnnotations = ReturnType<typeof useVideoAnnotations>
