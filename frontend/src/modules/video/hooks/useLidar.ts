import { useCallback, useEffect, useState } from 'react'
import { generateDemoCloud, emptyLidarState, type LidarState } from '@/modules/lidar/lidarTypes'
import { loadLidarState, saveLidarState } from '@/modules/lidar/lidarStore'

export function useLidar(itemId: string | undefined) {
  const [state, setState] = useState<LidarState>(emptyLidarState)

  useEffect(() => {
    if (!itemId) return
    const loaded = loadLidarState(itemId)
    setState({
      ...loaded,
      cloud: loaded.cloud.length ? loaded.cloud : generateDemoCloud(600),
    })
    const onHydrate = (e: Event) => {
      if ((e as CustomEvent).detail?.itemId !== itemId) return
      const next = loadLidarState(itemId)
      setState((s) => ({ ...next, cloud: next.cloud.length ? next.cloud : s.cloud }))
    }
    window.addEventListener('mira-studio-hydrate', onHydrate)
    return () => window.removeEventListener('mira-studio-hydrate', onHydrate)
  }, [itemId])

  useEffect(() => {
    if (itemId) saveLidarState(itemId, state)
  }, [itemId, state])

  const patch = useCallback((p: Partial<LidarState>) => setState((s) => ({ ...s, ...p })), [])

  const toggleSegment = useCallback((index: number) => {
    setState((s) => {
      const has = s.segmentedIndices.includes(index)
      return {
        ...s,
        segmentedIndices: has ? s.segmentedIndices.filter((i) => i !== index) : [...s.segmentedIndices, index],
      }
    })
  }, [])

  return { state, setState, patch, toggleSegment }
}
