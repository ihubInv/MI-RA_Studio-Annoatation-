import { useEffect, useRef } from 'react'
import type { CanvasViewport } from '@/modules/video/hooks/useCanvasViewport'
import { screenToVideo } from '@/modules/video/canvas/coords'
import type { VideoDisplayMask } from '@/modules/video/canvas/maskInterpolation'
import type { VideoDisplaySkeleton } from '@/modules/video/canvas/skeletonInterpolation'
import { hitTestMask } from '@/modules/video/canvas/maskTypes'
import {
  hitTestJoint,
  hitTestSkeleton,
  type VideoJoint,
  type VideoSkeletonObject,
} from '@/modules/video/canvas/skeletonTypes'
import type { SkeletonTemplate } from '@/modules/video/schema/skeletonTemplateStore'
import { layoutJointsFromTemplate } from '@/modules/video/schema/skeletonTemplateStore'
import {
  aabbFromPoints,
  applyResize,
  clampBbox,
  hitTestShape,
  hitTestVertex,
  isRectShape,
  normalizeDragRect,
  rotatePoint,
  type ResizeHandle,
  type VideoBbox,
  type VideoRectObject,
  type VideoTool,
} from '@/modules/video/canvas/types'
import { isDrawRectTool, isPathTool, isPointTool, isSkeletonTool, toolTypeForDraw } from '@/modules/video/tools/registry'
import { cn } from '@/utils/cn'

type DragMode =
  | { kind: 'draw'; start: { x: number; y: number }; tool_type: 'bbox' | 'rectangle' | 'ellipse' | 'rotated_rect' }
  | { kind: 'move'; id: string; start: { x: number; y: number }; origin: VideoRectObject }
  | { kind: 'resize'; id: string; handle: ResizeHandle }
  | { kind: 'rotate'; id: string; cx: number; cy: number }
  | { kind: 'vertex'; id: string; index: number }
  | { kind: 'sk-joint'; id: string; jointId: string; start: { x: number; y: number }; origin: VideoJoint[] }
  | { kind: 'sk-move'; id: string; start: { x: number; y: number }; origin: VideoJoint[] }

interface Props {
  viewport: CanvasViewport
  viewportRef: React.RefObject<HTMLDivElement | null>
  tool: VideoTool
  enabled: boolean
  contentW: number
  contentH: number
  frame: number
  objects: VideoRectObject[]
  skeletons?: VideoDisplaySkeleton[]
  masks?: VideoDisplayMask[]
  skeletonTemplate?: SkeletonTemplate | null
  selectedId: string | null
  label: string
  color: string
  onNextObjectId: (labelName: string) => string
  onSelect: (id: string | null) => void
  onCreate: (obj: Omit<VideoRectObject, 'id'>) => void
  onUpdate: (id: string, patch: Partial<VideoRectObject>) => void
  onCreateSkeleton?: (obj: Omit<VideoSkeletonObject, 'id'>) => void
  onUpdateSkeleton?: (id: string, patch: Partial<VideoSkeletonObject>) => void
  onPanStart: (e: React.MouseEvent) => boolean
  onPanMove: (e: React.MouseEvent) => void
  onPanEnd: () => void
  isPanning: boolean
  draft: VideoBbox | null
  onDraftChange: (draft: VideoBbox | null) => void
  pathDraft?: { points: { x: number; y: number }[]; closed?: boolean } | null
  onPathDraftChange?: (draft: { points: { x: number; y: number }[]; closed?: boolean } | null) => void
}

const POINT_SIZE = 10

