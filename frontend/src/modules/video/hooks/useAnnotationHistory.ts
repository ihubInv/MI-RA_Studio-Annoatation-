import { useCallback, useRef } from 'react'
import type { VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import type { VideoRectObject } from '@/modules/video/canvas/types'

export interface AnnotationSnapshot {
  rects: VideoRectObject[]
  skeletons: VideoSkeletonObject[]
  masks: VideoMaskObject[]
}

const MAX_HISTORY = 50

function cloneSnapshot(s: AnnotationSnapshot): AnnotationSnapshot {
  return {
    rects: s.rects.map((o) => ({ ...o })),
    skeletons: s.skeletons.map((o) => ({ ...o, joints: o.joints.map((j) => ({ ...j })) })),
    masks: s.masks.map((o) => ({
      ...o,
      rle: { counts: [...o.rle.counts], size: [...o.rle.size] as [number, number] },
      points: o.points?.map((p) => ({ ...p })),
    })),
  }
}

export function useAnnotationHistory() {
  const undoStack = useRef<AnnotationSnapshot[]>([])
  const redoStack = useRef<AnnotationSnapshot[]>([])
  const suppressRef = useRef(false)

  const push = useCallback((snapshot: AnnotationSnapshot) => {
    if (suppressRef.current) return
    undoStack.current.push(cloneSnapshot(snapshot))
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
    redoStack.current = []
  }, [])

  const undo = useCallback((current: AnnotationSnapshot): AnnotationSnapshot | null => {
    const prev = undoStack.current.pop()
    if (!prev) return null
    redoStack.current.push(cloneSnapshot(current))
    suppressRef.current = true
    return cloneSnapshot(prev)
  }, [])

  const redo = useCallback((current: AnnotationSnapshot): AnnotationSnapshot | null => {
    const next = redoStack.current.pop()
    if (!next) return null
    undoStack.current.push(cloneSnapshot(current))
    suppressRef.current = true
    return cloneSnapshot(next)
  }, [])

  const clearSuppress = useCallback(() => {
    suppressRef.current = false
  }, [])

  const reset = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
    suppressRef.current = false
  }, [])

  const canUndo = useCallback(() => undoStack.current.length > 0, [])
  const canRedo = useCallback(() => redoStack.current.length > 0, [])

  return { push, undo, redo, reset, clearSuppress, canUndo, canRedo }
}
