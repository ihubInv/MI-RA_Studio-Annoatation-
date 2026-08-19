import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DetectOutput } from '@/modules/image/api/inference.service'
import {
  mapDetectResults,
  mapPoseResult,
  mapSegmentResult,
  type AiDetectSuggestion,
  type AiSmartHint,
  type AiSuggestion,
} from '@/modules/video/ai/mapAiResults'
import { analyzeSmartTrack, seedFromObject, keyframesForObject } from '@/modules/video/ai/smartTrack'
import { reTrackFromObject, trackBboxesAcrossFrames } from '@/modules/video/ai/trackAssist'
import { videoAiService } from '@/modules/video/api/videoAi.service'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import type { VideoTrack } from '@/modules/video/timeline/track.types'

export interface AiSettings {
  detectOutput: DetectOutput
  detectModel: string
  detectConfidence: number
  detectClasses: string
  segModel: string
  poseModel: string
  poseConfidence: number
  minTrackConfidence: number
  retainLowConfidence: boolean
  idSwitchThreshold: number
  gapThreshold: number
}

const DEFAULT_SETTINGS: AiSettings = {
  detectOutput: 'bbox',
  detectModel: 'yolov8n',
  detectConfidence: 0.25,
  detectClasses: '',
  segModel: 'mobile_sam',
  poseModel: 'yolov8n-pose',
  poseConfidence: 0.25,
  minTrackConfidence: 0.25,
  retainLowConfidence: true,
  idSwitchThreshold: 0.35,
  gapThreshold: 8,
}

