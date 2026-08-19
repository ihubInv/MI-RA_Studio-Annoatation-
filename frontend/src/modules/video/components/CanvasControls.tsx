import { Minus, Maximize2, Plus } from 'lucide-react'
import type { CanvasViewport } from '@/modules/video/hooks/useCanvasViewport'
import { ZOOM_PRESETS } from '@/modules/video/hooks/useCanvasViewport'
import { cn } from '@/utils/cn'

interface Props {
  viewport: CanvasViewport
  onFit: () => void
  onFullscreenCanvas: () => void
  onAnnotationFullscreen: () => void
  browserFullscreen?: boolean
  annotationFullscreen?: boolean
  className?: string
}

export function CanvasControls({
  viewport,
  onFit,
  onFullscreenCanvas,
  onAnnotationFullscreen,
  browserFullscreen,
  annotationFullscreen,
  className,
}: Props) {
  const { scale, zoomIn, zoomOut, setZoomPreset, fitToView } = viewport
  const pct = Math.round(scale * 100)
  const presetMatch = ZOOM_PRESETS.find((z) => Math.abs(z - scale) < 0.01)

  return (
    <div
      className={cn(
        'absolute top-3 right-3 z-30 flex items-center gap-0.5 bg-white/95 border border-border rounded-md shadow-sm p-0.5',
        className,
      )}
    >
      <button type="button" onClick={() => zoomOut()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent" title="Zoom out">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <select
        value={presetMatch ?? 'custom'}
        onChange={(e) => {
          const v = e.target.value
          if (v === 'fit') {
            fitToView()
            onFit()
          } else if (v !== 'custom') setZoomPreset(Number(v))
        }}
        className="h-7 text-2xs font-mono bg-transparent px-1 min-w-[4.5rem]"
        title="Zoom level"
      >
        <option value="custom">{pct}%</option>
        <option value="fit">Fit canvas</option>
        {ZOOM_PRESETS.map((z) => (
          <option key={z} value={z}>
            {z * 100}%
          </option>
        ))}
      </select>
      <button type="button" onClick={() => zoomIn()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent" title="Zoom in">
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => { fitToView(); onFit() }} className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent" title="Fit canvas">
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => setZoomPreset(1)} className="h-7 px-1.5 text-2xs rounded hover:bg-accent" title="100%">
        100%
      </button>
      <button
        type="button"
        onClick={onFullscreenCanvas}
        className={cn('h-7 px-1.5 text-2xs rounded hover:bg-accent', browserFullscreen && 'bg-primary/10 text-primary')}
        title="Fullscreen canvas"
      >
        {browserFullscreen ? 'Exit FS' : 'Canvas FS'}
      </button>
      <button
        type="button"
        onClick={onAnnotationFullscreen}
        className={cn('h-7 px-1.5 text-2xs rounded hover:bg-accent', annotationFullscreen && 'bg-primary/10 text-primary')}
        title="Fullscreen annotation mode"
      >
        {annotationFullscreen ? 'Exit UI' : 'Annot FS'}
      </button>
    </div>
  )
}