export function AnnotationInteractionLayer({
  viewport,
  viewportRef,
  tool,
  enabled,
  contentW,
  contentH,
  frame,
  objects,
  skeletons = [],
  masks = [],
  skeletonTemplate,
  selectedId: _selectedId,
  label,
  color,
  onNextObjectId,
  onSelect,
  onCreate,
  onUpdate,
  onCreateSkeleton,
  onUpdateSkeleton,
  onPanStart,
  onPanMove,
  onPanEnd,
  isPanning,
  draft,
  onDraftChange,
  pathDraft,
  onPathDraftChange,
}: Props) {
  const drag = useRef<DragMode | null>(null)
  const pathRef = useRef(pathDraft)
  pathRef.current = pathDraft

  const toVideo = (e: React.MouseEvent | MouseEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToVideo(e.clientX, e.clientY, rect, viewport.position, viewport.scale)
  }

  const cursor = () => {
    if (isPanning || viewport.spaceHeld.current || tool === 'pan') return 'cursor-grabbing'
    if (isDrawRectTool(tool) || isSkeletonTool(tool) || isPathTool(tool) || isPointTool(tool)) return 'cursor-crosshair'
    if (tool === 'select') return 'cursor-default'
    return 'cursor-grab'
  }

  const hitRadius = () => 10 / viewport.scale

  const finishPath = () => {
    const draftPath = pathRef.current
    if (!draftPath || !isPathTool(tool)) return
    const min = tool === 'polygon' ? 3 : 2
    if (draftPath.points.length < min) {
      onPathDraftChange?.(null)
      return
    }
    const box = aabbFromPoints(draftPath.points)
    onCreate({
      tool_type: tool === 'polygon' ? 'polygon' : 'polyline',
      object_id: onNextObjectId(label),
      label,
      frame,
      color,
      visible: true,
      locked: false,
      ...box,
      points: draftPath.points,
    })
    onPathDraftChange?.(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') finishPath()
      if (e.key === 'Escape') onPathDraftChange?.(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool, frame, label, color])

  const trySelectSkeleton = (pt: { x: number; y: number }, e: React.MouseEvent): boolean => {
    if (!onUpdateSkeleton) return false
    for (const sk of [...skeletons].reverse()) {
      if (sk.visible === false) continue
      const jointId = hitTestJoint(pt.x, pt.y, sk, hitRadius())
      if (jointId && !sk.locked) {
        e.preventDefault()
        e.stopPropagation()
        onSelect(sk.id)
        drag.current = {
          kind: 'sk-joint',
          id: sk.id,
          jointId,
          start: pt,
          origin: sk.joints.map((j) => ({ ...j })),
        }
        return true
      }
      if (hitTestSkeleton(pt.x, pt.y, sk, hitRadius() * 1.5) && !sk.locked) {
        e.preventDefault()
        e.stopPropagation()
        onSelect(sk.id)
        drag.current = {
          kind: 'sk-move',
          id: sk.id,
          start: pt,
          origin: sk.joints.map((j) => ({ ...j })),
        }
        return true
      }
      if (jointId || hitTestSkeleton(pt.x, pt.y, sk, hitRadius() * 1.5)) {
        e.preventDefault()
        e.stopPropagation()
        onSelect(sk.id)
        return true
      }
    }
    return false
  }

  const onPointerDown = (e: React.MouseEvent) => {
    if (!enabled) return
    if (tool === 'pan' || viewport.spaceHeld.current || e.altKey || e.button === 1 || e.button === 2) {
      if (onPanStart(e)) return
    }
    const drawType = toolTypeForDraw(tool)
    if (drawType) {
      e.preventDefault()
      e.stopPropagation()
      const pt = toVideo(e)
      drag.current = { kind: 'draw', start: pt, tool_type: drawType }
      onDraftChange({ x: pt.x, y: pt.y, width: 0, height: 0 })
      onSelect(null)
      return
    }
    if (isPointTool(tool)) {
      e.preventDefault()
      e.stopPropagation()
      const pt = toVideo(e)
      onCreate({
        tool_type: 'point',
        object_id: onNextObjectId(label),
        label,
        frame,
        color,
        visible: true,
        locked: false,
        x: pt.x - POINT_SIZE / 2,
        y: pt.y - POINT_SIZE / 2,
        width: POINT_SIZE,
        height: POINT_SIZE,
        points: [{ x: pt.x, y: pt.y }],
      })
      return
    }
    if (isPathTool(tool)) {
      e.preventDefault()
      e.stopPropagation()
      const pt = toVideo(e)
      const next = [...(pathDraft?.points ?? []), pt]
      onPathDraftChange?.({ points: next, closed: tool === 'polygon' })
      onSelect(null)
      return
    }
    if (isSkeletonTool(tool) && skeletonTemplate && onCreateSkeleton) {
      e.preventDefault()
      e.stopPropagation()
      const pt = toVideo(e)
      const object_id = onNextObjectId(label)
      onCreateSkeleton({
        object_id,
        label,
        frame,
        tool_type: 'skeleton',
        template_id: skeletonTemplate.id,
        color,
        joints: layoutJointsFromTemplate(skeletonTemplate, pt.x, pt.y),
        edges: [...skeletonTemplate.edges],
        visible: true,
        locked: false,
        occlusion: 'visible',
      })
      return
    }
    if (tool === 'select') {
      const pt = toVideo(e)
      if (trySelectSkeleton(pt, e)) return
      for (const m of [...masks].reverse()) {
        if (m.visible === false) continue
        if (hitTestMask(pt.x, pt.y, m)) {
          e.preventDefault()
          e.stopPropagation()
          onSelect(m.id)
          return
        }
      }
      const frameObjects = [...objects].reverse()
      for (const obj of frameObjects) {
        if (!isRectShape(obj)) continue
        if (obj.visible === false) continue
        const vIdx = hitTestVertex(pt.x, pt.y, obj, 8 / viewport.scale)
        if (vIdx != null && !obj.locked) {
          e.preventDefault()
          e.stopPropagation()
          onSelect(obj.id)
          drag.current = { kind: 'vertex', id: obj.id, index: vIdx }
          return
        }
        if (obj.tool_type === 'rotated_rect' && !obj.locked) {
          const cx = obj.x + obj.width / 2
          const cy = obj.y + obj.height / 2
          const handle = rotatePoint(cx, obj.y - 22, cx, cy, obj.rotation ?? 0)
          if (Math.hypot(pt.x - handle.x, pt.y - handle.y) <= 10 / viewport.scale) {
            e.preventDefault()
            e.stopPropagation()
            onSelect(obj.id)
            drag.current = { kind: 'rotate', id: obj.id, cx, cy }
            return
          }
        }
        const hit = hitTestShape(pt.x, pt.y, obj, 8 / viewport.scale)
        if (hit) {
          e.preventDefault()
          e.stopPropagation()
          onSelect(obj.id)
          if (obj.locked) return
          if (hit === 'move') {
            drag.current = { kind: 'move', id: obj.id, start: pt, origin: { ...obj } }
          } else {
            drag.current = { kind: 'resize', id: obj.id, handle: hit }
          }
          return
        }
      }
      onSelect(null)
    }
  }

  const onPointerMove = (e: React.MouseEvent) => {
    if (drag.current?.kind === 'draw') {
      const pt = toVideo(e)
      onDraftChange(
        clampBbox(normalizeDragRect(drag.current.start.x, drag.current.start.y, pt.x, pt.y), contentW, contentH),
      )
      return
    }
    if (drag.current?.kind === 'move') {
      const pt = toVideo(e)
      const dx = pt.x - drag.current.start.x
      const dy = pt.y - drag.current.start.y
      const origin = drag.current.origin
      const next = clampBbox(
        { x: origin.x + dx, y: origin.y + dy, width: origin.width, height: origin.height },
        contentW,
        contentH,
        origin.tool_type === 'point' ? 4 : 4,
      )
      const patch: Partial<VideoRectObject> = { ...next }
      if (origin.points) {
        patch.points = origin.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      }
      onUpdate(drag.current.id, patch)
      return
    }
    if (drag.current?.kind === 'resize') {
      const { id, handle } = drag.current
      const pt = toVideo(e)
      const obj = objects.find((o) => o.id === id)
      if (!obj || !isRectShape(obj)) return
      let local = pt
      if (obj.tool_type === 'rotated_rect' && (obj.rotation || 0) !== 0) {
        const cx = obj.x + obj.width / 2
        const cy = obj.y + obj.height / 2
        local = rotatePoint(pt.x, pt.y, cx, cy, -(obj.rotation || 0))
      }
      const raw = applyResize(obj, handle, local.x, local.y)
      if (raw.width >= 4 && raw.height >= 4) {
        onUpdate(id, clampBbox(raw, contentW, contentH))
      }
      return
    }
    if (drag.current?.kind === 'rotate') {
      const pt = toVideo(e)
      const deg = (Math.atan2(pt.y - drag.current.cy, pt.x - drag.current.cx) * 180) / Math.PI + 90
      onUpdate(drag.current.id, { rotation: ((deg % 360) + 360) % 360 })
      return
    }
    if (drag.current?.kind === 'vertex') {
      const { id, index } = drag.current
      const pt = toVideo(e)
      const obj = objects.find((o) => o.id === id)
      if (!obj?.points) return
      const points = obj.points.map((p, i) => (i === index ? pt : p))
      onUpdate(obj.id, { points, ...aabbFromPoints(points) })
      return
    }
    if (drag.current?.kind === 'sk-joint' && onUpdateSkeleton) {
      const pt = toVideo(e)
      const { id, jointId, start, origin } = drag.current
      const dx = pt.x - start.x
      const dy = pt.y - start.y
      const joints = origin.map((j) =>
        j.joint_id === jointId ? { ...j, x: j.x + dx, y: j.y + dy } : j,
      )
      onUpdateSkeleton(id, { joints })
      return
    }
    if (drag.current?.kind === 'sk-move' && onUpdateSkeleton) {
      const pt = toVideo(e)
      const { id, start, origin } = drag.current
      const dx = pt.x - start.x
      const dy = pt.y - start.y
      const joints = origin.map((j) => ({ ...j, x: j.x + dx, y: j.y + dy }))
      onUpdateSkeleton(id, { joints })
      return
    }
    if (isPanning || viewport.spaceHeld.current) onPanMove(e)
  }

  const onPointerUp = () => {
    if (drag.current?.kind === 'draw' && draft && draft.width >= 4 && draft.height >= 4) {
      onCreate({
        tool_type: drag.current.tool_type,
        object_id: onNextObjectId(label),
        label,
        frame,
        color,
        visible: true,
        locked: false,
        rotation: 0,
        ...draft,
      })
    }
    drag.current = null
    onDraftChange(null)
    onPanEnd()
  }

  return (
    <div
      className={cn('absolute inset-0 z-20', cursor())}
      onWheel={(e) =>
        viewport.onWheel(e, {
          x: e.clientX - (viewportRef.current?.getBoundingClientRect().left ?? 0),
          y: e.clientY - (viewportRef.current?.getBoundingClientRect().top ?? 0),
        })
      }
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
      onDoubleClick={(e) => {
        if (isPathTool(tool)) {
          e.preventDefault()
          finishPath()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (isPathTool(tool)) finishPath()
      }}
    />
  )
}
