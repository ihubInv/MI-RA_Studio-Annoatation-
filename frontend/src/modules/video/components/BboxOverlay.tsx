import type { VideoDisplayObject } from '@/modules/video/canvas/interpolation'
import type { VideoBbox, ResizeHandle } from '@/modules/video/canvas/types'
import { occlusionOpacity, occlusionStrokeDash } from '@/modules/video/schema/occlusion'

interface Props {
  width: number
  height: number
  objects: VideoDisplayObject[]
  selectedId: string | null
  draft?: VideoBbox | null
  draftColor?: string
  draftTool?: 'bbox' | 'rectangle' | 'ellipse' | 'rotated_rect' | null
  pathDraft?: { points: { x: number; y: number }[]; closed?: boolean; color?: string } | null
}

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function handlePos(b: VideoBbox, handle: ResizeHandle) {
  const { x, y, width, height } = b
  switch (handle) {
    case 'nw':
      return { cx: x, cy: y }
    case 'n':
      return { cx: x + width / 2, cy: y }
    case 'ne':
      return { cx: x + width, cy: y }
    case 'e':
      return { cx: x + width, cy: y + height / 2 }
    case 'se':
      return { cx: x + width, cy: y + height }
    case 's':
      return { cx: x + width / 2, cy: y + height }
    case 'sw':
      return { cx: x, cy: y + height }
    case 'w':
      return { cx: x, cy: y + height / 2 }
    default:
      return { cx: x, cy: y }
  }
}

function ptsAttr(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

export function BboxOverlay({
  width,
  height,
  objects,
  selectedId,
  draft,
  draftColor = '#0d559e',
  draftTool = 'bbox',
  pathDraft,
}: Props) {
  if (!width || !height) return null

  return (
    <svg
      className="absolute inset-0 z-10 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {objects.map((obj) => {
        if (obj.visible === false) return null
        const selected = obj.id === selectedId
        const occ = obj.occlusion ?? 'visible'
        const strokeDash = obj.interpolated
          ? '5 3'
          : occlusionStrokeDash(occ) ?? (obj.locked ? '5 3' : undefined)
        const opacity = (obj.interpolated ? 0.85 : 1) * occlusionOpacity(occ)
        const fill = selected ? `${obj.color}22` : `${obj.color}18`
        const cx = obj.x + obj.width / 2
        const cy = obj.y + obj.height / 2
        const label = (
          <text x={obj.x + 4} y={Math.max(12, obj.y - 4)} fill={obj.color} fontSize={11} fontWeight={600} opacity={opacity}>
            {obj.object_id}
            {obj.interpolated ? ' · interp' : ''}
            {occ !== 'visible' ? ` · ${occ.replace(/_/g, ' ')}` : ''}
          </text>
        )
        const handles =
          selected && !obj.locked && !obj.interpolated && obj.tool_type !== 'point' && obj.tool_type !== 'polygon' && obj.tool_type !== 'polyline'
            ? HANDLES.map((h) => {
                const { cx: hx, cy: hy } = handlePos(obj, h)
                return (
                  <rect
                    key={h}
                    x={hx - 4}
                    y={hy - 4}
                    width={8}
                    height={8}
                    fill="white"
                    stroke={obj.color}
                    strokeWidth={1.5}
                  />
                )
              })
            : null
        const verts =
          selected &&
          !obj.locked &&
          !obj.interpolated &&
          obj.points?.map((p, i) => (
            <circle key={`v${i}`} cx={p.x} cy={p.y} r={4} fill="white" stroke={obj.color} strokeWidth={1.5} />
          ))

        if (obj.tool_type === 'ellipse') {
          return (
            <g key={obj.id}>
              <ellipse
                cx={cx}
                cy={cy}
                rx={obj.width / 2}
                ry={obj.height / 2}
                fill={fill}
                stroke={obj.color}
                strokeWidth={selected ? 2.5 : 1.5}
                strokeDasharray={strokeDash}
                opacity={opacity}
              />
              {label}
              {handles}
            </g>
          )
        }
        if (obj.tool_type === 'point') {
          return (
            <g key={obj.id}>
              <circle cx={cx} cy={cy} r={5} fill={obj.color} stroke="white" strokeWidth={selected ? 2 : 1} opacity={opacity} />
              {label}
            </g>
          )
        }
        if (obj.tool_type === 'polygon' && obj.points?.length) {
          return (
            <g key={obj.id}>
              <polygon
                points={ptsAttr(obj.points)}
                fill={fill}
                stroke={obj.color}
                strokeWidth={selected ? 2.5 : 1.5}
                strokeDasharray={strokeDash}
                opacity={opacity}
              />
              {label}
              {verts}
            </g>
          )
        }
        if (obj.tool_type === 'polyline' && obj.points?.length) {
          return (
            <g key={obj.id}>
              <polyline
                points={ptsAttr(obj.points)}
                fill="none"
                stroke={obj.color}
                strokeWidth={selected ? 3 : 2}
                strokeDasharray={strokeDash}
                opacity={opacity}
              />
              {label}
              {verts}
            </g>
          )
        }
        const box = (
          <rect
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={fill}
            stroke={obj.color}
            strokeWidth={selected ? 2.5 : 1.5}
            strokeDasharray={strokeDash}
            opacity={opacity}
          />
        )
        if (obj.tool_type === 'rotated_rect') {
          return (
            <g key={obj.id} transform={`rotate(${obj.rotation ?? 0} ${cx} ${cy})`}>
              {box}
              {label}
              {handles}
              {selected && !obj.locked && !obj.interpolated && (
                <>
                  <line x1={cx} y1={obj.y} x2={cx} y2={obj.y - 22} stroke={obj.color} strokeWidth={1.5} />
                  <circle cx={cx} cy={obj.y - 22} r={5} fill="white" stroke={obj.color} strokeWidth={1.5} />
                </>
              )}
            </g>
          )
        }
        return (
          <g key={obj.id}>
            {box}
            {label}
            {handles}
          </g>
        )
      })}
      {draft && draft.width > 0 && draft.height > 0 && draftTool === 'ellipse' && (
        <ellipse
          cx={draft.x + draft.width / 2}
          cy={draft.y + draft.height / 2}
          rx={draft.width / 2}
          ry={draft.height / 2}
          fill={`${draftColor}15`}
          stroke={draftColor}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
      {draft && draft.width > 0 && draft.height > 0 && draftTool !== 'ellipse' && (
        <rect
          x={draft.x}
          y={draft.y}
          width={draft.width}
          height={draft.height}
          fill={`${draftColor}15`}
          stroke={draftColor}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}
      {pathDraft && pathDraft.points.length > 0 && (
        <>
          <polyline
            points={ptsAttr(pathDraft.points)}
            fill={pathDraft.closed ? `${pathDraft.color ?? draftColor}15` : 'none'}
            stroke={pathDraft.color ?? draftColor}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {pathDraft.points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3} fill={pathDraft.color ?? draftColor} />
          ))}
        </>
      )}
    </svg>
  )
}
