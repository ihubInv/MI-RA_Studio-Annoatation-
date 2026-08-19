import { useMemo } from 'react'
import { rleToCanvas } from '@/modules/image/canvas/maskRle'
import { occlusionOpacity } from '@/modules/video/schema/occlusion'
import type { VideoDisplayMask } from '@/modules/video/canvas/maskInterpolation'

interface Props {
  width: number
  height: number
  masks: VideoDisplayMask[]
  selectedId: string | null
  draftStroke?: { points: { x: number; y: number }[]; color: string; width: number } | null
}

export function MaskOverlay({ width, height, masks, selectedId, draftStroke }: Props) {
  const layers = useMemo(
    () =>
      masks.map((m) => ({
        id: m.id,
        canvas: rleToCanvas(m.rle, m.color, m.id === selectedId ? 110 : 85),
        selected: m.id === selectedId,
        object_id: m.object_id,
        interpolated: m.interpolated,
        opacity: occlusionOpacity(m.occlusion ?? 'visible'),
      })),
    [masks, selectedId],
  )

  if (!width || !height) return null

  return (
    <svg
      className="absolute inset-0 z-[12] pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {layers.map((layer) => (
        <g key={layer.id} opacity={layer.opacity}>
          <image
            href={layer.canvas.toDataURL()}
            x={0}
            y={0}
            width={width}
            height={height}
            opacity={layer.interpolated ? 0.75 : 1}
          />
          {layer.selected && layer.object_id && (
            <text x={8} y={height - 8} fill={layer.selected ? '#fff' : '#000'} fontSize={11} fontWeight={600}>
              {layer.object_id}
              {layer.interpolated ? ' · interp' : ''}
            </text>
          )}
        </g>
      ))}
      {draftStroke && draftStroke.points.length > 1 && (
        <polyline
          points={draftStroke.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={draftStroke.color}
          strokeWidth={draftStroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
      )}
    </svg>
  )
}
