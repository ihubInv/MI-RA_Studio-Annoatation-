import type { VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'
import { directionDeg } from '@/modules/video/trajectory/trajectoryMetrics'

interface Props {
  width: number
  height: number
  trajectories: VideoTrajectory[]
  currentFrame: number
  selectedObjectId?: string | null
}

/** Task 21.2 — draw object path on canvas with direction arrow at playhead. */
export function TrajectoryOverlay({ width, height, trajectories, currentFrame, selectedObjectId }: Props) {
  if (!width || !height) return null

  const visible = trajectories.filter((t) => t.visible !== false)
  if (!visible.length) return null

  return (
    <svg
      className="absolute inset-0 z-[8] pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      {visible.map((tr) => {
        if (!tr.points.length) return null
        const isSelected = selectedObjectId === tr.object_id
        const past = tr.points.filter((p) => p.frame <= currentFrame)
        const future = tr.points.filter((p) => p.frame >= currentFrame)
        const fullPath = tr.points.map((p) => `${p.x},${p.y}`).join(' ')
        const pastPath = past.map((p) => `${p.x},${p.y}`).join(' ')
        const cur = past[past.length - 1] ?? tr.points[0]
        const next = future.find((p) => p.frame > currentFrame) ?? past[past.length - 1]
        const dir = next && cur !== next ? directionDeg(cur, next) : tr.metrics?.direction_deg ?? 0
        const arrowLen = 18
        const rad = (dir * Math.PI) / 180
        const ax = cur.x + Math.cos(rad) * arrowLen
        const ay = cur.y + Math.sin(rad) * arrowLen

        return (
          <g key={tr.id} opacity={isSelected ? 1 : 0.65}>
            {fullPath && (
              <polyline
                points={fullPath}
                fill="none"
                stroke={tr.color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeOpacity={0.25}
                strokeDasharray="4 4"
              />
            )}
            {pastPath && (
              <polyline
                points={pastPath}
                fill="none"
                stroke={tr.color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {tr.points.map((p) => (
              <circle
                key={p.frame}
                cx={p.x}
                cy={p.y}
                r={p.frame === currentFrame ? 4 : 2}
                fill={p.frame <= currentFrame ? tr.color : 'transparent'}
                stroke={tr.color}
                strokeWidth={1}
                opacity={p.frame === currentFrame ? 1 : 0.5}
              />
            ))}
            <line x1={cur.x} y1={cur.y} x2={ax} y2={ay} stroke={tr.color} strokeWidth={2} />
            <polygon
              points={`${ax},${ay} ${ax - 6 * Math.cos(rad - 0.4)},${ay - 6 * Math.sin(rad - 0.4)} ${ax - 6 * Math.cos(rad + 0.4)},${ay - 6 * Math.sin(rad + 0.4)}`}
              fill={tr.color}
            />
          </g>
        )
      })}
    </svg>
  )
}
