import { CUBOID_EDGES, cuboidCorners2d, projectTrajectory3d } from '@/modules/video/rgbd/project3d'
import type { CameraIntrinsics, Cuboid3D, Trajectory3D } from '@/modules/video/rgbd/rgbdTypes'
import { downsample } from '@/modules/video/perf/downsample'

interface Props {
  width: number
  height: number
  cuboids: Cuboid3D[]
  trajectories: Trajectory3D[]
  K: CameraIntrinsics
  currentFrame: number
  showCuboids: boolean
  showTrajectories: boolean
}

export function Cuboid3DOverlay({
  width,
  height,
  cuboids,
  trajectories,
  K,
  currentFrame,
  showCuboids,
  showTrajectories,
}: Props) {
  if (!width || !height) return null
  const onFrame = cuboids.filter((c) => c.visible !== false && c.frame === currentFrame)

  return (
    <svg className="absolute inset-0 z-[9] pointer-events-none" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {showTrajectories &&
        trajectories.map((tr) => {
          const pts = projectTrajectory3d(
            downsample(
              tr.points.filter((p) => p.frame <= currentFrame),
              400,
            ),
            K,
          )
          if (pts.length < 2) return null
          return (
            <polyline
              key={tr.id}
              points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={tr.color}
              strokeWidth={2}
              opacity={0.85}
            />
          )
        })}
      {showCuboids &&
        onFrame.map((box) => {
          const corners = cuboidCorners2d(box, K)
          if (corners.length < 8) return null
          return (
            <g key={box.id}>
              {CUBOID_EDGES.map(([a, b], i) => (
                <line
                  key={i}
                  x1={corners[a].x}
                  y1={corners[a].y}
                  x2={corners[b].x}
                  y2={corners[b].y}
                  stroke={box.color}
                  strokeWidth={1.5}
                />
              ))}
              <text x={corners[0].x} y={corners[0].y - 4} fill={box.color} fontSize={11}>
                {box.object_id}
              </text>
            </g>
          )
        })}
    </svg>
  )
}
