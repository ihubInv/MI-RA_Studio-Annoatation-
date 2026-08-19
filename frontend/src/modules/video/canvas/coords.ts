import type { Point } from '@/modules/video/hooks/useCanvasViewport'

export function screenToVideo(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  position: Point,
  scale: number,
): Point {
  const sx = clientX - viewportRect.left
  const sy = clientY - viewportRect.top
  return {
    x: (sx - position.x) / scale,
    y: (sy - position.y) / scale,
  }
}

export function videoToScreen(
  vx: number,
  vy: number,
  position: Point,
  scale: number,
): Point {
  return {
    x: vx * scale + position.x,
    y: vy * scale + position.y,
  }
}
