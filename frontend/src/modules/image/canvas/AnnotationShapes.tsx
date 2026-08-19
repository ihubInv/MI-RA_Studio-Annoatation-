import { Circle, Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from 'react-konva'
import { useMemo } from 'react'
import { ANNOTATION, BRAND } from '@/lib/brand'
import { toFlatPoints, type AnnShape } from './annTypes'
import { CLOSED_TYPES, MASK_TYPES, POLYLINE_TYPES, asPoints, skeletonEdges } from './geometryDraw'
import { rleToCanvas, type RleMask } from './maskRle'

interface Props {
  shapes: AnnShape[]
  selectedId: string | null
  classColors: Record<string, string>
  showLabels: boolean
  viewScale: number
  onSelect: (id: string) => void
  bindNode: (id: string, node: unknown) => void
  onDragEnd: (id: string, x: number, y: number) => void
  onTranslatePoints: (id: string, dx: number, dy: number) => void
  toolSelect: boolean
}

function strokeOf(shape: AnnShape, selected: boolean, colors: Record<string, string>) {
  if (selected) return ANNOTATION.selected
  return colors[shape.class_name] || ANNOTATION.normal
}

function centroidOf(shape: AnnShape) {
  const g = shape.geometry
  const pts = asPoints(g.points)
  if (pts.length) {
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    }
  }
  return {
    x: Number(g.x || 0) + Number(g.w || 0) / 2,
    y: Number(g.y || 0) + Number(g.h || 0) / 2,
  }
}

function MaskFill({ rle, color }: { rle: RleMask; color: string }) {
  const canvas = useMemo(() => rleToCanvas(rle, color), [rle, color])
  return <KonvaImage image={canvas} listening={false} />
}

