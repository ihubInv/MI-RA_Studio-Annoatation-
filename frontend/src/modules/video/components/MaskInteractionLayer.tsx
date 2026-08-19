import { useEffect, useRef } from 'react'
import type { Point } from '@/modules/image/canvas/annTypes'
import type { CanvasViewport } from '@/modules/video/hooks/useCanvasViewport'
import { screenToVideo } from '@/modules/video/canvas/coords'
import type { VideoDisplayMask } from '@/modules/video/canvas/maskInterpolation'
import { hitTestMask } from '@/modules/video/canvas/maskTypes'
import type { VideoTool } from '@/modules/video/canvas/types'
import { isBrushTool, isEraserTool, isMaskPolygonTool } from '@/modules/video/tools/registry'
import { cn } from '@/utils/cn'

interface Props {
  viewport: CanvasViewport
  viewportRef: React.RefObject<HTMLDivElement | null>
  tool: VideoTool
  enabled: boolean
  masks: VideoDisplayMask[]
  selectedId: string | null
  strokeWidth?: number
  strokeColor?: string
  onSelect: (id: string | null) => void
  onBrushStroke: (points: Point[]) => void
  onEraserStroke: (points: Point[], targetId: string) => void
  onPolygonMask: (points: Point[]) => void
  onDraftStroke: (points: Point[] | null) => void
  onPanStart: (e: React.MouseEvent) => boolean
  onPanMove: (e: React.MouseEvent) => void
  onPanEnd: () => void
  isPanning: boolean
}

export function MaskInteractionLayer({
  viewport,
  viewportRef,
  tool,
  enabled,
  masks,
  selectedId,
  onSelect,
  onBrushStroke,
  onEraserStroke,
  onPolygonMask,
  onDraftStroke,
  onPanStart,
  onPanMove,
  onPanEnd,
  isPanning,
}: Props) {
  const stroke = useRef<Point[]>([])
  const eraserTarget = useRef<string | null>(null)
  const polygon = useRef<Point[]>([])

  const active = enabled && (isBrushTool(tool) || isEraserTool(tool) || isMaskPolygonTool(tool))

  const toVideo = (e: React.MouseEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return screenToVideo(e.clientX, e.clientY, rect, viewport.position, viewport.scale)
  }

  const findMaskAt = (pt: Point) => {
    for (const m of [...masks].reverse()) {
      if (m.visible === false || m.locked) continue
      if (hitTestMask(pt.x, pt.y, m)) return m
    }
    return null
  }

  useEffect(() => {
    if (!isMaskPolygonTool(tool)) {
      polygon.current = []
      onDraftStroke(null)
    }
  }, [tool, onDraftStroke])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMaskPolygonTool(tool)) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Enter' && polygon.current.length >= 3) {
        e.preventDefault()
        onPolygonMask([...polygon.current])
        polygon.current = []
        onDraftStroke(null)
      }
      if (e.key === 'Escape') {
        polygon.current = []
        onDraftStroke(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool, onPolygonMask, onDraftStroke])

  if (!active) return null

  const cursor = () => {
    if (isPanning || viewport.spaceHeld.current) return 'cursor-grabbing'
    if (isBrushTool(tool)) return 'cursor-crosshair'
    if (isEraserTool(tool)) return 'cursor-cell'
    if (isMaskPolygonTool(tool)) return 'cursor-crosshair'
    return 'cursor-default'
  }

  const onPointerDown = (e: React.MouseEvent) => {
    if (viewport.spaceHeld.current || e.button === 1) {
      if (onPanStart(e)) return
    }
    const pt = toVideo(e)
    e.preventDefault()
    e.stopPropagation()

    if (isMaskPolygonTool(tool)) {
      polygon.current = [...polygon.current, pt]
      onDraftStroke([...polygon.current])
      return
    }

    if (isEraserTool(tool)) {
      const hit = findMaskAt(pt) ?? masks.find((m) => m.id === selectedId)
      if (!hit) return
      eraserTarget.current = hit.id
      onSelect(hit.id)
      stroke.current = [pt]
      onDraftStroke([pt])
      return
    }

    if (isBrushTool(tool)) {
      stroke.current = [pt]
      onDraftStroke([pt])
    }
  }

  const onPointerMove = (e: React.MouseEvent) => {
    if (stroke.current.length) {
      const pt = toVideo(e)
      stroke.current = [...stroke.current, pt]
      onDraftStroke([...stroke.current])
      return
    }
    onPanMove(e)
  }

  const finishStroke = () => {
    const pts = stroke.current
    stroke.current = []
    onDraftStroke(null)
    if (pts.length < 2) return
    if (isEraserTool(tool) && eraserTarget.current) {
      onEraserStroke(pts, eraserTarget.current)
      eraserTarget.current = null
      return
    }
    if (isBrushTool(tool) && pts.length >= 4) {
      onBrushStroke(pts)
    }
  }

  const onPointerUp = () => {
    finishStroke()
    onPanEnd()
  }

  return (
    <div
      className={cn('absolute inset-0 z-[26]', cursor())}
      onWheel={(e) => {
        const rect = viewportRef.current?.getBoundingClientRect()
        viewport.onWheel(e, {
          x: e.clientX - (rect?.left ?? 0),
          y: e.clientY - (rect?.top ?? 0),
        })
      }}
      onMouseDown={onPointerDown}
      onMouseMove={onPointerMove}
      onMouseUp={onPointerUp}
      onMouseLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onDoubleClick={() => {
        if (isMaskPolygonTool(tool) && polygon.current.length >= 3) {
          onPolygonMask([...polygon.current])
          polygon.current = []
          onDraftStroke(null)
        }
      }}
    />
  )
}
