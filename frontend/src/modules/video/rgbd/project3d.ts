import type { CameraIntrinsics, Cuboid3D, Trajectory3DPoint } from '@/modules/video/rgbd/rgbdTypes'

export type Point2 = { x: number; y: number }

export function projectPoint(x: number, y: number, z: number, K: CameraIntrinsics): Point2 | null {
  if (z <= 0.01) return null
  return { x: (K.fx * x) / z + K.cx, y: (K.fy * y) / z + K.cy }
}

export function unprojectPixel(u: number, v: number, depthM: number, K: CameraIntrinsics) {
  const z = Math.max(depthM, 0.01)
  return {
    x: ((u - K.cx) * z) / K.fx,
    y: ((v - K.cy) * z) / K.fy,
    z,
  }
}

function rotateYaw(x: number, z: number, yaw: number) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: c * x + s * z, z: -s * x + c * z }
}

/** 8 corners of a 3D cuboid in camera space, then projected. */
export function cuboidCorners2d(box: Cuboid3D, K: CameraIntrinsics): Point2[] {
  const hx = box.length / 2
  const hy = box.height / 2
  const hz = box.width / 2
  const local = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, -hy, hz],
    [-hx, -hy, hz],
    [-hx, hy, -hz],
    [hx, hy, -hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ] as const
  const out: Point2[] = []
  for (const [lx, ly, lz] of local) {
    const r = rotateYaw(lx, lz, box.yaw)
    const p = projectPoint(box.x + r.x, box.y + ly, box.z + r.z, K)
    if (p) out.push(p)
  }
  return out
}

export const CUBOID_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

export function projectTrajectory3d(points: Trajectory3DPoint[], K: CameraIntrinsics): Point2[] {
  return points
    .map((p) => projectPoint(p.x, p.y, p.z, K))
    .filter((p): p is Point2 => p != null)
}
