import { occlusionOpacity, occlusionStrokeDash } from '@/modules/video/schema/occlusion'
import type { VideoDisplaySkeleton } from '@/modules/video/canvas/skeletonInterpolation'

interface Props {
  width: number
  height: number
  skeletons: VideoDisplaySkeleton[]
  selectedId: string | null
}

export function SkeletonOverlay({ width, height, skeletons, selectedId }: Props) {
  if (!width || !height) return null

  return (
    <svg
      className="absolute inset-0 z-[11] pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {skeletons.map((sk) => {
        if (sk.visible === false) return null
        const selected = sk.id === selectedId
        const objOpacity = occlusionOpacity(sk.occlusion ?? 'visible')
        const jointById = new Map(sk.joints.map((j) => [j.joint_id, j]))

        return (
          <g key={sk.id} opacity={sk.interpolated ? objOpacity * 0.85 : objOpacity}>
            {sk.edges.map(([a, b]) => {
              const ja = jointById.get(a)
              const jb = jointById.get(b)
              if (!ja || !jb || !ja.visible || !jb.visible) return null
              const dash = occlusionStrokeDash(ja.occlusion) ?? occlusionStrokeDash(jb.occlusion)
              return (
                <line
                  key={`${a}-${b}`}
                  x1={ja.x}
                  y1={ja.y}
                  x2={jb.x}
                  y2={jb.y}
                  stroke={sk.color}
                  strokeWidth={selected ? 2.5 : 1.5}
                  strokeDasharray={sk.interpolated ? '4 3' : dash}
                  opacity={Math.min(occlusionOpacity(ja.occlusion), occlusionOpacity(jb.occlusion))}
                />
              )
            })}
            {sk.joints.map((j) => {
              if (!j.visible) return null
              const r = selected ? 5 : 4
              const dash = occlusionStrokeDash(j.occlusion)
              return (
                <g key={j.joint_id}>
                  <circle
                    cx={j.x}
                    cy={j.y}
                    r={r}
                    fill={selected ? 'white' : sk.color}
                    stroke={sk.color}
                    strokeWidth={selected ? 2 : 1.5}
                    strokeDasharray={dash}
                    opacity={occlusionOpacity(j.occlusion)}
                  />
                  {selected && (
                    <text x={j.x + 6} y={j.y - 6} fill={sk.color} fontSize={9} fontWeight={600}>
                      {j.name}
                    </text>
                  )}
                </g>
              )
            })}
            <text x={sk.joints[0]?.x ?? 0} y={(sk.joints[0]?.y ?? 0) - 10} fill={sk.color} fontSize={11} fontWeight={600}>
              {sk.object_id}
              {sk.interpolated ? ' · interp' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
