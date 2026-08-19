import type { Cuboid3D, Trajectory3D, Trajectory3DPoint } from '@/modules/video/rgbd/rgbdTypes'

export function generateTrajectory3dFromCuboids(cuboids: Cuboid3D[], objectId: string, fps: number): Trajectory3D | null {
  const kfs = cuboids.filter((c) => c.object_id === objectId).sort((a, b) => a.frame - b.frame)
  if (!kfs.length) return null
  const points: Trajectory3DPoint[] = []
  for (let i = 0; i < kfs.length; i++) {
    const a = kfs[i]
    points.push({ frame: a.frame, x: a.x, y: a.y, z: a.z, time_sec: a.frame / Math.max(fps, 1) })
    const b = kfs[i + 1]
    if (!b || b.frame <= a.frame + 1) continue
    const span = b.frame - a.frame
    for (let f = a.frame + 1; f < b.frame; f++) {
      const t = (f - a.frame) / span
      points.push({
        frame: f,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        time_sec: f / Math.max(fps, 1),
      })
    }
  }
  return {
    id: crypto.randomUUID(),
    object_id: objectId,
    color: kfs[0].color,
    points,
  }
}

export function cuboidFromBbox(
  objectId: string,
  label: string,
  color: string,
  frame: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  depthM: number,
  fx: number,
) {
  const z = Math.max(depthM, 0.5)
  const length = (w * z) / fx
  const height = (h * z) / fx
  return {
    id: crypto.randomUUID(),
    object_id: objectId,
    label,
    color,
    frame,
    x: (cx * z) / fx / 1000,
    y: (cy * z) / fx / 1000,
    z,
    length,
    width: length * 0.6,
    height,
    yaw: 0,
    visible: true,
  } satisfies Cuboid3D
}
