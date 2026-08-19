import type { CameraIntrinsics } from '@/modules/video/rgbd/rgbdTypes'
import { projectPoint } from '@/modules/video/rgbd/project3d'
import type { LidarPoint } from '@/modules/lidar/lidarTypes'

export function lidarToImage(p: LidarPoint, K: CameraIntrinsics) {
  return projectPoint(p.x, p.y, p.z, K)
}

export function lidarBevBounds(points: LidarPoint[]) {
  if (!points.length) return { minX: -20, maxX: 20, minZ: 0, maxZ: 40 }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return { minX, maxX, minZ, maxZ }
}
