import type { CanvasViewport } from '@/modules/video/hooks/useCanvasViewport'
import type { AiSuggestion } from '@/modules/video/ai/mapAiResults'
import { videoToScreen } from '@/modules/video/canvas/coords'

const HINT_COLORS: Record<string, string> = {
  keyframe: '#0ea5e9',
  gap: '#f59e0b',
  low_confidence: '#eab308',
  id_switch: '#ef4444',
  reid: '#8b5cf6',
}

interface Props {
  viewport: CanvasViewport
  suggestions: AiSuggestion[]
  selectedId?: string | null
  onSelect?: (id: string) => void
}

export function AiSuggestionOverlay({ viewport, suggestions, selectedId, onSelect }: Props) {
  const pending = suggestions.filter((s) => s.status === 'pending')

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      {pending.map((s) => {
        if (s.kind === 'detect') {
          const tl = videoToScreen(s.x, s.y, viewport.position, viewport.scale)
          const br = videoToScreen(s.x + s.width, s.y + s.height, viewport.position, viewport.scale)
          const w = br.x - tl.x
          const h = br.y - tl.y
          const selected = selectedId === s.id
          const lowConf = s.needs_review || s.suggestion_type === 'low_confidence'
          const idSwitch = s.suggestion_type === 'id_switch_suspect'
          const stroke = idSwitch ? '#ef4444' : lowConf ? '#eab308' : selected ? '#ea580c' : '#f97316'
          const label =
            s.track_confidence != null
              ? `${s.class_name} det ${Math.round(s.confidence * 100)}% trk ${Math.round(s.track_confidence * 100)}%`
              : `${s.class_name} ${Math.round(s.confidence * 100)}%`
          return (
            <g key={s.id} className="pointer-events-auto cursor-pointer" onClick={() => onSelect?.(s.id)}>
              <rect
                x={tl.x}
                y={tl.y}
                width={w}
                height={h}
                fill={idSwitch ? 'rgba(239,68,68,0.1)' : lowConf ? 'rgba(234,179,8,0.12)' : 'rgba(255, 140, 0, 0.12)'}
                stroke={stroke}
                strokeWidth={selected ? 2.5 : 1.5}
                strokeDasharray={idSwitch ? '3 3' : '6 4'}
              />
              <text x={tl.x + 4} y={tl.y - 4} fill={stroke} fontSize={11} fontWeight={600}>
                {label}
              </text>
            </g>
          )
        }
        if (s.kind === 'smart_hint') {
          const p = videoToScreen(48, 48, viewport.position, viewport.scale)
          const color = HINT_COLORS[s.hint_type] || '#64748b'
          return (
            <g key={s.id} className="pointer-events-auto cursor-pointer" onClick={() => onSelect?.(s.id)}>
              <circle cx={p.x + (s.frame % 7) * 4} cy={p.y} r={6} fill={color} opacity={0.85} />
              <text x={p.x + 10 + (s.frame % 7) * 4} y={p.y + 4} fill={color} fontSize={10} fontWeight={600}>
                {s.hint_type} f{s.frame + 1}
              </text>
            </g>
          )
        }
        if (s.kind === 'segment' && s.points.length >= 3) {
          const pts = s.points
            .map((p) => videoToScreen(p.x, p.y, viewport.position, viewport.scale))
            .map((p) => `${p.x},${p.y}`)
            .join(' ')
          return (
            <polygon
              key={s.id}
              points={pts}
              fill="rgba(59, 130, 246, 0.15)"
              stroke="#3b82f6"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              className="pointer-events-auto cursor-pointer"
              onClick={() => onSelect?.(s.id)}
            />
          )
        }
        if (s.kind === 'pose') {
          return (
            <g key={s.id}>
              {s.edges.map(([a, b], i) => {
                const ja = s.joints.find((j) => j.joint_id === a)
                const jb = s.joints.find((j) => j.joint_id === b)
                if (!ja || !jb || !ja.visible || !jb.visible) return null
                const pa = videoToScreen(ja.x, ja.y, viewport.position, viewport.scale)
                const pb = videoToScreen(jb.x, jb.y, viewport.position, viewport.scale)
                return (
                  <line
                    key={i}
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke="#a855f7"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                )
              })}
              {s.joints.map((j) => {
                if (!j.visible) return null
                const p = videoToScreen(j.x, j.y, viewport.position, viewport.scale)
                return <circle key={j.joint_id} cx={p.x} cy={p.y} r={4} fill="#a855f7" stroke="#fff" strokeWidth={1} />
              })}
            </g>
          )
        }
        return null
      })}
    </svg>
  )
}
