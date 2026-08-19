import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadAnnotationStore, saveAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { videoAudioService } from '@/modules/video/api/videoAudio.service'
import {
  newAudioSegmentId,
  newSpeakerId,
  newTranscriptionId,
  type AudioSegment,
  type SpeakerLabel,
  type TranscriptionSpan,
  type WaveformData,
} from '@/modules/video/audio/audioTypes'
import { extractWaveformFromUrl } from '@/modules/video/audio/extractWaveform'
import { loadWaveformCache, saveWaveformCache } from '@/modules/video/audio/waveformStorage'
import { frameToTimeSec } from '@/modules/video/frameIndex'
import type { FrameIndex } from '@/modules/video/api/video.service'

const DEFAULT_SPEAKERS: SpeakerLabel[] = [
  { id: 'speaker_a', name: 'Speaker A', color: '#6366f1' },
  { id: 'speaker_b', name: 'Speaker B', color: '#ec4899' },
]

export function useVideoAudio(itemId: string | undefined) {
  const [waveform, setWaveform] = useState<WaveformData | null>(null)
  const [waveformLoading, setWaveformLoading] = useState(false)
  const [waveformError, setWaveformError] = useState<string | null>(null)
  const [segments, setSegments] = useState<AudioSegment[]>([])
  const [speakers, setSpeakers] = useState<SpeakerLabel[]>(DEFAULT_SPEAKERS)
  const [transcriptions, setTranscriptions] = useState<TranscriptionSpan[]>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [selectedTranscriptionId, setSelectedTranscriptionId] = useState<string | null>(null)
  const [intervalDraft, setIntervalDraft] = useState<{ startFrame: number; startSec: number } | null>(
    null,
  )

  useEffect(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    setSegments(store.audio_segments ?? [])
    setSpeakers(store.speaker_labels?.length ? store.speaker_labels : DEFAULT_SPEAKERS)
    setTranscriptions(store.transcriptions ?? [])
    setSelectedSegmentId(null)
    setSelectedTranscriptionId(null)
    setIntervalDraft(null)
    const cached = loadWaveformCache(itemId)
    setWaveform(cached)
  }, [itemId])

  const persistAnnotations = useCallback(() => {
    if (!itemId) return
    const store = loadAnnotationStore(itemId)
    saveAnnotationStore(itemId, {
      ...store,
      audio_segments: segments,
      speaker_labels: speakers,
      transcriptions,
    })
  }, [itemId, segments, speakers, transcriptions])

  useEffect(() => {
    persistAnnotations()
  }, [persistAnnotations])

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === selectedSegmentId) ?? null,
    [segments, selectedSegmentId],
  )

  const selectedTranscription = useMemo(
    () => transcriptions.find((t) => t.id === selectedTranscriptionId) ?? null,
    [transcriptions, selectedTranscriptionId],
  )

  const extractWaveform = useCallback(
    async (mediaUrl: string, isLocal?: boolean) => {
      if (!itemId) return
      setWaveformLoading(true)
      setWaveformError(null)
      try {
        let data: WaveformData | null = null
        if (!isLocal && itemId) {
          try {
            data = await videoAudioService.waveform(itemId)
          } catch {
            /* fall through to client extraction */
          }
        }
        if (!data) {
          data = await extractWaveformFromUrl(mediaUrl)
        }
        setWaveform(data)
        saveWaveformCache(itemId, data)
      } catch (err) {
        setWaveformError(err instanceof Error ? err.message : 'Failed to extract audio')
      } finally {
        setWaveformLoading(false)
      }
    },
    [itemId],
  )

  const addSegment = useCallback(
    (
      startFrame: number,
      endFrame: number,
      frameIndex: FrameIndex,
      patch?: Partial<AudioSegment>,
    ) => {
      const start = Math.min(startFrame, endFrame)
      const end = Math.max(startFrame, endFrame)
      const seg: AudioSegment = {
        id: newAudioSegmentId(),
        label: patch?.label ?? 'Segment',
        color: patch?.color ?? speakers[0]?.color ?? '#6366f1',
        start_frame: start,
        end_frame: end,
        start_sec: frameToTimeSec(start, frameIndex),
        end_sec: frameToTimeSec(end, frameIndex),
        speaker_id: patch?.speaker_id,
      }
      setSegments((prev) => [...prev, seg])
      setSelectedSegmentId(seg.id)
      setIntervalDraft(null)
      return seg.id
    },
    [speakers],
  )

  const beginSegment = useCallback((startFrame: number, startSec: number) => {
    setIntervalDraft({ startFrame, startSec })
  }, [])

  const cancelSegmentDraft = useCallback(() => setIntervalDraft(null), [])

  const updateSegment = useCallback((id: string, patch: Partial<AudioSegment>) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const deleteSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id))
    setSelectedSegmentId((cur) => (cur === id ? null : cur))
  }, [])

  const addSpeaker = useCallback((name: string, color?: string) => {
    const sp: SpeakerLabel = { id: newSpeakerId(), name, color: color ?? '#6366f1' }
    setSpeakers((prev) => [...prev, sp])
    return sp.id
  }, [])

  const updateSpeaker = useCallback((id: string, patch: Partial<SpeakerLabel>) => {
    setSpeakers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const deleteSpeaker = useCallback((id: string) => {
    setSpeakers((prev) => prev.filter((s) => s.id !== id))
    setSegments((prev) => prev.map((s) => (s.speaker_id === id ? { ...s, speaker_id: undefined } : s)))
    setTranscriptions((prev) =>
      prev.map((t) => (t.speaker_id === id ? { ...t, speaker_id: undefined } : t)),
    )
  }, [])

  const addTranscription = useCallback(
    (
      text: string,
      startFrame: number,
      endFrame: number,
      frameIndex: FrameIndex,
      speakerId?: string,
    ) => {
      const start = Math.min(startFrame, endFrame)
      const end = Math.max(startFrame, endFrame)
      const span: TranscriptionSpan = {
        id: newTranscriptionId(),
        text,
        start_frame: start,
        end_frame: end,
        start_sec: frameToTimeSec(start, frameIndex),
        end_sec: frameToTimeSec(end, frameIndex),
        speaker_id: speakerId,
      }
      setTranscriptions((prev) => [...prev, span])
      setSelectedTranscriptionId(span.id)
      return span.id
    },
    [],
  )

  const updateTranscription = useCallback((id: string, patch: Partial<TranscriptionSpan>) => {
    setTranscriptions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const deleteTranscription = useCallback((id: string) => {
    setTranscriptions((prev) => prev.filter((t) => t.id !== id))
    setSelectedTranscriptionId((cur) => (cur === id ? null : cur))
  }, [])

  return {
    waveform,
    waveformLoading,
    waveformError,
    extractWaveform,
    segments,
    speakers,
    transcriptions,
    selectedSegmentId,
    selectedSegment,
    selectedTranscriptionId,
    selectedTranscription,
    intervalDraft,
    selectSegment: setSelectedSegmentId,
    selectTranscription: setSelectedTranscriptionId,
    addSegment,
    beginSegment,
    cancelSegmentDraft,
    updateSegment,
    deleteSegment,
    addSpeaker,
    updateSpeaker,
    deleteSpeaker,
    addTranscription,
    updateTranscription,
    deleteTranscription,
  }
}

export type VideoAudioApi = ReturnType<typeof useVideoAudio>
