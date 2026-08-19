import { useMemo } from 'react'
import type { CameraIntrinsics } from '@/modules/video/rgbd/rgbdTypes'
import { lidarToImage } from '@/modules/lidar/projectLidar'
import type { LidarCuboid, LidarPoint } from '@/modules/lidar/lidarTypes'
import { downsample } from '@/modules/video/perf/downsample'

interface Props {
  width: number
  height: number
  points: LidarPoint[]
  cuboids: LidarCuboid[]
  K: CameraIntrinsics
  offsetFrames?: number
}

/** RGB/LiDAR sync overlay — project LiDAR onto the video frame. */
export function LidarRgbOverlay({ width, height, points, cuboids, K }: Props) {
  const pts = useMemo(() => downsample(points, 1200), [points])
  if (!width || !height) return null
  return (
    <svg className="absolute inset-0 z-[9] pointer-events-none" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {pts.map((p, i) => {
        const pr = lidarToImage(p, K)
        if (!pr) return null
        return <circle key={i} cx={pr.x} cy={pr.y} r={1.4} fill="#38bdf8" opacity={0.7} />
      })}
      {cuboids.map((c) => {
        const pr = lidarToImage({ x: c.x, y: c.y, z: c.z }, K)
        if (!pr) return null
        return (
          <g key={c.id}>
            <rect x={pr.x - 12} y={pr.y - 12} width={24} height={24} fill="none" stroke={c.color} strokeWidth={1.5} />
            <text x={pr.x} y={pr.y - 14} fill={c.color} fontSize={10} textAnchor="middle">
              {c.object_id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
