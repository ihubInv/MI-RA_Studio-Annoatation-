import type { LidarCuboid, LidarPoint } from '@/modules/lidar/lidarTypes'
import { lidarBevBounds } from '@/modules/lidar/projectLidar'

interface Props {
  points: LidarPoint[]
  cuboids: LidarCuboid[]
  selectedIndex: number | null
  segmented: number[]
  onSelectPoint: (index: number | null) => void
  onToggleSegment: (index: number) => void
  width?: number
  height?: number
}

/** Phase 26 — BEV + point selection / segmentation. */
export function BevView({
  points,
  cuboids,
  selectedIndex,
  segmented,
  onSelectPoint,
  onToggleSegment,
  width = 240,
  height = 160,
}: Props) {
  const b = lidarBevBounds(points)
  const sx = (x: number) => ((x - b.minX) / Math.max(b.maxX - b.minX, 1e-3)) * width
  const sz = (z: number) => height - ((z - b.minZ) / Math.max(b.maxZ - b.minZ, 1e-3)) * height
  const seg = new Set(segmented)

  return (
    <svg
      width={width}
      height={height}
      className="bg-slate-950 rounded border border-border w-full"
      onClick={() => onSelectPoint(null)}
    >
      {points.map((p, i) => (
        <circle
          key={i}
          cx={sx(p.x)}
          cy={sz(p.z)}
          r={selectedIndex === i ? 3 : 1.2}
          fill={seg.has(i) ? '#22c55e' : selectedIndex === i ? '#f97316' : `hsl(${(p.intensity ?? 0.4) * 180},70%,60%)`}
          onClick={(e) => {
            e.stopPropagation()
            if (e.shiftKey) onToggleSegment(i)
            else onSelectPoint(i)
          }}
        />
      ))}
      {cuboids.map((c) => (
        <rect
          key={c.id}
          x={sx(c.x - c.l / 2)}
          y={sz(c.z + c.w / 2)}
          width={Math.max(4, ((c.l) / Math.max(b.maxX - b.minX, 1)) * width)}
          height={Math.max(4, ((c.w) / Math.max(b.maxZ - b.minZ, 1)) * height)}
          fill="none"
          stroke={c.color}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  )
}
