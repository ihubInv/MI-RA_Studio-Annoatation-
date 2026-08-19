import { Circle, Ellipse, Group, Line, Rect, Text } from 'react-konva'
import { BRAND } from '@/lib/brand'
import type { Point } from './annTypes'
import { CLOSED_TYPES, angleDegrees, cuboidGeometry } from './geometryDraw'

interface DraftRect {
  x: number
  y: number
  w: number
  h: number
  r?: number
}

interface Props {
  draftRect: DraftRect | null
  draftPoints: Point[]
  cursor: Point
  drawMode: string
  tool: string
  viewScale: number
  classColor?: string
}

export function DraftOverlay({
  draftRect,
  draftPoints,
  cursor,
  drawMode,
  tool,
  viewScale,
  classColor = BRAND.blue,
}: Props) {
  const s = Math.max(viewScale, 0.05)
  const handle = 5 / s
  const font = 10 / s
  const color = classColor
  const closed = CLOSED_TYPES.has(tool) || drawMode === 'polygon'
  const brush = tool === 'brush' || tool === 'mask_refine' || drawMode === 'freehand'

  const halo = {
    stroke: '#ffffff',
    strokeWidth: 3.5,
    strokeScaleEnabled: false as const,
    listening: false,
  }
  const line = {
    stroke: color,
    strokeWidth: brush ? 16 : 1.5,
    strokeScaleEnabled: false as const,
    listening: false,
    fill: closed ? 'rgba(13, 85, 158, 0.12)' : undefined,
    lineCap: (brush ? 'round' : 'square') as 'round' | 'square',
    lineJoin: (brush ? 'round' : 'miter') as 'round' | 'miter',
  }

  const dimBadge = (x: number, y: number, text: string) => (
    <Group x={x} y={y} listening={false}>
      <Rect width={(text.length * 6.4 + 10) / s} height={16 / s} fill="#0d559e" cornerRadius={1 / s} />
      <Text x={5 / s} y={3 / s} text={text} fontSize={font} fontFamily="JetBrains Mono, ui-monospace, monospace" fill="#ffffff" />
    </Group>
  )

  const vertex = (p: Point, i: number, closeTarget = false) => {
    const size = closeTarget ? handle * 1.6 : handle
    return (
      <Rect
        key={i}
        x={p.x - size / 2}
        y={p.y - size / 2}
        width={size}
        height={size}
        fill={closeTarget ? BRAND.orange : '#ffffff'}
        stroke={closeTarget ? '#ffffff' : BRAND.orange}
        strokeWidth={1.25}
        strokeScaleEnabled={false}
        listening={false}
      />
    )
  }

  const livePoints = [...draftPoints, cursor]
  const angleText =
    tool === 'angle' && draftPoints.length >= 2
      ? `${Math.round(angleDegrees(draftPoints[0], draftPoints[1], cursor))}°`
      : null

  return (
    <Group listening={false}>
      {draftRect && drawMode === 'circle' && (
        <>
          <Circle x={draftRect.x} y={draftRect.y} radius={draftRect.r || 0} {...halo} />
          <Circle x={draftRect.x} y={draftRect.y} radius={draftRect.r || 0} {...line} fill="rgba(13, 85, 158, 0.06)" />
          {dimBadge(draftRect.x + (draftRect.r || 0) + 6 / s, draftRect.y - 8 / s, `r ${Math.round(draftRect.r || 0)}px`)}
        </>
      )}

      {draftRect && drawMode === 'ellipse' && (
        <>
          <Ellipse
            x={draftRect.x + draftRect.w / 2}
            y={draftRect.y + draftRect.h / 2}
            radiusX={Math.abs(draftRect.w / 2)}
            radiusY={Math.abs(draftRect.h / 2)}
            {...halo}
          />
          <Ellipse
            x={draftRect.x + draftRect.w / 2}
            y={draftRect.y + draftRect.h / 2}
            radiusX={Math.abs(draftRect.w / 2)}
            radiusY={Math.abs(draftRect.h / 2)}
            stroke={color}
            strokeWidth={1.5}
            fill="rgba(13, 85, 158, 0.06)"
            listening={false}
          />
          {dimBadge(
            draftRect.x + draftRect.w + 6 / s,
            draftRect.y + draftRect.h - 8 / s,
            `${Math.round(draftRect.w)} × ${Math.round(draftRect.h)}`,
          )}
        </>
      )}

      {draftRect && (drawMode === 'rect' || drawMode === 'rotated-rect') && (
        <>
          <Rect x={draftRect.x} y={draftRect.y} width={draftRect.w} height={draftRect.h} {...halo} dash={tool === 'roi' ? [8, 4] : undefined} />
          <Rect
            x={draftRect.x}
            y={draftRect.y}
            width={draftRect.w}
            height={draftRect.h}
            stroke={color}
            strokeWidth={1.5}
            fill="rgba(13, 85, 158, 0.06)"
            dash={tool === 'roi' ? [8, 4] : undefined}
            listening={false}
          />
          {(tool === 'cuboid' || tool === 'bbox3d') &&
            (() => {
              const c = cuboidGeometry(draftRect.x, draftRect.y, draftRect.w, draftRect.h)
              return (
                <>
                  <Rect x={c.x + c.dx} y={c.y + c.dy} width={c.w} height={c.h} stroke={color} dash={[6, 4]} listening={false} />
                  <Line
                    points={[
                      c.x,
                      c.y,
                      c.x + c.dx,
                      c.y + c.dy,
                      c.x + c.w,
                      c.y,
                      c.x + c.w + c.dx,
                      c.y + c.dy,
                      c.x + c.w,
                      c.y + c.h,
                      c.x + c.w + c.dx,
                      c.y + c.h + c.dy,
                      c.x,
                      c.y + c.h,
                      c.x + c.dx,
                      c.y + c.h + c.dy,
                    ]}
                    stroke={color}
                    listening={false}
                  />
                </>
              )
            })()}
          {[
            [draftRect.x, draftRect.y],
            [draftRect.x + draftRect.w, draftRect.y],
            [draftRect.x, draftRect.y + draftRect.h],
            [draftRect.x + draftRect.w, draftRect.y + draftRect.h],
          ].map(([x, y], i) => vertex({ x, y }, i))}
          {dimBadge(
            draftRect.x + draftRect.w + 6 / s,
            draftRect.y + draftRect.h - 8 / s,
            `${Math.round(draftRect.w)} × ${Math.round(draftRect.h)}${drawMode === 'rotated-rect' ? '  rot' : ''}`,
          )}
        </>
      )}

      {draftPoints.length > 0 && (
        <>
          <Line points={livePoints.flatMap((p) => [p.x, p.y])} {...halo} fill={undefined} closed={closed && draftPoints.length >= 3} />
          <Line
            points={livePoints.flatMap((p) => [p.x, p.y])}
            stroke={color}
            strokeWidth={brush ? 16 : 1.5}
            strokeScaleEnabled={false}
            lineJoin={brush ? 'round' : 'miter'}
            lineCap={brush ? 'round' : 'square'}
            closed={closed && draftPoints.length >= 3}
            fill={closed && draftPoints.length >= 3 ? 'rgba(13, 85, 158, 0.12)' : undefined}
          />
          {draftPoints.map((p, i) => vertex(p, i, i === 0 && closed && draftPoints.length >= 3))}
          {vertex(cursor, 99)}
          {angleText && dimBadge(draftPoints[1].x + 8 / s, draftPoints[1].y - 10 / s, angleText)}
        </>
      )}
    </Group>
  )
}
