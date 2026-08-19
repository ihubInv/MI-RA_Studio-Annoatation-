import { useCallback, useEffect, useRef, useState } from 'react'

export const MIN_PX_PER_FRAME = 0.25
export const MAX_PX_PER_FRAME = 24
export const DEFAULT_PX_PER_FRAME = 2

export function useTimelineViewport(frameCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pxPerFrame, setPxPerFrame] = useState(DEFAULT_PX_PER_FRAME)
  const [viewportWidth, setViewportWidth] = useState(0)

  const contentWidth = Math.max(1, frameCount + 1) * pxPerFrame

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const frameAtX = useCallback(
    (clientX: number, containerRect: DOMRect, scrollLeft: number) => {
      const x = clientX - containerRect.left + scrollLeft
      return Math.round(x / pxPerFrame)
    },
    [pxPerFrame],
  )

  const xAtFrame = useCallback((frame: number) => frame * pxPerFrame, [pxPerFrame])

  const zoomTimeline = useCallback((factor: number, anchorFrame?: number) => {
    setPxPerFrame((prev) => {
      const next = Math.min(MAX_PX_PER_FRAME, Math.max(MIN_PX_PER_FRAME, prev * factor))
      const el = scrollRef.current
      if (!el || anchorFrame == null) return next
      const anchorX = anchorFrame * prev
      const ratio = next / prev
      requestAnimationFrame(() => {
        el.scrollLeft = anchorX * ratio - (anchorX - el.scrollLeft)
      })
      return next
    })
  }, [])

  const fitTimeline = useCallback(() => {
    if (!viewportWidth || frameCount <= 0) return
    setPxPerFrame(Math.min(MAX_PX_PER_FRAME, Math.max(MIN_PX_PER_FRAME, viewportWidth / (frameCount + 1))))
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0
    })
  }, [frameCount, viewportWidth])

  const scrollToFrame = useCallback(
    (frame: number) => {
      const el = scrollRef.current
      if (!el) return
      const x = frame * pxPerFrame
      const left = el.scrollLeft
      const right = left + el.clientWidth
      if (x < left + 40) el.scrollLeft = Math.max(0, x - 40)
      else if (x > right - 40) el.scrollLeft = x - el.clientWidth + 40
    },
    [pxPerFrame],
  )

  return {
    scrollRef,
    pxPerFrame,
    contentWidth,
    viewportWidth,
    frameAtX,
    xAtFrame,
    zoomTimeline,
    fitTimeline,
    scrollToFrame,
    setPxPerFrame,
  }
}

export type TimelineViewport = ReturnType<typeof useTimelineViewport>