export function AnnotationShapes({
  shapes,
  selectedId,
  classColors,
  showLabels,
  viewScale,
  onSelect,
  bindNode,
  onDragEnd,
  onTranslatePoints,
  toolSelect,
}: Props) {
  const s = Math.max(viewScale, 0.05)
  const handle = 5 / s

  return (
    <>
      {shapes
        .filter((sh) => sh.visible !== false)
        .map((shape) => {
          const selected = shape.clientId === selectedId
          const color = strokeOf(shape, selected, classColors)
          const draggable = toolSelect && !shape.locked
          const g = shape.geometry
          const type = shape.tool_type
          const lineW = selected ? 1.75 : MASK_TYPES.has(type) ? 1.25 : 1.5
          const fill = selected
            ? ANNOTATION.selectedFill
            : MASK_TYPES.has(type)
              ? color + '55'
              : ANNOTATION.fill
          const pointList = asPoints(g.points)
          const labelAt = {
            x: Number(g.x ?? pointList[0]?.x ?? 0),
            y: Number(g.y ?? pointList[0]?.y ?? 0) - 18 / s,
          }
          const extra =
            type === 'measure' && g.length != null
              ? ` ${g.length}px`
              : type === 'angle' && g.degrees != null
                ? ` ${g.degrees}°`
                : type === 'area' && g.area != null
                  ? ` ${g.area}px²`
                  : shape.track_id
                    ? ` #${shape.track_id}`
                    : ''
          const label = showLabels ? (
            <Group x={labelAt.x} y={labelAt.y} listening={false}>
              <Rect
                width={((shape.class_name + extra).length * 6.2 + 10) / s}
                height={14 / s}
                fill={color}
                cornerRadius={1 / s}
              />
              <Text
                x={5 / s}
                y={2 / s}
                text={`${shape.class_name}${extra}`}
                fontSize={10 / s}
                fontFamily="Inter"
                fontStyle="500"
                fill="#ffffff"
              />
            </Group>
          ) : null

          const halo = {
            stroke: '#ffffff',
            strokeWidth: 3.5,
            strokeScaleEnabled: false as const,
            listening: false,
          }
          const hit = {
            strokeScaleEnabled: false as const,
            listening: true,
            onClick: () => onSelect(shape.clientId),
            onTap: () => onSelect(shape.clientId),
          }

          if (type === 'classify' || type === 'multilabel' || type === 'tags') {
            return (
              <Group key={shape.clientId} listening={false}>
                {label}
              </Group>
            )
          }

          if (type === 'circle') {
            return (
              <Group key={shape.clientId}>
                <Circle x={Number(g.x)} y={Number(g.y)} radius={Number(g.r || 4)} {...halo} />
                <Circle
                  name={shape.clientId}
                  x={Number(g.x)}
                  y={Number(g.y)}
                  radius={Number(g.r || 4)}
                  stroke={color}
                  strokeWidth={lineW}
                  fill={fill}
                  ref={(n) => bindNode(shape.clientId, n)}
                  draggable={draggable}
                  onDragEnd={(e) => onDragEnd(shape.clientId, e.target.x(), e.target.y())}
                  {...hit}
                />
                {label}
              </Group>
            )
          }

          if (type === 'ellipse') {
            return (
              <Group key={shape.clientId}>
                <Ellipse x={Number(g.x)} y={Number(g.y)} radiusX={Number(g.rx || 1)} radiusY={Number(g.ry || 1)} {...halo} />
                <Ellipse
                  name={shape.clientId}
                  x={Number(g.x)}
                  y={Number(g.y)}
                  radiusX={Number(g.rx || 1)}
                  radiusY={Number(g.ry || 1)}
                  stroke={color}
                  strokeWidth={lineW}
                  fill={fill}
                  ref={(n) => bindNode(shape.clientId, n)}
                  draggable={draggable}
                  onDragEnd={(e) => onDragEnd(shape.clientId, e.target.x(), e.target.y())}
                  {...hit}
                />
                {label}
              </Group>
            )
          }

          if (type === 'point') {
            return (
              <Group key={shape.clientId}>
                <Circle x={Number(g.x)} y={Number(g.y)} radius={handle} fill="#ffffff" listening={false} />
                <Circle
                  name={shape.clientId}
                  x={Number(g.x)}
                  y={Number(g.y)}
                  radius={handle * 0.55}
                  fill={color}
                  onClick={() => onSelect(shape.clientId)}
                />
                {label}
              </Group>
            )
          }

          if (type === 'cuboid' || type === 'bbox3d') {
            const x = Number(g.x)
            const y = Number(g.y)
            const w = Number(g.w)
            const h = Number(g.h)
            const dx = Number(g.dx || w * 0.28)
            const dy = Number(g.dy || -h * 0.28)
            const front = [x, y, x + w, y, x + w, y + h, x, y + h]
            const back = [x + dx, y + dy, x + w + dx, y + dy, x + w + dx, y + h + dy, x + dx, y + h + dy]
            const links = [0, 1, 2, 3].flatMap((i) => [front[i * 2], front[i * 2 + 1], back[i * 2], back[i * 2 + 1]])
            return (
              <Group
                key={shape.clientId}
                name={shape.clientId}
                draggable={draggable}
                onDragEnd={(e) => {
                  onDragEnd(shape.clientId, x + e.target.x(), y + e.target.y())
                  e.target.x(0)
                  e.target.y(0)
                }}
                {...hit}
              >
                <Line points={back} closed {...halo} />
                <Line points={back} closed stroke={color} strokeWidth={1} dash={[6, 4]} fill={undefined} listening={false} />
                <Line points={links} stroke="#ffffff" strokeWidth={3} listening={false} />
                <Line points={links} stroke={color} strokeWidth={1} listening={false} />
                <Rect x={x} y={y} width={w} height={h} stroke={color} strokeWidth={lineW} fill={fill} />
                {label}
              </Group>
            )
          }

          if (type === 'keypoint' || type === 'skeleton') {
            const edges = (g.edges as [number, number][] | undefined) || skeletonEdges(pointList.length)
            return (
              <Group
                key={shape.clientId}
                name={shape.clientId}
                draggable={draggable}
                onDragEnd={(e) => {
                  onTranslatePoints(shape.clientId, e.target.x(), e.target.y())
                  e.target.x(0)
                  e.target.y(0)
                }}
                onClick={() => onSelect(shape.clientId)}
              >
                {edges.map(([a, b], i) =>
                  pointList[a] && pointList[b] ? (
                    <Line
                      key={i}
                      points={[pointList[a].x, pointList[a].y, pointList[b].x, pointList[b].y]}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeScaleEnabled={false}
                      listening={false}
                    />
                  ) : null,
                )}
                {pointList.map((p, i) => (
                  <Group key={`${shape.clientId}-${i}`}>
                    <Circle
                      x={p.x}
                      y={p.y}
                      radius={handle * 0.9}
                      fill={i === 0 ? BRAND.orange : '#ffffff'}
                      stroke={color}
                      strokeWidth={1}
                    />
                    <Text x={p.x + 6 / s} y={p.y - 6 / s} text={String(i + 1)} fontSize={9 / s} fill={color} listening={false} />
                  </Group>
                ))}
                {label}
              </Group>
            )
          }

          if (type === 'angle' && pointList.length >= 3) {
            const [a, v, c] = pointList
            return (
              <Group key={shape.clientId} name={shape.clientId} {...hit}>
                <Line points={[a.x, a.y, v.x, v.y, c.x, c.y]} {...halo} fill={undefined} />
                <Line points={[a.x, a.y, v.x, v.y, c.x, c.y]} stroke={color} strokeWidth={lineW} fill={undefined} />
                {pointList.map((p, i) => (
                  <Rect
                    key={i}
                    x={p.x - handle / 2}
                    y={p.y - handle / 2}
                    width={handle}
                    height={handle}
                    fill={i === 1 ? BRAND.orange : '#fff'}
                    stroke={color}
                    strokeWidth={1}
                    listening={false}
                  />
                ))}
                {label}
              </Group>
            )
          }

          if (CLOSED_TYPES.has(type) || POLYLINE_TYPES.has(type)) {
            const closed = CLOSED_TYPES.has(type)
            const brush = type === 'brush' || type === 'mask_refine'
            const sw = brush ? Number(g.strokeWidth || 16) : lineW
            return (
              <Group key={shape.clientId}>
                {g.rle && typeof g.rle === 'object' ? (
                  <MaskFill rle={g.rle as RleMask} color={color} />
                ) : null}
                <Line
                  points={toFlatPoints(pointList)}
                  closed={closed}
                  lineCap={brush ? 'round' : 'square'}
                  lineJoin={brush ? 'round' : 'miter'}
                  stroke="#ffffff"
                  strokeWidth={brush ? sw + 2 : 3.5}
                  strokeScaleEnabled={false}
                  listening={false}
                />
                <Line
                  name={shape.clientId}
                  points={toFlatPoints(pointList)}
                  closed={closed}
                  lineCap={brush ? 'round' : 'square'}
                  lineJoin={brush ? 'round' : 'miter'}
                  stroke={color}
                  strokeWidth={sw}
                  fill={closed ? fill : undefined}
                  opacity={brush ? 0.85 : 1}
                  draggable={draggable}
                  onDragEnd={(e) => {
                    onTranslatePoints(shape.clientId, e.target.x(), e.target.y())
                    e.target.x(0)
                    e.target.y(0)
                  }}
                  {...hit}
                />
                {selected &&
                  pointList.map((p, i) => (
                    <Rect
                      key={i}
                      x={p.x - handle / 2}
                      y={p.y - handle / 2}
                      width={handle}
                      height={handle}
                      fill="#ffffff"
                      stroke={BRAND.orange}
                      strokeWidth={1}
                      strokeScaleEnabled={false}
                      listening={false}
                    />
                  ))}
                {label}
              </Group>
            )
          }

          const x = Number(g.x)
          const y = Number(g.y)
          const w = Number(g.w)
          const h = Number(g.h)
          const rot = Number(g.rotation || 0)
          return (
            <Group key={shape.clientId}>
              <Rect x={x} y={y} width={w} height={h} rotation={rot} {...halo} dash={type === 'roi' ? [8, 4] : undefined} />
              <Rect
                name={shape.clientId}
                x={x}
                y={y}
                width={w}
                height={h}
                rotation={rot}
                stroke={color}
                strokeWidth={lineW}
                fill={fill}
                dash={type === 'roi' ? [8, 4] : undefined}
                ref={(n) => bindNode(shape.clientId, n)}
                draggable={draggable}
                onDragEnd={(e) => onDragEnd(shape.clientId, e.target.x(), e.target.y())}
                {...hit}
              />
              {selected &&
                [
                  [x, y],
                  [x + w, y],
                  [x, y + h],
                  [x + w, y + h],
                ].map(([hx, hy], i) => (
                  <Rect
                    key={i}
                    x={hx - handle / 2}
                    y={hy - handle / 2}
                    width={handle}
                    height={handle}
                    fill="#ffffff"
                    stroke={BRAND.orange}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                ))}
              {label}
            </Group>
          )
        })}
      {shapes
        .filter((sh) => sh.visible !== false && sh.linked_object_id)
        .map((shape) => {
          const other = shapes.find((s) => s.clientId === shape.linked_object_id)
          if (!other) return null
          const a = centroidOf(shape)
          const b = centroidOf(other)
          const color = classColors[shape.class_name] || ANNOTATION.normal
          return (
            <Group key={`rel-${shape.clientId}`} listening={false}>
              <Line points={[a.x, a.y, b.x, b.y]} stroke="#ffffff" strokeWidth={3} dash={[8, 4]} />
              <Line points={[a.x, a.y, b.x, b.y]} stroke={color} strokeWidth={1.5} dash={[8, 4]} />
              <Text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - 10}
                text={shape.link_relation || 'related'}
                fontSize={10}
                fill={color}
              />
            </Group>
          )
        })}
    </>
  )
}
