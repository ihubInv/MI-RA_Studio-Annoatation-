interface PreviewObject {
  id?: string
  class_name: string
  tool_type: string
  geometry: Record<string, unknown>
}

interface Props {
  objects: PreviewObject[]
  width: number
  height: number
  colors?: Record<string, string>
}

function pointsOf(g: Record<string, unknown>): string {
  const raw = g.points as unknown
  if (!Array.isArray(raw) || raw.length === 0) return ''
  if (typeof raw[0] === 'number') {
    const out: string[] = []
    for (let i = 0; i < raw.length - 1; i += 2) out.push(`${raw[i]},${raw[i + 1]}`)
    return out.join(' ')
  }
  return raw
    .map((p: { x?: number; y?: number } | number[]) => {
      if (Array.isArray(p)) return `${p[0]},${p[1]}`
      return `${p.x},${p.y}`
    })
    .join(' ')
}

function firstPoint(g: Record<string, unknown>): { x: number; y: number } {
  if (typeof g.x === 'number' && typeof g.y === 'number') return { x: g.x, y: g.y }
  const raw = g.points as unknown
  if (Array.isArray(raw) && raw.length) {
    const p = raw[0]
    if (typeof p === 'number') return { x: raw[0] as number, y: Number(raw[1]) }
    if (Array.isArray(p)) return { x: Number(p[0]), y: Number(p[1]) }
    return { x: Number((p as { x?: number }).x), y: Number((p as { y?: number }).y) }
  }
  return { x: 0, y: 0 }
}

export function AnnotationOverlay({ objects, width, height, colors = {} }: Props) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const font = Math.max(11, Math.min(16, h * 0.035))

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {objects.map((obj, i) => {
        const g = (obj.geometry || {}) as Record<string, unknown>
        const color = colors[obj.class_name] || '#0d559e'
        const key = obj.id || `${obj.class_name}-${i}`
        const type = obj.tool_type
        const labelAt = firstPoint(g)
        const stroke = { stroke: color, strokeWidth: 1.75, fill: color, fillOpacity: 0.18, vectorEffect: 'non-scaling-stroke' as const }

        const label = (
          <g transform={`translate(${labelAt.x}, ${Math.max(0, labelAt.y - font - 2)})`}>
            <rect width={obj.class_name.length * font * 0.62 + 8} height={font + 4} fill={color} rx={1} />
            <text x={4} y={font} fill="#fff" fontSize={font} fontFamily="Inter, sans-serif" fontWeight={600}>
              {obj.class_name}
            </text>
          </g>
        )

        if (type === 'circle') {
          return (
            <g key={key}>
              <circle cx={Number(g.x)} cy={Number(g.y)} r={Number(g.r || 4)} {...stroke} />
              {label}
            </g>
          )
        }
        if (type === 'ellipse') {
          return (
            <g key={key}>
              <ellipse cx={Number(g.x)} cy={Number(g.y)} rx={Number(g.rx || 1)} ry={Number(g.ry || 1)} {...stroke} />
              {label}
            </g>
          )
        }
        if (type === 'point') {
          return (
            <g key={key}>
              <circle cx={Number(g.x)} cy={Number(g.y)} r={Math.max(w, h) * 0.01} fill={color} />
              {label}
            </g>
          )
        }
        if (type === 'keypoint' || type === 'skeleton') {
          const pts = pointsOf(g)
          return (
            <g key={key}>
              {pts && <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
              {((g.points as unknown[]) || []).map((p, idx) => {
                const x = Array.isArray(p) ? Number(p[0]) : Number((p as { x: number }).x)
                const y = Array.isArray(p) ? Number(p[1]) : Number((p as { y: number }).y)
                return <circle key={idx} cx={x} cy={y} r={Math.max(w, h) * 0.008} fill={color} />
              })}
              {label}
            </g>
          )
        }
        if (['polygon', 'polygon_mask', 'semantic_seg', 'instance_seg', 'freehand_mask', 'area', 'mask'].includes(type)) {
          return (
            <g key={key}>
              <polygon points={pointsOf(g)} {...stroke} />
              {label}
            </g>
          )
        }
        if (['polyline', 'line', 'freehand', 'brush', 'measure', 'arc', 'mask_refine'].includes(type)) {
          return (
            <g key={key}>
              <polyline points={pointsOf(g)} fill="none" stroke={color} strokeWidth={type === 'brush' ? 6 : 1.75} vectorEffect="non-scaling-stroke" />
              {label}
            </g>
          )
        }
        if (type === 'angle') {
          return (
            <g key={key}>
              <polyline points={pointsOf(g)} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
              {label}
            </g>
          )
        }
        if (type === 'cuboid' || type === 'bbox3d') {
          const x = Number(g.x)
          const y = Number(g.y)
          const bw = Number(g.w)
          const bh = Number(g.h)
          const dx = Number(g.dx || bw * 0.28)
          const dy = Number(g.dy || -bh * 0.28)
          return (
            <g key={key}>
              <rect x={x + dx} y={y + dy} width={bw} height={bh} fill="none" stroke={color} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
              <rect x={x} y={y} width={bw} height={bh} {...stroke} />
              <line x1={x} y1={y} x2={x + dx} y2={y + dy} stroke={color} vectorEffect="non-scaling-stroke" />
              <line x1={x + bw} y1={y} x2={x + bw + dx} y2={y + dy} stroke={color} vectorEffect="non-scaling-stroke" />
              <line x1={x + bw} y1={y + bh} x2={x + bw + dx} y2={y + bh + dy} stroke={color} vectorEffect="non-scaling-stroke" />
              <line x1={x} y1={y + bh} x2={x + dx} y2={y + bh + dy} stroke={color} vectorEffect="non-scaling-stroke" />
              {label}
            </g>
          )
        }
        if (type === 'classify' || type === 'multilabel' || type === 'tags') {
          return <g key={key}>{label}</g>
        }

        const x = Number(g.x)
        const y = Number(g.y)
        const bw = Number(g.w)
        const bh = Number(g.h)
        const rot = Number(g.rotation || 0)
        return (
          <g key={key} transform={rot ? `rotate(${rot} ${x + bw / 2} ${y + bh / 2})` : undefined}>
            <rect x={x} y={y} width={bw} height={bh} {...stroke} />
            {label}
          </g>
        )
      })}
    </svg>
  )
}
