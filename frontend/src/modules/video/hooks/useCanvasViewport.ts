import { useCallback, useEffect, useRef, useState } from 'react'

export const ZOOM_PRESETS = [1, 2, 4, 8] as const
export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 16

export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export function useCanvasViewport(contentSize: Size, viewportSize: Size) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 })
  const spaceHeld = useRef(false)
  const panning = useRef(false)
  const panStart = useRef({ px: 0, py: 0, sx: 0, sy: 0 })
  const pannedThisSpace = useRef(false)
  // Avoid "fighting" user interactions: until the user pans/zooms,
  // we auto-fit when content dimensions change (e.g. metadata loads).
  const userModifiedRef = useRef(false)
  const lastFitKeyRef = useRef<string | null>(null)

  const clampScale = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))

  const centerAt = useCallback(
    (nextScale: number) => {
      const cx = (viewportSize.w - contentSize.w * nextScale) / 2
      const cy = (viewportSize.h - contentSize.h * nextScale) / 2
      setPosition({ x: cx, y: cy })
      setScale(nextScale)
    },
    [contentSize.h, contentSize.w, viewportSize.h, viewportSize.w],
  )

  const fitToView = useCallback(() => {
    if (!contentSize.w || !contentSize.h || !viewportSize.w || !viewportSize.h) return
    const fit = Math.min(viewportSize.w / contentSize.w, viewportSize.h / contentSize.h) * 0.92
    centerAt(clampScale(fit))
  }, [centerAt, contentSize.h, contentSize.w, viewportSize.h, viewportSize.w])

  const zoomAt = useCallback(
    (pointer: Point, nextScale: number) => {
      userModifiedRef.current = true
      const clamped = clampScale(nextScale)
      const ratio = clamped / scale
      setPosition({
        x: pointer.x - ratio * (pointer.x - position.x),
        y: pointer.y - ratio * (pointer.y - position.y),
      })
      setScale(clamped)
    },
    [position.x, position.y, scale],
  )

  const zoomIn = useCallback(
    (center?: Point) => {
      zoomAt(center ?? { x: viewportSize.w / 2, y: viewportSize.h / 2 }, scale * 1.2)
    },
    [scale, viewportSize.h, viewportSize.w, zoomAt],
  )

  const zoomOut = useCallback(
    (center?: Point) => {
      zoomAt(center ?? { x: viewportSize.w / 2, y: viewportSize.h / 2 }, scale / 1.2)
    },
    [scale, viewportSize.h, viewportSize.w, zoomAt],
  )

  const setZoomPreset = useCallback(
    (preset: number) => {
      zoomAt({ x: viewportSize.w / 2, y: viewportSize.h / 2 }, preset)
    },
    [viewportSize.h, viewportSize.w, zoomAt],
  )

  const onWheel = useCallback(
    (e: React.WheelEvent, pointer: Point) => {
      e.preventDefault()
      const direction = e.deltaY > 0 ? -1 : 1
      zoomAt(pointer, scale * (direction > 0 ? 1.12 : 1 / 1.12))
    },
    [scale, zoomAt],
  )

  const shouldPan = (e: React.MouseEvent) =>
    e.button === 0 || e.button === 1 || spaceHeld.current

  const onPointerDown = useCallback((e: React.MouseEvent) => {
    if (!shouldPan(e)) return false
    e.preventDefault()
    userModifiedRef.current = true
    panning.current = true
    panStart.current = { px: e.clientX, py: e.clientY, sx: position.x, sy: position.y }
    return true
  }, [position.x, position.y])

  const onPointerMove = useCallback((e: React.MouseEvent) => {
    if (!panning.current) return
    pannedThisSpace.current = true
    setPosition({
      x: panStart.current.sx + (e.clientX - panStart.current.px),
      y: panStart.current.sy + (e.clientY - panStart.current.py),
    })
  }, [])

  const onPointerUp = useCallback(() => {
    panning.current = false
  }, [])

  const bindSpaceKey = useCallback((onSpaceTap?: () => void) => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      spaceHeld.current = true
      pannedThisSpace.current = false
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceHeld.current = false
      if (!pannedThisSpace.current) onSpaceTap?.()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    if (userModifiedRef.current) return
    if (!contentSize.w || !contentSize.h || !viewportSize.w || !viewportSize.h) return
    const fitKey = `${contentSize.w}x${contentSize.h}`
    if (lastFitKeyRef.current === fitKey) return
    fitToView()
    lastFitKeyRef.current = fitKey
  }, [contentSize.w, contentSize.h, viewportSize.w, viewportSize.h, fitToView])

  return {
    scale,
    position,
    spaceHeld,
    isPanning: panning,
    zoomAt,
    zoomIn,
    zoomOut,
    fitToView,
    setZoomPreset,
    centerAt,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    shouldPan,
    bindSpaceKey,
    setScale,
    setPosition,
  }
}

export type CanvasViewport = ReturnType<typeof useCanvasViewport>
