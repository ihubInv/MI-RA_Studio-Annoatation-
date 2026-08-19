import { useCallback, useState } from 'react'
import type { TimelineSelection } from '@/modules/video/timeline/timeline.types'
import { EMPTY_SELECTION } from '@/modules/video/timeline/timeline.types'
import { clampFrame } from '@/modules/video/frameIndex'
import type { FrameIndex } from '@/modules/video/api/video.service'

export function useTimelineSelection(index: FrameIndex | null, maxFrame: number) {
  const [selection, setSelection] = useState<TimelineSelection>(EMPTY_SELECTION)
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null)
  const [snapToFrame, setSnapToFrame] = useState(true)

  const snap = useCallback(
    (frame: number) => {
      if (!snapToFrame || !index) return Math.min(maxFrame, Math.max(0, frame))
      return clampFrame(frame, index)
    },
    [index, maxFrame, snapToFrame],
  )

  const selectFrame = useCallback(
    (frame: number) => {
      const f = snap(frame)
      setSelection({ mode: 'frame', frame: f, range: null, trackId: null, keyframes: [] })
      setRangeAnchor(null)
      return f
    },
    [snap],
  )

  const selectRange = useCallback(
    (start: number, end: number) => {
      const a = snap(Math.min(start, end))
      const b = snap(Math.max(start, end))
      setSelection({
        mode: 'range',
        frame: null,
        range: { startFrame: a, endFrame: b },
        trackId: null,
        keyframes: [],
      })
    },
    [snap],
  )

  const beginRange = useCallback(
    (frame: number) => {
      setRangeAnchor(snap(frame))
    },
    [snap],
  )

  const extendRange = useCallback(
    (frame: number) => {
      if (rangeAnchor == null) return
      selectRange(rangeAnchor, frame)
    },
    [rangeAnchor, selectRange],
  )

  const selectTrack = useCallback((trackId: string) => {
    setSelection((s) => ({ ...s, mode: 'track', trackId, keyframes: [] }))
  }, [])

  const toggleKeyframe = useCallback(
    (frame: number, trackId?: string) => {
      const f = snap(frame)
      setSelection((s) => {
        const has = s.keyframes.includes(f)
        const keyframes = has ? s.keyframes.filter((k) => k !== f) : [...s.keyframes, f].sort((a, b) => a - b)
        return {
          mode: 'keyframe',
          frame: f,
          range: s.range,
          trackId: trackId ?? s.trackId,
          keyframes,
        }
      })
    },
    [snap],
  )

  const clearSelection = useCallback(() => {
    setSelection(EMPTY_SELECTION)
    setRangeAnchor(null)
  }, [])

  return {
    selection,
    snapToFrame,
    setSnapToFrame,
    selectFrame,
    selectRange,
    beginRange,
    extendRange,
    selectTrack,
    toggleKeyframe,
    clearSelection,
    snap,
  }
}

export type TimelineSelectionState = ReturnType<typeof useTimelineSelection>
