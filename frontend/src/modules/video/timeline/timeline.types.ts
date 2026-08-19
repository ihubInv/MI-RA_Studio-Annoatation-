/** Timeline selection and track types — Phase 5 + Phase 12. */
export interface TimelineTrack {
  id: string
  label: string
  color: string
  keyframes: number[]
  /** Phase 12 track span */
  startFrame?: number
  endFrame?: number
  className?: string
}

export interface TimelineRange {
  startFrame: number
  endFrame: number
}

export type TimelineSelectionMode = 'frame' | 'range' | 'track' | 'keyframe'

export interface TimelineSelection {
  mode: TimelineSelectionMode
  frame: number | null
  range: TimelineRange | null
  trackId: string | null
  keyframes: number[]
}

export const EMPTY_SELECTION: TimelineSelection = {
  mode: 'frame',
  frame: null,
  range: null,
  trackId: null,
  keyframes: [],
}

export function demoTracks(_maxFrame: number, _keyframeTimestamps?: number[], _fps = 30): TimelineTrack[] {
  return []
}
