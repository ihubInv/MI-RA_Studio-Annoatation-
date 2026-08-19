import { emptyLidarState, type LidarState } from '@/modules/lidar/lidarTypes'

function key(itemId: string) {
  return `mira.lidar.state.${itemId}`
}

export function loadLidarState(itemId: string): LidarState {
  try {
    const raw = localStorage.getItem(key(itemId))
    if (!raw) return emptyLidarState()
    return { ...emptyLidarState(), ...JSON.parse(raw) }
  } catch {
    return emptyLidarState()
  }
}

export function saveLidarState(itemId: string, state: LidarState) {
  const { cloud, ...rest } = state
  localStorage.setItem(key(itemId), JSON.stringify({ ...rest, cloud: cloud.slice(0, 4000) }))
}
