/** Phase 12 — explicit video annotation track. */
export interface VideoTrack {
  track_id: string
  object_id: string
  class_name: string
  start_frame: number
  end_frame: number
  keyframes: number[]
  color: string
}

export interface TrackSplitResult {
  kept: VideoTrack
  created: VideoTrack
  newObjectId: string
}

export interface TrackMergeResult {
  merged: VideoTrack
  removedObjectId: string
}
