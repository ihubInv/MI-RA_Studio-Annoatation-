import { normalizeLoadedObject, type VideoRectObject } from '@/modules/video/canvas/types'
import { normalizeMask, type VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import { normalizeSkeleton, type VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import { normalizeEvent, type VideoEvent } from '@/modules/video/events/eventTypes'
import { normalizeAction, type VideoAction } from '@/modules/video/actions/actionTypes'
import { normalizeRelation, type VideoRelation } from '@/modules/video/relations/relationTypes'
import { normalizeTrajectory, type VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'
import {
  normalizeAudioSegment,
  normalizeSpeaker,
  normalizeTranscription,
  type AudioSegment,
  type SpeakerLabel,
  type TranscriptionSpan,
} from '@/modules/video/audio/audioTypes'
import { normalizeScene, type VideoScene } from '@/modules/video/scenes/sceneTypes'

export interface VideoAnnotationStore {
  version: 7
  rects: VideoRectObject[]
  skeletons: VideoSkeletonObject[]
  masks: VideoMaskObject[]
  events: VideoEvent[]
  actions: VideoAction[]
  relations: VideoRelation[]
  trajectories: VideoTrajectory[]
  audio_segments: AudioSegment[]
  speaker_labels: SpeakerLabel[]
  transcriptions: TranscriptionSpan[]
  scenes: VideoScene[]
}

const EMPTY: VideoAnnotationStore = {
  version: 7,
  rects: [],
  skeletons: [],
  masks: [],
  events: [],
  actions: [],
  relations: [],
  trajectories: [],
  audio_segments: [],
  speaker_labels: [],
  transcriptions: [],
  scenes: [],
}

function storageKey(itemId: string) {
  return `mira.video.annotations.${itemId}`
}

export function loadAnnotationStore(itemId: string): VideoAnnotationStore {
  try {
    const raw = localStorage.getItem(storageKey(itemId))
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return {
        ...EMPTY,
        rects: parsed
          .map((item) => normalizeLoadedObject(item as Record<string, unknown>))
          .filter((o): o is VideoRectObject => o != null),
      }
    }
    const rects = (parsed?.rects ?? [])
      .map((item: Record<string, unknown>) => normalizeLoadedObject(item))
      .filter((o: VideoRectObject | null): o is VideoRectObject => o != null)
    const skeletons = (parsed?.skeletons ?? [])
      .map((item: Record<string, unknown>) => normalizeSkeleton(item))
      .filter((o: VideoSkeletonObject | null): o is VideoSkeletonObject => o != null)
    const masks = (parsed?.masks ?? [])
      .map((item: Record<string, unknown>) => normalizeMask(item))
      .filter((o: VideoMaskObject | null): o is VideoMaskObject => o != null)
    const events = (parsed?.events ?? [])
      .map((item: Record<string, unknown>) => normalizeEvent(item))
      .filter((o: VideoEvent | null): o is VideoEvent => o != null)
    const actions = (parsed?.actions ?? [])
      .map((item: Record<string, unknown>) => normalizeAction(item))
      .filter((o: VideoAction | null): o is VideoAction => o != null)
    const relations = (parsed?.relations ?? [])
      .map((item: Record<string, unknown>) => normalizeRelation(item))
      .filter((o: VideoRelation | null): o is VideoRelation => o != null)
    const trajectories = (parsed?.trajectories ?? [])
      .map((item: Record<string, unknown>) => normalizeTrajectory(item))
      .filter((o: VideoTrajectory | null): o is VideoTrajectory => o != null)
    const audio_segments = (parsed?.audio_segments ?? [])
      .map((item: Record<string, unknown>) => normalizeAudioSegment(item))
      .filter((o: AudioSegment | null): o is AudioSegment => o != null)
    const speaker_labels = (parsed?.speaker_labels ?? [])
      .map((item: Record<string, unknown>) => normalizeSpeaker(item))
      .filter((o: SpeakerLabel | null): o is SpeakerLabel => o != null)
    const transcriptions = (parsed?.transcriptions ?? [])
      .map((item: Record<string, unknown>) => normalizeTranscription(item))
      .filter((o: TranscriptionSpan | null): o is TranscriptionSpan => o != null)
    const scenes = (parsed?.scenes ?? [])
      .map((item: Record<string, unknown>) => normalizeScene(item))
      .filter((o: VideoScene | null): o is VideoScene => o != null)
    return {
      version: 7,
      rects,
      skeletons,
      masks,
      events,
      actions,
      relations,
      trajectories,
      audio_segments,
      speaker_labels,
      transcriptions,
      scenes,
    }
  } catch {
    /* ignore */
  }
  return { ...EMPTY }
}

export function saveAnnotationStore(itemId: string, store: VideoAnnotationStore) {
  localStorage.setItem(storageKey(itemId), JSON.stringify({ ...store, version: 7 }))
}
