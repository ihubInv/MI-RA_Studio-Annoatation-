/** Video annotation module — Phase 1 upload, Phase 2 processing, Phase 3 viewer. */
export {
  VIDEO_ACCEPT,
  VIDEO_EXTENSIONS,
  formatBytes,
  formatDuration,
  isVideoPath,
} from './constants'
export { videoService } from './api/video.service'
export type { FrameIndex, FrameLookup, VideoProbe } from './api/video.service'
export {
  clampFrame,
  formatTimecode,
  frameToTimeSec,
  parseFrameInput,
  parseTimecode,
  timeSecToFrame,
} from './frameIndex'
export { VideoStudioPage } from './pages/VideoStudioPage'
export { VideoTimeline } from './components/VideoTimeline'
export type { TimelineSelection, TimelineTrack } from './timeline/timeline.types'
export { LabelManager } from './panels/LabelManager'
export { loadVideoLabelSchema, saveVideoLabelSchema } from './schema/labelStore'
export type { VideoLabel, VideoLabelSchema, LabelAttribute } from './schema/labelStore'
