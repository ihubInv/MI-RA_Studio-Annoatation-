import { useCallback, useEffect, useRef } from 'react'
import type { CanvasViewport } from '@/modules/video/hooks/useCanvasViewport'
import { screenToVideo, videoToScreen } from '@/modules/video/canvas/coords'
import type { VideoAiTool } from '@/modules/video/canvas/types'
import { cn } from '@/utils/cn'

interface Props {
  viewport: CanvasViewport
  viewportRef: React.RefObject<HTMLDivElement | null>
  tool: VideoAiTool | null
  enabled: boolean
  segPrompts: { positive: { x: number; y: number }[]; negative: { x: number; y: number }[] }
  onSegPrompt: (positive: { x: number; y: number }[], negative: { x: number; y: number }[]) => void
  onSegFinish: () => void
  onPoseClick: (point: { x: number; y: number }) => void
}

export function AiInteractionLayer({
  viewport,
  viewportRef,
  tool,
  enabled,
  segPrompts,
  onSegPrompt,
  onSegFinish,
  onPoseClick,
}: Props) {
  const layerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (enabled && tool) layerRef.current?.focus()
  }, [enabled, tool])

  const toVideo = useCallback(
    (e: React.MouseEvent) => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return screenToVideo(e.clientX, e.clientY, rect, viewport.position, viewport.scale)
    },
    [viewport.position, viewport.scale, viewportRef],
  )

  if (!enabled || !tool) return null

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pt = toVideo(e)
    if (tool === 'ai_pose') {
      onPoseClick(pt)
      return
    }
    if (tool === 'ai_segment') {
      if (e.altKey || e.button === 2) {
        onSegPrompt(segPrompts.positive, [...segPrompts.negative, pt])
      } else {
        onSegPrompt([...segPrompts.positive, pt], segPrompts.negative)
      }
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (tool !== 'ai_segment') return
    e.preventDefault()
    const pt = toVideo(e)
    onSegPrompt(segPrompts.positive, [...segPrompts.negative, pt])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (tool === 'ai_segment' && e.key === 'Enter' && segPrompts.positive.length) {
      e.preventDefault()
      onSegFinish()
    }
  }

  return (
    <div
      ref={layerRef}
      className={cn('absolute inset-0 z-20 outline-none', tool === 'ai_pose' ? 'cursor-crosshair' : 'cursor-cell')}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="presentation"
    >
      {tool === 'ai_segment' &&
        segPrompts.positive.map((p, i) => {
          const sp = videoToScreen(p.x, p.y, viewport.position, viewport.scale)
          return (
            <div
              key={`p-${i}`}
              className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-emerald-500 ring-2 ring-white"
              style={{ left: sp.x, top: sp.y }}
            />
          )
        })}
      {tool === 'ai_segment' &&
        segPrompts.negative.map((p, i) => {
          const sp = videoToScreen(p.x, p.y, viewport.position, viewport.scale)
          return (
            <div
              key={`n-${i}`}
              className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-red-500 ring-2 ring-white"
              style={{ left: sp.x, top: sp.y }}
            />
          )
        })}
    </div>
  )
}