export function useAiSuggestions(itemId: string | undefined) {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS)
  const [modelsAvailable, setModelsAvailable] = useState<boolean | null>(null)
  const [showReviewOnly, setShowReviewOnly] = useState(false)
  const [segPrompts, setSegPrompts] = useState<{ positive: { x: number; y: number }[]; negative: { x: number; y: number }[] }>({
    positive: [],
    negative: [],
  })

  useEffect(() => {
    if (!itemId) return
    let cancelled = false
    videoAiService
      .listModels(itemId)
      .then((m) => {
        if (cancelled) return
        setModelsAvailable(m.available)
      })
      .catch(() => {
        if (!cancelled) setModelsAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  const pending = useMemo(() => suggestions.filter((s) => s.status === 'pending'), [suggestions])

  const pendingFiltered = useMemo(() => {
    if (!showReviewOnly) return pending
    return pending.filter((s) => {
      if (s.kind === 'detect') return s.needs_review || (s.track_confidence != null && s.track_confidence < settings.minTrackConfidence)
      if (s.kind === 'smart_hint') return s.hint_type !== 'keyframe'
      return false
    })
  }, [pending, showReviewOnly, settings.minTrackConfidence])

  const pendingOnFrame = useCallback(
    (frame: number) => pendingFiltered.filter((s) => s.frame === frame),
    [pendingFiltered],
  )

  const smartHints = useMemo(() => pendingFiltered.filter((s): s is AiSmartHint => s.kind === 'smart_hint'), [pendingFiltered])

  const needsReviewCount = useMemo(
    () =>
      pending.filter(
        (s) =>
          (s.kind === 'detect' && s.needs_review) ||
          (s.kind === 'smart_hint' && s.hint_type !== 'keyframe'),
      ).length,
    [pending],
  )

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setSegPrompts({ positive: [], negative: [] })
    setStatus('')
  }, [])

  const rejectSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'rejected' as const } : s)))
  }, [])

  const rejectAll = useCallback(() => {
    setSuggestions((prev) => prev.map((s) => (s.status === 'pending' ? { ...s, status: 'rejected' as const } : s)))
    setStatus('All suggestions rejected.')
  }, [])

  const appendSuggestions = useCallback((items: AiSuggestion[]) => {
    setSuggestions((prev) => [...prev.filter((s) => s.status === 'pending'), ...items])
  }, [])

  const runDetect = useCallback(
    async (video: HTMLVideoElement, frame: number) => {
      if (!itemId || busy) return
      setBusy(true)
      setStatus('Running YOLO detection…')
      try {
        const classFilter = settings.detectClasses
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        const result = await videoAiService.detect(itemId, video, frame, {
          output: settings.detectOutput,
          model: settings.detectModel,
          confidence: settings.detectConfidence,
          classes: classFilter.length ? classFilter : undefined,
        })
        const mapped = mapDetectResults(result.objects, frame, result.engine, result.model)
        if (!mapped.length) {
          setStatus('No objects detected. Lower confidence or adjust class filter.')
          return
        }
        appendSuggestions(mapped)
        setStatus(`${mapped.length} detection(s) ready for review.`)
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Detection failed')
      } finally {
        setBusy(false)
      }
    },
    [itemId, busy, settings, appendSuggestions],
  )

  const runSegment = useCallback(
    async (
      video: HTMLVideoElement,
      frame: number,
      positive: { x: number; y: number }[],
      negative: { x: number; y: number }[] = [],
      label = 'Object',
    ) => {
      if (!itemId || busy || !positive.length) return
      setBusy(true)
      setStatus('Running SAM segmentation…')
      try {
        const result = await videoAiService.segment(itemId, video, frame, positive, negative, settings.segModel)
        const w = video.videoWidth || video.width
        const h = video.videoHeight || video.height
        const mapped = mapSegmentResult(
          result.points,
          frame,
          label,
          0.9,
          w,
          h,
          result.engine,
          result.model,
        )
        if (!mapped) {
          setStatus('Segmentation returned no mask. Try different click points.')
          return
        }
        appendSuggestions([mapped])
        setSegPrompts({ positive: [], negative: [] })
        setStatus('Segmentation ready for review.')
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Segmentation failed')
      } finally {
        setBusy(false)
      }
    },
    [itemId, busy, settings.segModel, appendSuggestions],
  )

  const runPose = useCallback(
    async (video: HTMLVideoElement, frame: number, point: { x: number; y: number }, label = 'Person') => {
      if (!itemId || busy) return
      setBusy(true)
      setStatus('Running pose estimation…')
      try {
        const result = await videoAiService.pose(
          itemId,
          video,
          frame,
          point,
          settings.poseModel,
          settings.poseConfidence,
        )
        const mapped = mapPoseResult(result.geometry, frame, label, 0.9, result.engine, result.model)
        if (!mapped) {
          setStatus('No pose detected at this location.')
          return
        }
        appendSuggestions([mapped])
        setStatus('Pose ready for review.')
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Pose estimation failed')
      } finally {
        setBusy(false)
      }
    },
    [itemId, busy, settings.poseModel, settings.poseConfidence, appendSuggestions],
  )

  const runTrack = useCallback(
    async (
      video: HTMLVideoElement,
      opts: {
        fromFrame: number
        toFrame: number
        fps: number
        seeds: AiDetectSuggestion[]
      },
    ) => {
      if (!itemId || busy || !opts.seeds.length) return
      setBusy(true)
      setStatus('Smart tracking across frames…')
      try {
        const { keyframes, hints } = await trackBboxesAcrossFrames(itemId, video, {
          ...opts,
          model: settings.detectModel,
          confidence: settings.detectConfidence,
          minTrackConfidence: settings.minTrackConfidence,
          retainLowConfidence: settings.retainLowConfidence,
          idSwitchThreshold: settings.idSwitchThreshold,
          onProgress: (p) => setStatus(p.message),
        })
        if (!keyframes.length && !hints.length) {
          setStatus('No track matches. Try lowering track confidence.')
          return
        }
        appendSuggestions([...keyframes, ...hints])
        const review = keyframes.filter((k) => k.needs_review).length
        setStatus(
          `${keyframes.length} keyframe(s), ${hints.length} smart hint(s)${review ? ` · ${review} need review` : ''}.`,
        )
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Tracking failed')
      } finally {
        setBusy(false)
      }
    },
    [itemId, busy, settings, appendSuggestions],
  )

  /** Task 17.1 — analyze existing tracks for keyframe/gap/ID-switch hints. */
  const runSmartAnalysis = useCallback(
    (objects: VideoRectObject[], tracks: VideoTrack[], maxFrame: number) => {
      if (busy) return
      setStatus('Analyzing tracks…')
      const analysis = analyzeSmartTrack(objects, tracks, maxFrame, {
        gapThreshold: settings.gapThreshold,
        lowConfThreshold: settings.minTrackConfidence,
      })
      if (!analysis.keyframe_hints.length) {
        setStatus('No smart suggestions — tracks look healthy.')
        return
      }
      appendSuggestions(analysis.keyframe_hints)
      setStatus(
        `${analysis.keyframe_hints.length} suggestion(s): ${analysis.gaps.length} gap(s), ${analysis.id_switches.length} ID switch(es), ${analysis.reid_candidates.length} re-ID candidate(s).`,
      )
    },
    [busy, settings.gapThreshold, settings.minTrackConfidence, appendSuggestions],
  )

  /** Task 17.3 — automatic re-tracking from nearest keyframe of selected object. */
  const runReTrack = useCallback(
    async (
      video: HTMLVideoElement,
      objects: VideoRectObject[],
      objectId: string,
      fromFrame: number,
      toFrame: number,
      fps: number,
    ) => {
      if (!itemId || busy) return
      const kfs = keyframesForObject(objects, objectId)
      const seedKf = kfs.find((k) => k.frame === fromFrame) ?? kfs.reduce((best, k) =>
        Math.abs(k.frame - fromFrame) < Math.abs(best.frame - fromFrame) ? k : best,
      kfs[0])
      if (!seedKf) {
        setStatus('No keyframe to seed re-tracking.')
        return
      }
      setBusy(true)
      setStatus(`Re-tracking ${objectId} from f${seedKf.frame + 1}…`)
      try {
        const seed = seedFromObject(seedKf)
        const { keyframes, hints } = await reTrackFromObject(itemId, video, {
          seed,
          fromFrame: seedKf.frame,
          toFrame,
          fps,
          model: settings.detectModel,
          confidence: settings.detectConfidence,
          minTrackConfidence: settings.minTrackConfidence,
          onProgress: (p) => setStatus(p.message),
        })
        appendSuggestions([...keyframes, ...hints])
        setStatus(`Re-track complete: ${keyframes.length} keyframe(s), ${hints.length} hint(s).`)
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'Re-tracking failed')
      } finally {
        setBusy(false)
      }
    },
    [itemId, busy, settings, appendSuggestions],
  )

  const markAccepted = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setSuggestions((prev) => prev.map((s) => (idSet.has(s.id) ? { ...s, status: 'accepted' as const } : s)))
  }, [])

  return {
    suggestions,
    pending,
    pendingFiltered,
    pendingOnFrame,
    smartHints,
    needsReviewCount,
    busy,
    status,
    setStatus,
    settings,
    setSettings,
    showReviewOnly,
    setShowReviewOnly,
    modelsAvailable,
    segPrompts,
    setSegPrompts,
    clearSuggestions,
    rejectSuggestion,
    rejectAll,
    markAccepted,
    runDetect,
    runSegment,
    runPose,
    runTrack,
    runSmartAnalysis,
    runReTrack,
  }
}

export type UseAiSuggestionsReturn = ReturnType<typeof useAiSuggestions>
