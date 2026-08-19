import { emptyRgbDState, type Cuboid3D, type RgbDState } from '@/modules/video/rgbd/rgbdTypes'

function key(itemId: string) {
  return `mira.video.rgbd.${itemId}`
}

export function loadRgbDState(itemId: string): RgbDState {
  try {
    const raw = localStorage.getItem(key(itemId))
    if (!raw) return emptyRgbDState()
    const parsed = JSON.parse(raw) as RgbDState
    return { ...emptyRgbDState(), ...parsed, cuboids: parsed.cuboids ?? [], trajectories3d: parsed.trajectories3d ?? [] }
  } catch {
    return emptyRgbDState()
  }
}

export function saveRgbDState(itemId: string, state: RgbDState) {
  localStorage.setItem(key(itemId), JSON.stringify(state))
}

export function cuboidsOnFrame(cuboids: Cuboid3D[], frame: number) {
  return cuboids.filter((c) => c.visible !== false && c.frame === frame)
}
