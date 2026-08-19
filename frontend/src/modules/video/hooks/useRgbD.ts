import { useCallback, useEffect, useState } from 'react'
import { loadRgbDState, saveRgbDState } from '@/modules/video/rgbd/rgbdStore'
import { cuboidFromBbox, generateTrajectory3dFromCuboids } from '@/modules/video/rgbd/trajectory3d'
import { defaultIntrinsics, emptyRgbDState, type RgbDState } from '@/modules/video/rgbd/rgbdTypes'
import type { VideoRectObject } from '@/modules/video/canvas/types'

export function useRgbD(itemId: string | undefined, width: number, height: number) {
  const [state, setState] = useState<RgbDState>(() => emptyRgbDState(width, height))

  useEffect(() => {
    if (!itemId) return
    const loaded = loadRgbDState(itemId)
    setState({
      ...loaded,
      intrinsics: loaded.intrinsics.fx ? loaded.intrinsics : defaultIntrinsics(width, height),
    })
    const onHydrate = (e: Event) => {
      if ((e as CustomEvent).detail?.itemId !== itemId) return
      const next = loadRgbDState(itemId)
      setState({
        ...next,
        intrinsics: next.intrinsics.fx ? next.intrinsics : defaultIntrinsics(width, height),
      })
    }
    window.addEventListener('mira-studio-hydrate', onHydrate)
    return () => window.removeEventListener('mira-studio-hydrate', onHydrate)
  }, [itemId, width, height])

  useEffect(() => {
    if (itemId) saveRgbDState(itemId, state)
  }, [itemId, state])

  const patch = useCallback((p: Partial<RgbDState>) => setState((s) => ({ ...s, ...p })), [])

  const cuboidFromSelected = useCallback(
    (obj: VideoRectObject, depthM: number) => {
      const box = cuboidFromBbox(
        obj.object_id,
        obj.label,
        obj.color,
        obj.frame,
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
        obj.width,
        obj.height,
        depthM,
        state.intrinsics.fx,
      )
      setState((s) => ({ ...s, cuboids: [...s.cuboids.filter((c) => !(c.object_id === obj.object_id && c.frame === obj.frame)), box] }))
    },
    [state.intrinsics.fx],
  )

  const generate3dTraj = useCallback(
    (objectId: string, fps: number) => {
      const tr = generateTrajectory3dFromCuboids(state.cuboids, objectId, fps)
      if (!tr) return
      setState((s) => ({ ...s, trajectories3d: [...s.trajectories3d.filter((t) => t.object_id !== objectId), tr] }))
    },
    [state.cuboids],
  )

  return { state, setState, patch, cuboidFromSelected, generate3dTraj }
}
