import { useEffect, useRef } from 'react'
import { colorizeDepthImageData, type DepthColormap } from '@/modules/video/rgbd/depthVisualize'

interface Props {
  rgbVideo: HTMLVideoElement | null
  depthSrc: string | null
  currentTime: number
  offsetSec: number
  colormap: DepthColormap
  opacity: number
  enabled: boolean
  width: number
  height: number
}

/** Task 25.1–25.2, 25.5 — depth video overlay, colorized and time-synced to RGB. */
export function DepthOverlay({
  rgbVideo,
  depthSrc,
  currentTime,
  offsetSec,
  colormap,
  opacity,
  enabled,
  width,
  height,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const depthRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const dv = depthRef.current
    if (!dv || !depthSrc) return
    const t = Math.max(0, currentTime + offsetSec)
    if (Math.abs(dv.currentTime - t) > 0.04) dv.currentTime = t
  }, [currentTime, offsetSec, depthSrc])

  useEffect(() => {
    if (!enabled || !width) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.width = width
    canvas.height = height
    const src = depthRef.current?.src ? depthRef.current : rgbVideo
    if (!src || src.readyState < 2) return
    ctx.drawImage(src, 0, 0, width, height)
    const img = ctx.getImageData(0, 0, width, height)
    colorizeDepthImageData(img, colormap, opacity)
    ctx.putImageData(img, 0, 0)
  }, [enabled, width, height, colormap, opacity, currentTime, rgbVideo, depthSrc])

  if (!enabled || !width) return null

  return (
    <>
      {depthSrc && (
        <video ref={depthRef} src={depthSrc} className="hidden" muted playsInline preload="auto" />
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[7] pointer-events-none mix-blend-multiply"
        width={width}
        height={height}
      />
    </>
  )
}
