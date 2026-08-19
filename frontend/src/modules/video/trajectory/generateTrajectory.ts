import { geometryAtFrame } from '@/modules/video/canvas/interpolation'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import { computeTrajectoryMetrics } from '@/modules/video/trajectory/trajectoryMetrics'
import {
  newTrajectoryId,
  type TrajectoryPoint,
  type VideoTrajectory,
} from '@/modules/video/trajectory/trajectoryTypes'

function bboxCentroid(geom: Pick<VideoRectObject, 'x' | 'y' | 'width' | 'height'>) {
  return { x: geom.x + geom.width / 2, y: geom.y + geom.height / 2 }
}

/** Task 21.1 — generate centroid trajectory from track keyframes + interpolation. */
export function generateTrajectoryFromTrack(
  objects: VideoRectObject[],
  objectId: string,
  fps: number,
  options?: { maxFrame?: number; color?: string },
): VideoTrajectory | null {
  const keyframes = objects
    .filter((o) => o.object_id === objectId && (o.tool_type === 'bbox' || o.tool_type === 'rectangle'))
    .sort((a, b) => a.frame - b.frame)
  if (!keyframes.length) return null

  const startFrame = keyframes[0].frame
  const endFrame = options?.maxFrame != null
    ? Math.min(keyframes[keyframes.length - 1].frame, options.maxFrame)
    : keyframes[keyframes.length - 1].frame

  const points: TrajectoryPoint[] = []
  for (let frame = startFrame; frame <= endFrame; frame++) {
    const geom = geometryAtFrame(objects, objectId, frame)
    if (!geom) continue
    const c = bboxCentroid(geom)
    points.push({
      frame,
      x: c.x,
      y: c.y,
      time_sec: fps > 0 ? frame / fps : 0,
    })
  }

  if (!points.length) return null

  const metrics = computeTrajectoryMetrics(points)
  const color = options?.color ?? keyframes[0].color ?? '#f97316'

  return {
    id: newTrajectoryId(),
    object_id: objectId,
    color,
    visible: true,
    points,
    metrics,
    generated_at: new Date().toISOString(),
  }
}
