/** RGB-D / 3D annotations — Phase 25. */

export interface CameraIntrinsics {
  fx: number
  fy: number
  cx: number
  cy: number
}

export interface DepthMapMeta {
  width: number
  height: number
  near_m: number
  far_m: number
  /** Optional URL of a depth video (same duration as RGB). */
  depth_video_url?: string
  offset_frames: number
}

export interface Cuboid3D {
  id: string
  object_id: string
  label: string
  color: string
  frame: number
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  yaw: number
  visible?: boolean
}

export interface Trajectory3DPoint {
  frame: number
  x: number
  y: number
  z: number
  time_sec: number
}

export interface Trajectory3D {
  id: string
  object_id: string
  color: string
  points: Trajectory3DPoint[]
}

export interface RgbDState {
  enabled: boolean
  colormap: 'turbo' | 'viridis' | 'gray'
  opacity: number
  showCuboids: boolean
  showTrajectories3d: boolean
  depth: DepthMapMeta
  intrinsics: CameraIntrinsics
  cuboids: Cuboid3D[]
  trajectories3d: Trajectory3D[]
}

export function defaultIntrinsics(width: number, height: number): CameraIntrinsics {
  return { fx: width * 0.9, fy: width * 0.9, cx: width / 2, cy: height / 2 }
}

export function emptyRgbDState(width = 1280, height = 720): RgbDState {
  return {
    enabled: false,
    colormap: 'turbo',
    opacity: 0.55,
    showCuboids: true,
    showTrajectories3d: true,
    depth: { width, height, near_m: 0.3, far_m: 40, offset_frames: 0 },
    intrinsics: defaultIntrinsics(width, height),
    cuboids: [],
    trajectories3d: [],
  }
}

export function newCuboidId() {
  return crypto.randomUUID()
}
