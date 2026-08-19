import type { TrajectoryMetrics, TrajectoryPoint, TrajectorySegmentMetrics } from '@/modules/video/trajectory/trajectoryTypes'

function dist(a: TrajectoryPoint, b: TrajectoryPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

/** Bearing in degrees: 0 = right (+x), 90 = down (+y). */
export function directionDeg(from: TrajectoryPoint, to: TrajectoryPoint): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return 0
  const rad = Math.atan2(dy, dx)
  let deg = (rad * 180) / Math.PI
  if (deg < 0) deg += 360
  return deg
}

export function computeTrajectoryMetrics(points: TrajectoryPoint[]): TrajectoryMetrics {
  if (points.length < 2) {
    return {
      total_distance_px: 0,
      avg_velocity_px_per_sec: 0,
      max_velocity_px_per_sec: 0,
      avg_acceleration_px_per_sec2: 0,
      direction_deg: 0,
      segments: [],
    }
  }

  const segments: TrajectorySegmentMetrics[] = []
  let totalDistance = 0
  const velocities: number[] = []
  const accelerations: number[] = []

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const d = dist(prev, cur)
    const dt = Math.max(cur.time_sec - prev.time_sec, 1e-6)
    const v = d / dt
    totalDistance += d
    velocities.push(v)

    let accel = 0
    if (i >= 2) {
      const prevV = velocities[velocities.length - 2] ?? v
      const midDt = dt
      accel = (v - prevV) / midDt
      accelerations.push(accel)
    }

    segments.push({
      frame: cur.frame,
      direction_deg: directionDeg(prev, cur),
      velocity_px_per_sec: v,
      distance_px: d,
      acceleration_px_per_sec2: accel,
    })
  }

  const first = points[0]
  const last = points[points.length - 1]
  const overallDir = directionDeg(first, last)

  return {
    total_distance_px: totalDistance,
    avg_velocity_px_per_sec: velocities.length
      ? velocities.reduce((a, b) => a + b, 0) / velocities.length
      : 0,
    max_velocity_px_per_sec: velocities.length ? Math.max(...velocities) : 0,
    avg_acceleration_px_per_sec2: accelerations.length
      ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
      : 0,
    direction_deg: overallDir,
    segments,
  }
}
