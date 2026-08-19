/** Object trajectory — Phase 21. */

export interface TrajectoryPoint {
  frame: number
  x: number
  y: number
  time_sec: number
}

export interface TrajectorySegmentMetrics {
  frame: number
  direction_deg: number
  velocity_px_per_sec: number
  distance_px: number
  acceleration_px_per_sec2: number
}

export interface TrajectoryMetrics {
  total_distance_px: number
  avg_velocity_px_per_sec: number
  max_velocity_px_per_sec: number
  avg_acceleration_px_per_sec2: number
  /** Overall bearing from first to last point (degrees, 0 = east, 90 = south). */
  direction_deg: number
  segments: TrajectorySegmentMetrics[]
}

export interface VideoTrajectory {
  id: string
  object_id: string
  color: string
  visible: boolean
  points: TrajectoryPoint[]
  metrics?: TrajectoryMetrics
  generated_at?: string
}

export function newTrajectoryId() {
  return crypto.randomUUID()
}

export function normalizeTrajectory(raw: Record<string, unknown>): VideoTrajectory | null {
  const objectId = String(raw.object_id || '')
  if (!objectId) return null
  const pointsRaw = Array.isArray(raw.points) ? raw.points : []
  const points: TrajectoryPoint[] = pointsRaw
    .map((p) => {
      const pt = p as Record<string, unknown>
      const frame = Number(pt.frame)
      const x = Number(pt.x)
      const y = Number(pt.y)
      const time_sec = Number(pt.time_sec ?? 0)
      if (!Number.isFinite(frame) || frame < 0 || !Number.isFinite(x) || !Number.isFinite(y)) return null
      return { frame, x, y, time_sec: Number.isFinite(time_sec) ? time_sec : 0 }
    })
    .filter((p): p is TrajectoryPoint => p != null)
    .sort((a, b) => a.frame - b.frame)

  return {
    id: String(raw.id || newTrajectoryId()),
    object_id: objectId,
    color: String(raw.color || '#f97316'),
    visible: raw.visible !== false,
    points,
    metrics: raw.metrics as TrajectoryMetrics | undefined,
    generated_at: raw.generated_at != null ? String(raw.generated_at) : undefined,
  }
}

export function trajectoryAtFrame(
  trajectory: VideoTrajectory,
  frame: number,
): TrajectoryPoint | null {
  if (!trajectory.points.length) return null
  const sorted = trajectory.points
  const exact = sorted.find((p) => p.frame === frame)
  if (exact) return exact
  let before: TrajectoryPoint | null = null
  for (const p of sorted) {
    if (p.frame <= frame) before = p
    else break
  }
  return before ?? sorted[0]
}
