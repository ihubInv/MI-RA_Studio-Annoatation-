import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FolderTree, Keyboard, Moon, Sparkles, Sun, Tags } from 'lucide-react'
import { datasetsService } from '@/services/datasets.service'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { DatasetExplorer } from '@/features/datasets/components/DatasetExplorer'
import { StorageBadge } from '@/features/datasets/components/StorageBadge'
import { getLocalBlob } from '@/features/datasets/local/registry'
import { VideoTransportBar } from '@/modules/video/components/VideoTransportBar'
import { VideoTimeline } from '@/modules/video/components/VideoTimeline'
import { VideoViewport } from '@/modules/video/components/VideoViewport'
import { useVideoPlayer } from '@/modules/video/hooks/useVideoPlayer'
import { useVideoAnnotations } from '@/modules/video/hooks/useVideoAnnotations'
import { videoService } from '@/modules/video/api/video.service'
import { formatBytes, formatDuration } from '@/modules/video/constants'
import type { VideoTool } from '@/modules/video/canvas/types'
import { LabelManager } from '@/modules/video/panels/LabelManager'
import { VideoRightPanel } from '@/modules/video/panels/VideoRightPanel'
import { loadVideoLabelSchema, saveVideoLabelSchema, type VideoLabelSchema } from '@/modules/video/schema/labelStore'
import {
  getActiveTemplate,
  loadSkeletonTemplateSchema,
  saveSkeletonTemplateSchema,
  type SkeletonTemplateSchema,
} from '@/modules/video/schema/skeletonTemplateStore'
import { SkeletonTemplateManager } from '@/modules/video/panels/SkeletonTemplateManager'
import { VideoAiPanel } from '@/modules/video/panels/VideoAiPanel'
import {
  suggestionToMask,
  suggestionToRect,
  suggestionToSkeleton,
  type AiDetectSuggestion,
  type AiSmartHint,
  type AiSuggestion,
} from '@/modules/video/ai/mapAiResults'
import { interpolatedBboxAt } from '@/modules/video/ai/smartTrack'
import { useAiSuggestions } from '@/modules/video/hooks/useAiSuggestions'
import { useVideoEvents } from '@/modules/video/hooks/useVideoEvents'
import { useVideoActions } from '@/modules/video/hooks/useVideoActions'
import { useVideoRelations } from '@/modules/video/hooks/useVideoRelations'
import { useVideoTrajectories } from '@/modules/video/hooks/useVideoTrajectories'
import { useVideoAudio } from '@/modules/video/hooks/useVideoAudio'
import { useVideoScenes } from '@/modules/video/hooks/useVideoScenes'
import { useCameraGroup } from '@/modules/video/hooks/useCameraGroup'
import { useCrossCameraLinks } from '@/modules/video/hooks/useCrossCameraLinks'
import {
  loadVideoSceneSchema,
  saveVideoSceneSchema,
  type VideoSceneSchema,
} from '@/modules/video/schema/sceneStore'
import { SceneDefinitionManager } from '@/modules/video/panels/SceneDefinitionManager'
import { MultiCameraGrid } from '@/modules/video/components/MultiCameraGrid'
import { detectScenesFromVideo } from '@/modules/video/scenes/detectScenes'
import { scenesToSpanRows } from '@/modules/video/scenes/sceneTimeline'
import { loadAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import type { ReIdCandidate } from '@/modules/video/multicamera/crossCameraStore'
import {
  loadVideoEventSchema,
  saveVideoEventSchema,
  type VideoEventSchema,
} from '@/modules/video/schema/eventStore'
import {
  loadVideoActionSchema,
  saveVideoActionSchema,
  type VideoActionSchema,
} from '@/modules/video/schema/actionStore'
import {
  loadVideoRelationSchema,
  saveVideoRelationSchema,
  type VideoRelationSchema,
} from '@/modules/video/schema/relationStore'
import { EventDefinitionManager } from '@/modules/video/panels/EventDefinitionManager'
import { ActionDefinitionManager } from '@/modules/video/panels/ActionDefinitionManager'
import { RelationDefinitionManager } from '@/modules/video/panels/RelationDefinitionManager'
import type { SpanLaneRow } from '@/modules/video/components/TimelineSpanLanes'
import { relationRowTitle } from '@/modules/video/relations/relationTimeline'
import { VideoOpsPanel } from '@/modules/video/panels/VideoOpsPanel'
import { KeyboardShortcutsModal } from '@/modules/video/panels/KeyboardShortcutsModal'
import { useRgbD } from '@/modules/video/hooks/useRgbD'
import { useLidar } from '@/modules/video/hooks/useLidar'
import { useVideoReview } from '@/modules/video/hooks/useVideoReview'
import { useVideoCollab } from '@/modules/video/hooks/useVideoCollab'
import { useAnnotationVersions } from '@/modules/video/hooks/useAnnotationVersions'
import { useVideoCloudSync } from '@/modules/video/hooks/useVideoCloudSync'
import { useAuthStore } from '@/stores/authStore'
import { initTheme, toggleTheme } from '@/modules/video/ux/theme'
import { cn } from '@/utils/cn'

export function VideoStudioPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const [params] = useSearchParams()
  const folderParam = params.get('folder')
  const navigate = useNavigate()
  const [showTree, setShowTree] = useState(true)
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({})
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingSrc, setLoadingSrc] = useState(true)
  const [annotationFullscreen, setAnnotationFullscreen] = useState(false)
  const [showLabelManager, setShowLabelManager] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [schema, setSchema] = useState<VideoLabelSchema>(() => loadVideoLabelSchema('default'))
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null)
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({})
  const [tool, setTool] = useState<VideoTool>('select')
  const [mergeCandidateId, setMergeCandidateId] = useState<string | null>(null)
  const [showSkeletonTemplates, setShowSkeletonTemplates] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [showEventManager, setShowEventManager] = useState(false)
  const [showActionManager, setShowActionManager] = useState(false)
  const [showRelationManager, setShowRelationManager] = useState(false)
  const [showSceneManager, setShowSceneManager] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [showMultiCameraGrid] = useState(true)
  const [maskDraftStroke, setMaskDraftStroke] = useState<{ points: { x: number; y: number }[] } | null>(null)
  const [skeletonSchema, setSkeletonSchema] = useState<SkeletonTemplateSchema>(() =>
    loadSkeletonTemplateSchema('default'),
  )
  const [eventSchema, setEventSchema] = useState<VideoEventSchema>(() => loadVideoEventSchema('default'))
  const [actionSchema, setActionSchema] = useState<VideoActionSchema>(() => loadVideoActionSchema('default'))
  const [relationSchema, setRelationSchema] = useState<VideoRelationSchema>(() =>
    loadVideoRelationSchema('default'),
  )
  const [sceneSchema, setSceneSchema] = useState<VideoSceneSchema>(() => loadVideoSceneSchema('default'))

  const annotations = useVideoAnnotations(itemId)
  const cloudSync = useVideoCloudSync(itemId)
  const videoEvents = useVideoEvents(itemId)
  const videoActions = useVideoActions(itemId)
  const videoRelations = useVideoRelations(itemId)
  const videoTrajectories = useVideoTrajectories(itemId)
  const videoAudio = useVideoAudio(itemId)
  const videoScenes = useVideoScenes(itemId)
  const user = useAuthStore((s) => s.user)
  const username = user?.username || user?.email || 'annotator'
  const role = user?.role || 'annotator'
  const lidar = useLidar(itemId)
  const review = useVideoReview(itemId, username)
  const collab = useVideoCollab(itemId, username)
  const versions = useAnnotationVersions(itemId, username)
  const ai = useAiSuggestions(itemId)
  const trackObjectIds = useRef<Map<string, string>>(new Map())
  const activeLabel = schema.labels.find((l) => l.id === activeLabelId) ?? null

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['dataset-item', itemId],
    queryFn: () => datasetsService.getItem(itemId!),
    enabled: Boolean(itemId),
  })

  const { data: dataset } = useQuery({
    queryKey: ['dataset', item?.dataset_id],
    queryFn: () => datasetsService.get(item!.dataset_id),
    enabled: Boolean(item?.dataset_id),
  })

  const schemaKey = item?.dataset_id || 'default'

  const cameraGroup = useCameraGroup(item?.dataset_id, itemId)
  const crossCamera = useCrossCameraLinks(item?.dataset_id)
  const rgbD = useRgbD(itemId, item?.width ?? 1280, item?.height ?? 720)

  useEffect(() => {
    initTheme()
  }, [])

  useEffect(() => {
    const loaded = loadVideoLabelSchema(schemaKey)
    setSchema(loaded)
    setActiveLabelId((current) => current && loaded.labels.some((l) => l.id === current) ? current : loaded.labels.find((l) => l.enabled)?.id ?? null)
    setAttributeValues({})
  }, [schemaKey])

  useEffect(() => {
    const loaded = loadSkeletonTemplateSchema(schemaKey)
    setSkeletonSchema(loaded)
    const loadedEvents = loadVideoEventSchema(schemaKey)
    setEventSchema(loadedEvents)
    videoEvents.setActiveEventDefId(loadedEvents.events.find((e) => e.enabled)?.id ?? null)
    const loadedActions = loadVideoActionSchema(schemaKey)
    setActionSchema(loadedActions)
    videoActions.setActiveActionDefId(loadedActions.actions.find((a) => a.enabled)?.id ?? null)
    const loadedRelations = loadVideoRelationSchema(schemaKey)
    setRelationSchema(loadedRelations)
    videoRelations.setActiveRelationDefId(loadedRelations.relations.find((r) => r.enabled)?.id ?? null)
    const loadedScenes = loadVideoSceneSchema(schemaKey)
    setSceneSchema(loadedScenes)
    const firstSceneType = loadedScenes.scenes.find((s) => s.kind === 'scene' && s.enabled)
    videoScenes.setActiveSceneDefId(firstSceneType?.id ?? null)
  }, [schemaKey])

  useEffect(() => {
    saveSkeletonTemplateSchema(skeletonSchema)
  }, [skeletonSchema])

  useEffect(() => {
    saveVideoEventSchema(eventSchema)
  }, [eventSchema])

  useEffect(() => {
    saveVideoActionSchema(actionSchema)
  }, [actionSchema])

  useEffect(() => {
    saveVideoRelationSchema(relationSchema)
  }, [relationSchema])

  useEffect(() => {
    saveVideoSceneSchema(sceneSchema)
  }, [sceneSchema])

  useEffect(() => {
    saveVideoLabelSchema(schema)
  }, [schema])

  const activeSkeletonTemplate = useMemo(
    () => getActiveTemplate(skeletonSchema),
    [skeletonSchema],
  )

  const { data: probe } = useQuery({
    queryKey: ['video-probe', itemId],
    queryFn: () => videoService.probe(itemId!),
    enabled: Boolean(itemId) && !item?.is_local,
    refetchInterval: (q) => (q.state.data?.status === 'processing' ? 3000 : false),
  })

  const { data: treeData } = useQuery({
    queryKey: ['dataset-tree', item?.dataset_id],
    queryFn: () => datasetsService.tree(item!.dataset_id),
    enabled: Boolean(item?.dataset_id) && showTree && !annotationFullscreen,
  })

  const { data: navIndex } = useQuery({
    queryKey: ['dataset-index', item?.dataset_id, folderParam],
    queryFn: () =>
      datasetsService.itemIndex(item!.dataset_id, {
        folder: folderParam || undefined,
        recursive: true,
      }),
    enabled: Boolean(item?.dataset_id),
  })

  const siblingItems = navIndex?.items ?? []
  const idx = siblingItems.findIndex((i) => i.id === itemId)
  const prev = idx > 0 ? siblingItems[idx - 1] : null
  const next = idx >= 0 && idx < siblingItems.length - 1 ? siblingItems[idx + 1] : null

  const isLocal = item?.is_local || (item?.storage_path || '').startsWith('local:')
  const isProcessing = item?.status === 'processing' || probe?.status === 'processing'
  const playbackUrl = probe?.preview_url || probe?.media_url || item?.playback_url || item?.media_url || null
  const posterUrl = probe?.preview_thumbnail_url || probe?.thumbnail_url || item?.thumbnail_url || null

  const frameIndex = useMemo(() => {
    if (probe?.frame_index) return probe.frame_index
    if (item?.fps && item.duration_seconds != null) {
      return {
        version: '1',
        frame_count: item.frame_count || 0,
        fps: item.fps,
        duration_sec: item.duration_seconds,
      }
    }
    return null
  }, [probe, item])

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    async function load() {
      if (!item) return
      setLoadingSrc(true)
      setLoadError(null)
      try {
        if (isLocal) {
          const blob = await getLocalBlob(item.dataset_id, item.relative_path || item.original_filename || item.filename)
          objectUrl = URL.createObjectURL(blob)
          if (!cancelled) setVideoSrc(objectUrl)
          return
        }
        if (isProcessing && !playbackUrl) {
          if (!cancelled) setVideoSrc(null)
          return
        }
        if (!playbackUrl) throw new Error('Video source is not available')
        if (!cancelled) setVideoSrc(playbackUrl)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load video')
          setVideoSrc(null)
        }
      } finally {
        if (!cancelled) setLoadingSrc(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [itemId, item?.dataset_id, item?.relative_path, item?.original_filename, item?.filename, isLocal, playbackUrl, isProcessing])

  const player = useVideoPlayer({
    src: videoSrc,
    frameIndex,
    fps: probe?.fps ?? item?.fps ?? 30,
    durationSec: probe?.duration_seconds ?? item?.duration_seconds,
    frameCount: probe?.frame_count ?? item?.frame_count,
  })

  const frameObjects = useMemo(
    () => annotations.objectsOnFrame(player.currentFrame),
    [annotations.objectsOnFrame, player.currentFrame],
  )

  const frameSkeletons = useMemo(
    () => annotations.skeletonsOnFrame(player.currentFrame),
    [annotations.skeletonsOnFrame, player.currentFrame],
  )

  const frameMasks = useMemo(
    () => annotations.masksOnFrame(player.currentFrame),
    [annotations.masksOnFrame, player.currentFrame],
  )

  const selectedDisplay = useMemo(
    () => annotations.selectedAtFrame(player.currentFrame),
    [annotations.selectedAtFrame, player.currentFrame],
  )

  const activeTrack = useMemo(
    () => (selectedDisplay ? annotations.getTrack(selectedDisplay.object_id) : null),
    [annotations.getTrack, selectedDisplay],
  )

  useEffect(() => {
    if (!annotations.selectedId) return
    const display = annotations.displayAtFrame(player.currentFrame)
    const current = display.find((o) => o.id === annotations.selectedId)
    if (current) return
    const objectId =
      annotations.selected?.object_id ??
      (annotations.selectedId.startsWith('interp:')
        ? annotations.selectedId.slice('interp:'.length)
        : null)
    if (!objectId) {
      annotations.setSelectedId(null)
      return
    }
    const next = display.find((o) => o.object_id === objectId)
    if (next) annotations.setSelectedId(next.id)
    else annotations.setSelectedId(null)
  }, [
    player.currentFrame,
    annotations.selectedId,
    annotations.selected,
    annotations.displayAtFrame,
    annotations.setSelectedId,
  ])

  useEffect(() => {
    if (!selectedDisplay) return
    setShowLabels(true)
    const label = schema.labels.find((l) => l.name === selectedDisplay.label)
    if (label) setActiveLabelId(label.id)
    setAttributeValues((selectedDisplay.attributes as Record<string, unknown>) ?? {})
  }, [selectedDisplay?.id, schema.labels])

  const handleCreateObject = useCallback(
    (obj: Parameters<typeof annotations.addObject>[0]) => {
      annotations.addObject({
        ...obj,
        attributes: { ...attributeValues },
      })
    },
    [annotations.addObject, attributeValues],
  )

  const handleCreateSkeleton = useCallback(
    (obj: Parameters<typeof annotations.addSkeleton>[0]) => {
      annotations.addSkeleton({
        ...obj,
        attributes: { ...attributeValues },
      })
    },
    [annotations.addSkeleton, attributeValues],
  )

  const eventTimelineRows = useMemo(
    () => videoEvents.timelineRows(eventSchema.events),
    [videoEvents, eventSchema.events],
  )

  const actionSpanRows = useMemo((): SpanLaneRow[] => {
    return videoActions.timelineRows(actionSchema.actions).map((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      items: row.items.map((a) => ({
        id: a.id,
        frame: a.frame,
        end_frame: a.end_frame,
        color: a.color,
        title: `${a.label} · ${a.actor_object_id}`,
        subtitle: a.actor_object_id,
      })),
    }))
  }, [videoActions, actionSchema.actions])

  const relationSpanRows = useMemo((): SpanLaneRow[] => {
    return videoRelations.timelineRows(relationSchema.relations).map((row) => ({
      id: row.id,
      label: row.label,
      color: row.color,
      items: row.items.map((r) => ({
        id: r.id,
        frame: r.frame,
        end_frame: r.end_frame,
        color: r.color,
        title: relationRowTitle(r),
        subtitle: r.object_object_id,
      })),
    }))
  }, [videoRelations, relationSchema.relations])

  const handleCreateTimelineInstant = useCallback(
    (eventDefId: string, frame: number) => {
      const def = eventSchema.events.find((d) => d.id === eventDefId)
      if (!def) return
      annotations.setSelectedId(null)
      videoEvents.addInstantEvent(def, frame)
    },
    [eventSchema.events, videoEvents, annotations],
  )

  const handleCreateTimelineInterval = useCallback(
    (eventDefId: string, start: number, end: number) => {
      const def = eventSchema.events.find((d) => d.id === eventDefId)
      if (!def) return
      videoEvents.addIntervalEvent(def, start, end)
      annotations.setSelectedId(null)
    },
    [eventSchema.events, videoEvents, annotations],
  )

  const handleCreateActionSpan = useCallback(
    (actionDefId: string, start: number, end: number) => {
      const def = actionSchema.actions.find((d) => d.id === actionDefId)
      const actor = selectedDisplay?.object_id
      if (!def || !actor) return
      videoActions.addActionSpan(def, actor, start, end)
      videoEvents.selectEvent(null)
      videoRelations.selectRelation(null)
      annotations.setSelectedId(null)
    },
    [actionSchema.actions, selectedDisplay, videoActions, videoEvents, videoRelations, annotations],
  )

  const handleCreateRelationSpan = useCallback(
    (relationDefId: string, start: number, end: number) => {
      const def = relationSchema.relations.find((d) => d.id === relationDefId)
      const subject = selectedDisplay?.object_id
      const objectId = videoRelations.relationTargetId
      if (!def || !subject || !objectId) return
      videoRelations.addRelationSpan(def, subject, objectId, start, end)
      videoEvents.selectEvent(null)
      videoActions.selectAction(null)
      annotations.setSelectedId(null)
    },
    [
      relationSchema.relations,
      selectedDisplay,
      videoRelations,
      videoEvents,
      videoActions,
      annotations,
    ],
  )

  const fps = probe?.fps ?? item?.fps ?? 30
  const maxFrame = player.maxFrame ?? 0
  const hasAudio = Boolean(probe?.audio?.codec)

  const handleGenerateTrajectory = useCallback(() => {
    const objectId = selectedDisplay?.object_id
    if (!objectId) return
    videoTrajectories.generateForObject(annotations.objects, objectId, fps, maxFrame)
  }, [selectedDisplay, videoTrajectories, annotations.objects, fps, maxFrame])

  const handleExtractAudio = useCallback(() => {
    if (!videoSrc) return
    void videoAudio.extractWaveform(videoSrc, isLocal)
  }, [videoSrc, isLocal, videoAudio])

  const handleCreateAudioSegment = useCallback(
    (start: number, end: number) => {
      if (!frameIndex) return
      videoAudio.addSegment(start, end, frameIndex)
    },
    [videoAudio, frameIndex],
  )

  const sceneSpanRows = useMemo((): SpanLaneRow[] => {
    return scenesToSpanRows(videoScenes.timelineRows(sceneSchema.scenes))
  }, [videoScenes, sceneSchema.scenes])

  const datasetVideos = useMemo(
    () =>
      siblingItems.map((i) => ({
        id: i.id,
        name: i.relative_path || i.filename || i.id,
      })),
    [siblingItems],
  )

  const multiCameraFeeds = useMemo(() => {
    const group = cameraGroup.activeGroup
    if (!group) return []
    return group.cameras.map((slot) => ({
      slot,
      src: slot.item_id === itemId ? videoSrc : null,
      poster: slot.item_id === itemId ? posterUrl : null,
      loading: slot.item_id === itemId ? loadingSrc : false,
    }))
  }, [cameraGroup.activeGroup, itemId, videoSrc, posterUrl, loadingSrc])

  const reIdCandidates = useMemo((): ReIdCandidate[] => {
    if (!itemId || !selectedDisplay?.object_id || !cameraGroup.activeGroup) return []
    const others: { item_id: string; object_id: string; label: string; frame: number }[] = []
    for (const slot of cameraGroup.activeGroup.cameras) {
      if (slot.item_id === itemId) continue
      const rects = loadAnnotationStore(slot.item_id).rects
      for (const o of rects) {
        others.push({
          item_id: slot.item_id,
          object_id: o.object_id,
          label: o.label,
          frame: o.frame + slot.offset_frames,
        })
      }
    }
    return crossCamera.suggestReId(
      itemId,
      selectedDisplay.object_id,
      selectedDisplay.label,
      player.currentFrame,
      others,
      fps,
    )
  }, [itemId, selectedDisplay, cameraGroup.activeGroup, crossCamera, player.currentFrame, fps])

  const handleCreateSceneSpan = useCallback(
    (rowId: string, start: number, end: number) => {
      if (rowId !== 'scene') return
      const def = sceneSchema.scenes.find((d) => d.kind === 'scene' && d.enabled)
      if (!def) return
      videoScenes.addSceneSpan(def, start, end)
      videoEvents.selectEvent(null)
      videoRelations.selectRelation(null)
      videoActions.selectAction(null)
    },
    [sceneSchema.scenes, videoScenes, videoEvents, videoRelations, videoActions],
  )

  const handleCreateSceneMarker = useCallback(
    (rowId: string, frame: number) => {
      const kind = rowId as 'shot_boundary' | 'camera_cut'
      const def = sceneSchema.scenes.find((d) => d.kind === kind && d.enabled)
      if (!def) return
      videoScenes.addMarker(def, frame, kind)
    },
    [sceneSchema.scenes, videoScenes],
  )

  const handleAutoDetectScenes = useCallback(async () => {
    const v = player.videoRef.current
    if (!v || !videoSrc) return
    videoScenes.setDetecting(true)
    try {
      const result = await detectScenesFromVideo(v, maxFrame, fps, sceneSchema.scenes, {}, (pct) => {
        if (pct >= 1) videoScenes.setDetecting(false)
      })
      videoScenes.mergeDetected(result.scenes)
    } finally {
      videoScenes.setDetecting(false)
    }
  }, [player, videoSrc, maxFrame, fps, sceneSchema.scenes, videoScenes])

  const handleReIdLink = useCallback(
    (candidate: ReIdCandidate) => {
      if (!itemId || !selectedDisplay?.object_id) return
      crossCamera.linkObject(
        itemId,
        selectedDisplay.object_id,
        selectedDisplay.label,
        candidate.global_object_id,
        candidate.linkId || undefined,
      )
      crossCamera.linkObject(candidate.item_id, candidate.object_id, candidate.label, candidate.global_object_id)
    },
    [itemId, selectedDisplay, crossCamera],
  )

  const goToCameraItem = useCallback(
    (targetItemId: string) => {
      if (targetItemId === itemId) return
      const q = folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''
      navigate(`/annotate/video/${targetItemId}${q}`)
    },
    [itemId, folderParam, navigate],
  )

  const resolveObjectId = useCallback(
    (label: string, trackId?: string) => {
      if (trackId) {
        const existing = trackObjectIds.current.get(trackId)
        if (existing) return existing
        const id = annotations.nextObjectIdLabel(label)
        trackObjectIds.current.set(trackId, id)
        return id
      }
      return annotations.nextObjectIdLabel(label)
    },
    [annotations.nextObjectIdLabel],
  )

  const acceptSuggestion = useCallback(
    (s: AiSuggestion) => {
      const color = activeLabel?.color ?? '#0d559e'
      const labelName = activeLabel?.name ?? s.class_name

      if (s.kind === 'smart_hint') {
        const hint = s as AiSmartHint
        if (hint.hint_type === 'keyframe' && hint.object_id) {
          const bbox = interpolatedBboxAt(annotations.objects, hint.object_id, hint.frame)
          if (bbox) {
            annotations.addObject({
              object_id: hint.object_id,
              label: bbox.label,
              frame: hint.frame,
              tool_type: bbox.tool_type,
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
              color,
              visible: true,
              locked: false,
              attributes: { source: 'smart_keyframe_hint', ...attributeValues },
            })
          } else {
            annotations.createKeyframe(hint.object_id, hint.frame)
          }
        } else if (hint.hint_type === 'reid' && hint.object_id && hint.linked_object_id) {
          annotations.mergeTracksWith(hint.object_id, hint.linked_object_id)
        }
        ai.markAccepted([s.id])
        if (hint.frame !== player.currentFrame) player.seekToFrame(hint.frame)
        return
      }

      if (s.kind === 'detect') {
        const object_id = resolveObjectId(labelName, s.track_id)
        const rect = suggestionToRect({ ...s, class_name: labelName }, object_id, color)
        annotations.addObject({ ...rect, attributes: { ...attributeValues, ...rect.attributes } })
      } else if (s.kind === 'segment') {
        const object_id = annotations.nextObjectIdLabel(labelName)
        const w = item?.width ?? 1280
        const h = item?.height ?? 720
        const mask = suggestionToMask({ ...s, class_name: labelName }, object_id, color, w, h)
        if (mask) {
          annotations.addMask({
            ...mask,
            attributes: { ...attributeValues, ...mask.attributes },
          })
        }
      } else if (s.kind === 'pose') {
        const object_id = annotations.nextObjectIdLabel(labelName)
        annotations.addSkeleton({
          ...suggestionToSkeleton({ ...s, class_name: labelName }, object_id, color),
          attributes: { ...attributeValues, ...suggestionToSkeleton(s, object_id, color).attributes },
        })
      }
      ai.markAccepted([s.id])
      if (s.frame !== player.currentFrame) player.seekToFrame(s.frame)
    },
    [
      activeLabel,
      attributeValues,
      annotations,
      ai,
      item?.width,
      item?.height,
      player,
      resolveObjectId,
    ],
  )

  const acceptAllPending = useCallback(() => {
    for (const s of ai.pendingFiltered) acceptSuggestion(s)
  }, [ai.pendingFiltered, acceptSuggestion])

  const runSmartAnalysis = useCallback(() => {
    setShowAiPanel(true)
    ai.runSmartAnalysis(annotations.objects, annotations.tracks, maxFrame)
  }, [ai, annotations.objects, annotations.tracks, maxFrame])

  const runReTrackSelected = useCallback(() => {
    const v = player.videoRef.current
    const objectId = selectedDisplay?.object_id
    if (!v || !objectId) return
    setShowAiPanel(true)
    void ai.runReTrack(v, annotations.objects, objectId, player.currentFrame, maxFrame, fps)
  }, [ai, player, selectedDisplay, annotations.objects, maxFrame, fps])

  const runAiDetect = useCallback(() => {
    const v = player.videoRef.current
    if (!v) return
    setShowAiPanel(true)
    setTool('ai_detect')
    void ai.runDetect(v, player.currentFrame)
  }, [ai, player])

  const runAiSegmentMode = useCallback(() => {
    setShowAiPanel(true)
    setTool('ai_segment')
    ai.setSegPrompts({ positive: [], negative: [] })
    ai.setStatus('Click to include. Alt+click or right-click to exclude. Enter to finish.')
  }, [ai])

  const runAiPoseMode = useCallback(() => {
    setShowAiPanel(true)
    setTool('ai_pose')
    ai.setStatus('Click where the person should be placed.')
  }, [ai])

  const runTrackForward = useCallback(() => {
    const v = player.videoRef.current
    if (!v) return
    const seeds = ai.pending.filter(
      (s): s is AiDetectSuggestion => s.kind === 'detect' && s.frame === player.currentFrame,
    )
    if (!seeds.length) return
    void ai.runTrack(v, { fromFrame: player.currentFrame, toFrame: maxFrame, fps, seeds })
  }, [ai, player, maxFrame, fps])

  const runTrackBackward = useCallback(() => {
    const v = player.videoRef.current
    if (!v) return
    const seeds = ai.pending.filter(
      (s): s is AiDetectSuggestion => s.kind === 'detect' && s.frame === player.currentFrame,
    )
    if (!seeds.length) return
    void ai.runTrack(v, { fromFrame: player.currentFrame, toFrame: 0, fps, seeds })
  }, [ai, player, fps])

  const controlsDisabled = !videoSrc || Boolean(loadError)

  const togglePlayPause = useCallback(() => {
    if (controlsDisabled) return
    player.isPlaying ? player.pause() : player.play()
  }, [controlsDisabled, player])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') return
      if (controlsDisabled) return

      if (e.key === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault()
        player.jumpFrames(-10)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        player.prevFrame()
      }
      if (e.key === 'ArrowRight' && e.shiftKey) {
        e.preventDefault()
        player.jumpFrames(10)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        player.nextFrame()
      }
      if (e.key === 'Home') {
        e.preventDefault()
        player.firstFrame()
      }
      if (e.key === 'End') {
        e.preventDefault()
        player.lastFrame()
      }
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setAnnotationFullscreen((v) => !v)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && videoScenes.selectedSceneId) {
        e.preventDefault()
        videoScenes.deleteSelected()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && videoRelations.selectedRelationId) {
        e.preventDefault()
        videoRelations.deleteSelected()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && videoActions.selectedActionId) {
        e.preventDefault()
        videoActions.deleteSelected()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && videoEvents.selectedEventId) {
        e.preventDefault()
        videoEvents.deleteSelected()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && annotations.selectedId) {
        const sel = selectedDisplay
        if (sel?.locked) return
        e.preventDefault()
        annotations.deleteSelected()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedDisplay) {
        e.preventDefault()
        annotations.copySelected(player.currentFrame)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        annotations.pasteAtFrame(player.currentFrame)
      }
      if (e.key.toLowerCase() === 'v' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('select')
      }
      if (e.key.toLowerCase() === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('bbox')
      }
      if (e.key.toLowerCase() === 'k' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const sel = selectedDisplay ?? annotations.selected
        if (sel) {
          annotations.createKeyframe(sel.object_id, player.currentFrame)
        }
      }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('rectangle')
      }
      if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('rotated_rect')
      }
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('polygon')
      }
      if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('polyline')
      }
      if (e.key.toLowerCase() === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('point')
      }
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('ellipse')
      }
      if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('keypoints')
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        annotations.undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        annotations.redo()
      }
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('brush')
      }
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('eraser')
      }
      if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('mask')
      }
      if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setTool('pan')
      }
      const eventHot = eventSchema.events.find(
        (ev) => ev.enabled && ev.hotkey && ev.hotkey.toLowerCase() === e.key.toLowerCase(),
      )
      if (eventHot && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        videoEvents.setActiveEventDefId(eventHot.id)
        if (eventHot.kind === 'instant') {
          videoEvents.addInstantEvent(eventHot, player.currentFrame)
        } else if (eventHot.kind === 'interval') {
          if (!videoEvents.intervalDraft || videoEvents.intervalDraft.eventDefId !== eventHot.id) {
            videoEvents.beginInterval(eventHot.id, player.currentFrame)
          } else {
            videoEvents.addIntervalEvent(
              eventHot,
              videoEvents.intervalDraft.startFrame,
              player.currentFrame,
            )
          }
        } else if (e.shiftKey) {
          videoEvents.addInstantEvent(eventHot, player.currentFrame)
        } else if (!videoEvents.intervalDraft) {
          videoEvents.beginInterval(eventHot.id, player.currentFrame)
        } else {
          videoEvents.addIntervalEvent(
            eventHot,
            videoEvents.intervalDraft.startFrame,
            player.currentFrame,
          )
        }
        return
      }
      const actorId = selectedDisplay?.object_id ?? null
      const actionHot = actionSchema.actions.find(
        (a) => a.enabled && a.hotkey && a.hotkey.toLowerCase() === e.key.toLowerCase(),
      )
      if (actionHot && actorId && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        videoActions.setActiveActionDefId(actionHot.id)
        if (!videoActions.intervalDraft || videoActions.intervalDraft.actionDefId !== actionHot.id) {
          videoActions.beginInterval(actionHot.id, actorId, player.currentFrame)
        } else {
          videoActions.addActionSpan(
            actionHot,
            actorId,
            videoActions.intervalDraft.startFrame,
            player.currentFrame,
          )
        }
        return
      }
      const hot = schema.labels.find(
        (l) => l.enabled && l.hotkey && l.hotkey.toLowerCase() === e.key.toLowerCase() && l.hotkey.toLowerCase() !== 'f',
      )
      if (hot && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setActiveLabelId(hot.id)
        setAttributeValues({})
      }
      if (e.key === '[' && prev) {
        navigate(`/annotate/video/${prev.id}${folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''}`)
      }
      if (e.key === ']' && next) {
        navigate(`/annotate/video/${next.id}${folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''}`)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    controlsDisabled,
    player,
    prev,
    next,
    navigate,
    folderParam,
    schema.labels,
    eventSchema.events,
    actionSchema.actions,
    annotations,
    selectedDisplay,
    videoEvents,
    videoActions,
    videoRelations,
    videoScenes,
    player.currentFrame,
  ])

  const goItem = (id?: string) => {
    if (!id) return
    const q = folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''
    navigate(`/annotate/video/${id}${q}`)
  }

  if (itemLoading || !item) {
    return (
      <div className="h-screen flex items-center justify-center bg-workspace text-muted-foreground text-sm">
        Loading video studio…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-workspace overflow-hidden">
      {!annotationFullscreen && (
        <header className="h-14 shrink-0 bg-white border-b border-border flex items-center justify-between px-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={`/datasets/${item.dataset_id}`}
              className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <BrandLogo className="h-8 max-w-[160px] hidden sm:block" to="/dashboard" />
            <div className="w-px h-5 bg-border hidden sm:block shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {item.relative_path || item.original_filename || item.filename}
              </p>
              <p className="text-2xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <StorageBadge mode={dataset?.storage_mode || (isLocal ? 'local' : 'server')} compact />
                <span>
                  {item.width}×{item.height}
                  {item.fps ? ` · ${item.fps.toFixed(2)} fps` : ''}
                  {item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ''}
                  {item.file_size_bytes ? ` · ${formatBytes(item.file_size_bytes)}` : ''}
                  {idx >= 0 ? ` · ${idx + 1}/${siblingItems.length}` : ''}
                </span>
                {isProcessing && <span className="text-amber-700">· Processing</span>}
                {probe?.preview_url && probe.preview_url !== probe.media_url && (
                  <span className="text-sky-700">· Proxy playback</span>
                )}
                <span
                  className={
                    cloudSync.state === 'synced'
                      ? 'text-emerald-700'
                      : cloudSync.state === 'error'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }
                >
                  ·{' '}
                  {cloudSync.state === 'synced'
                    ? 'Saved to server'
                    : cloudSync.state === 'pending'
                      ? 'Saving…'
                      : cloudSync.state === 'loading'
                        ? 'Loading…'
                        : cloudSync.state === 'error'
                          ? 'Server save failed'
                          : 'Local until save'}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTree((v) => !v)} className="mira-btn-ghost text-xs h-8" title="Dataset tree">
              <FolderTree className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowAiPanel((v) => !v)
                if (!showAiPanel) setShowLabels(false)
              }}
              className={cn('mira-btn-ghost text-xs h-8', showAiPanel && 'bg-brand-orange/10 text-brand-orange')}
              title="AI Assist"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI
            </button>
            <button
              onClick={() => setShowLabels((v) => !v)}
              className={cn('mira-btn-ghost text-xs h-8', showLabels && 'bg-accent')}
              title="Labels"
            >
              <Tags className="w-3.5 h-3.5" /> Labels
            </button>
            <button
              type="button"
              className="mira-btn-ghost text-xs h-8"
              title="Keyboard shortcuts"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="mira-btn-ghost text-xs h-8"
              title="Toggle theme"
              onClick={() => setDark(toggleTheme() === 'dark')}
            >
              {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setShowLabelManager(true)} className="mira-btn-ghost text-xs h-8">
              Manage
            </button>
            <button
              type="button"
              className="mira-btn-ghost text-xs h-8"
              title="Save annotations to server now"
              onClick={() => void cloudSync.flushNow()}
            >
              Save
            </button>
            <button onClick={() => goItem(prev?.id)} disabled={!prev} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30">
              Prev
            </button>
            <button onClick={() => goItem(next?.id)} disabled={!next} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30">
              Next
            </button>
          </div>
        </header>
      )}

      <div className="flex flex-1 min-h-0">
        {!annotationFullscreen && showTree && treeData?.tree && (
          <aside className="w-56 shrink-0 bg-white border-r border-border overflow-auto p-2">
            <p className="mira-section-label px-1 py-1">Dataset</p>
            <DatasetExplorer
              node={treeData.tree}
              selectedPath={item.parent_folder || folderParam || ''}
              onSelect={(path) => {
                const q = path ? `?folder=${encodeURIComponent(path)}` : ''
                navigate(`/annotate/video/${item.id}${q}`)
              }}
              expanded={treeExpanded}
              onToggle={(path) => setTreeExpanded((e) => ({ ...e, [path]: e[path] === false }))}
            />
          </aside>
        )}

        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          {!annotationFullscreen && isProcessing && !videoSrc && (
            <div className="shrink-0 mx-4 mt-3 px-3 py-2 text-xs bg-amber-50 border border-amber-200 rounded-md text-amber-900">
              Video is processing (metadata, thumbnails, proxies). Playback will start when ready…
            </div>
          )}
          {!annotationFullscreen && showMultiCameraGrid && cameraGroup.isMultiCamera && (
            <MultiCameraGrid
              feeds={multiCameraFeeds}
              masterFrame={player.currentFrame}
              fps={fps}
              activeItemId={itemId ?? null}
              masterItemId={cameraGroup.activeGroup?.master_item_id ?? null}
              onSelectCamera={goToCameraItem}
            />
          )}
          <VideoViewport
            ref={player.videoRef}
            src={videoSrc}
            poster={posterUrl}
            loading={loadingSrc && !videoSrc}
            error={loadError || probe?.processing_error || null}
            naturalWidth={item.width}
            naturalHeight={item.height}
            onSpaceTap={togglePlayPause}
            annotationFullscreen={annotationFullscreen}
            onAnnotationFullscreenChange={setAnnotationFullscreen}
            className={cn(isProcessing && !videoSrc && 'opacity-80')}
            tool={tool}
            onToolChange={setTool}
            currentFrame={player.currentFrame}
            frameObjects={frameObjects}
            frameSkeletons={frameSkeletons}
            frameMasks={frameMasks}
            skeletonTemplate={activeSkeletonTemplate}
            selectedId={annotations.selectedId}
            onSelect={annotations.setSelectedId}
            onCreateObject={handleCreateObject}
            onUpdateObject={(id, patch) =>
              annotations.updateAtFrame(id, player.currentFrame, patch)
            }
            onCreateSkeleton={handleCreateSkeleton}
            onUpdateSkeleton={(id, patch) =>
              annotations.updateSkeletonAtFrame(id, player.currentFrame, patch)
            }
            onBrushStroke={(points) =>
              annotations.handleBrushStroke(
                player.currentFrame,
                points,
                activeLabel?.name ?? 'Object',
                activeLabel?.color ?? '#0d559e',
              )
            }
            onEraserStroke={(points, targetId) => annotations.handleEraserStroke(points, targetId)}
            onPolygonMask={(points) =>
              annotations.handlePolygonMask(
                player.currentFrame,
                points,
                activeLabel?.name ?? 'Object',
                activeLabel?.color ?? '#0d559e',
              )
            }
            maskDraftStroke={maskDraftStroke}
            onMaskDraftStroke={(points) => setMaskDraftStroke(points ? { points } : null)}
            onContentSize={annotations.setContentSize}
            onNextObjectId={annotations.nextObjectIdLabel}
            activeLabelName={activeLabel?.name ?? 'Object'}
            activeLabelColor={activeLabel?.color ?? '#0d559e'}
            aiSuggestions={ai.pendingOnFrame(player.currentFrame)}
            segPrompts={ai.segPrompts}
            onSegPrompt={(positive, negative) => ai.setSegPrompts({ positive, negative })}
            onSegFinish={() => {
              const v = player.videoRef.current
              if (!v || !ai.segPrompts.positive.length) return
              void ai.runSegment(
                v,
                player.currentFrame,
                ai.segPrompts.positive,
                ai.segPrompts.negative,
                activeLabel?.name ?? 'Object',
              )
            }}
            onPoseClick={(pt) => {
              const v = player.videoRef.current
              if (!v) return
              void ai.runPose(v, player.currentFrame, pt, activeLabel?.name ?? 'Person')
              setTool('select')
            }}
            trajectories={videoTrajectories.showTrajectories ? videoTrajectories.trajectories : []}
            showTrajectories={videoTrajectories.showTrajectories}
            selectedObjectId={selectedDisplay?.object_id ?? null}
            rgbD={rgbD.state}
            lidar={lidar.state}
            currentTimeSec={player.currentTime}
          />
          {!annotationFullscreen && (
            <>
              <VideoTransportBar player={player} disabled={controlsDisabled} />
              <VideoTimeline
                player={player}
                disabled={controlsDisabled}
                tracks={annotations.timelineTracks}
                selectedObjectId={selectedDisplay?.object_id ?? null}
                selectedKeyframeFrame={
                selectedDisplay && 'interpolated' in selectedDisplay && selectedDisplay.interpolated
                  ? null
                  : selectedDisplay?.frame ?? null
                }
                onSelectTrack={(objectId) => {
                  const pick = annotations.selectByObjectId(objectId, player.currentFrame)
                  if (pick && pick.frame !== player.currentFrame) player.seekToFrame(pick.frame)
                }}
                onSelectKeyframe={(objectId, frame) => {
                  annotations.selectByObjectId(objectId, frame)
                  player.seekToFrame(frame)
                }}
                onCreateKeyframe={(objectId, frame) => {
                  annotations.createKeyframe(objectId, frame)
                  player.seekToFrame(frame)
                }}
                onMoveKeyframe={(objectId, from, to) => {
                  annotations.moveKeyframeAt(objectId, from, to)
                  player.seekToFrame(to)
                  annotations.selectByObjectId(objectId, to)
                }}
                onDeleteKeyframe={(objectId, frame) => {
                  annotations.deleteKeyframe(objectId, frame)
                }}
                onDuplicateKeyframe={(objectId, from, to) => {
                  annotations.duplicateKeyframeAt(objectId, from, to)
                  player.seekToFrame(to)
                }}
                onTrackForward={(objectId, from, to) => {
                  annotations.trackForward(objectId, from, to)
                  player.seekToFrame(to)
                }}
                onTrackBackward={(objectId, from, to) => {
                  annotations.trackBackward(objectId, from, to)
                  player.seekToFrame(to)
                }}
                onSplitTrack={(objectId, at) => {
                  annotations.splitTrackAt(objectId, at)
                }}
                eventRows={eventTimelineRows}
                eventDefinitions={eventSchema.events}
                selectedEventId={videoEvents.selectedEventId}
                intervalDraft={videoEvents.intervalDraft}
                onSelectEvent={(id) => {
                  videoEvents.selectEvent(id)
                  videoActions.selectAction(null)
                  videoRelations.selectRelation(null)
                  annotations.setSelectedId(null)
                  const ev = videoEvents.events.find((e) => e.id === id)
                  if (ev) player.seekToFrame(ev.frame)
                }}
                onCreateInstantEvent={handleCreateTimelineInstant}
                onCreateIntervalEvent={handleCreateTimelineInterval}
                actionSpanRows={actionSpanRows}
                selectedActionId={videoActions.selectedActionId}
                actionIntervalDraft={
                  videoActions.intervalDraft
                    ? {
                        rowId: videoActions.intervalDraft.actionDefId,
                        startFrame: videoActions.intervalDraft.startFrame,
                        endFrame: player.currentFrame,
                      }
                    : null
                }
                onSelectAction={(id) => {
                  videoActions.selectAction(id)
                  videoEvents.selectEvent(null)
                  videoRelations.selectRelation(null)
                  annotations.setSelectedId(null)
                }}
                onCreateActionSpan={handleCreateActionSpan}
                relationSpanRows={relationSpanRows}
                selectedRelationId={videoRelations.selectedRelationId}
                relationIntervalDraft={
                  videoRelations.intervalDraft
                    ? {
                        rowId: videoRelations.intervalDraft.relationDefId,
                        startFrame: videoRelations.intervalDraft.startFrame,
                        endFrame: player.currentFrame,
                      }
                    : null
                }
                onSelectRelation={(id) => {
                  videoRelations.selectRelation(id)
                  videoEvents.selectEvent(null)
                  videoActions.selectAction(null)
                  annotations.setSelectedId(null)
                }}
                onCreateRelationSpan={handleCreateRelationSpan}
                sceneSpanRows={sceneSpanRows}
                selectedSceneId={videoScenes.selectedSceneId}
                sceneIntervalDraft={
                  videoScenes.intervalDraft
                    ? {
                        rowId: 'scene',
                        startFrame: videoScenes.intervalDraft.startFrame,
                        endFrame: player.currentFrame,
                      }
                    : null
                }
                onSelectScene={(id) => {
                  videoScenes.selectScene(id)
                  videoEvents.selectEvent(null)
                  videoActions.selectAction(null)
                  videoRelations.selectRelation(null)
                  annotations.setSelectedId(null)
                }}
                onCreateSceneSpan={handleCreateSceneSpan}
                onCreateSceneMarker={handleCreateSceneMarker}
                showAudioLane={hasAudio || Boolean(videoAudio.waveform) || videoAudio.segments.length > 0}
                audioWaveform={videoAudio.waveform}
                audioSegments={videoAudio.segments}
                audioTranscriptions={videoAudio.transcriptions}
                selectedAudioSegmentId={videoAudio.selectedSegmentId}
                audioSegmentDraft={
                  videoAudio.intervalDraft
                    ? {
                        startFrame: videoAudio.intervalDraft.startFrame,
                        endFrame: player.currentFrame,
                      }
                    : null
                }
                onSelectAudioSegment={(id) => {
                  videoAudio.selectSegment(id)
                  const seg = videoAudio.segments.find((s) => s.id === id)
                  if (seg) player.seekToFrame(seg.start_frame)
                }}
                onCreateAudioSegment={handleCreateAudioSegment}
                onSelectTranscription={(id) => {
                  videoAudio.selectTranscription(id)
                  const t = videoAudio.transcriptions.find((tr) => tr.id === id)
                  if (t) player.seekToFrame(t.start_frame)
                }}
              />
            </>
          )}
        </main>
        {!annotationFullscreen && showAiPanel && (
          <VideoAiPanel
            ai={ai}
            currentFrame={player.currentFrame}
            maxFrame={maxFrame}
            fps={fps}
            videoReady={Boolean(videoSrc) && !loadError}
            selectedObjectId={selectedDisplay?.object_id ?? null}
            onClose={() => setShowAiPanel(false)}
            onDetect={runAiDetect}
            onSegmentMode={runAiSegmentMode}
            onPoseMode={runAiPoseMode}
            onTrackForward={runTrackForward}
            onTrackBackward={runTrackBackward}
            onSmartAnalysis={runSmartAnalysis}
            onReTrack={runReTrackSelected}
            onAccept={acceptSuggestion}
            onAcceptAll={acceptAllPending}
            onReject={ai.rejectSuggestion}
          />
        )}
        {!annotationFullscreen && showLabels && !showAiPanel && (
          <VideoRightPanel
            schema={schema}
            selected={selectedDisplay}
            activeTrack={activeTrack}
            allTracks={annotations.tracks}
            mergeCandidateId={mergeCandidateId}
            onMergeCandidateChange={setMergeCandidateId}
            onMergeTracks={() => {
              if (!selectedDisplay || !mergeCandidateId) return
              annotations.mergeTracksWith(selectedDisplay.object_id, mergeCandidateId)
              setMergeCandidateId(null)
            }}
            objectEntries={annotations.objectEntries}
            activeLabelId={activeLabelId}
            attributeValues={attributeValues}
            onSelectLabel={(labelId) => {
              setActiveLabelId(labelId)
              setAttributeValues({})
            }}
            onAttributeChange={(values) => {
              setAttributeValues(values)
              if (selectedDisplay) {
                annotations.updateSelectedAtFrame(player.currentFrame, { attributes: values })
              }
            }}
            onOpenSkeletonTemplates={() => setShowSkeletonTemplates(true)}
            segmentationMode={annotations.segmentationMode}
            onSegmentationModeChange={annotations.setSegmentationMode}
            onUndo={annotations.undo}
            onRedo={annotations.redo}
            canUndo={annotations.canUndo}
            canRedo={annotations.canRedo}
            onOpenManager={() => setShowLabelManager(true)}
            onObjectChange={(patch) => {
              if (selectedDisplay) {
                annotations.updateSelectedAtFrame(player.currentFrame, patch)
              }
            }}
            onObjectDelete={annotations.deleteSelected}
            onObjectCopy={() => annotations.copySelected(player.currentFrame)}
            onPromoteKeyframe={() => {
              if (selectedDisplay) {
                annotations.createKeyframe(selectedDisplay.object_id, player.currentFrame)
              }
            }}
            onSelectObjectId={(objectId) => {
              const pick = annotations.selectByObjectId(objectId, player.currentFrame)
              if (pick && pick.frame !== player.currentFrame) {
                player.seekToFrame(pick.frame)
              }
            }}
            onToggleVisible={annotations.toggleVisible}
            onToggleLocked={annotations.toggleLocked}
            eventDefinitions={eventSchema.events}
            videoEvents={videoEvents}
            actionDefinitions={actionSchema.actions}
            videoActions={videoActions}
            relationDefinitions={relationSchema.relations}
            videoRelations={videoRelations}
            videoTrajectories={videoTrajectories}
            videoAudio={videoAudio}
            frameIndex={frameIndex}
            hasAudio={hasAudio}
            onGenerateTrajectory={handleGenerateTrajectory}
            onExtractAudio={handleExtractAudio}
            currentFrame={player.currentFrame}
            maxFrame={maxFrame}
            onOpenEventManager={() => setShowEventManager(true)}
            onOpenActionManager={() => setShowActionManager(true)}
            onOpenRelationManager={() => setShowRelationManager(true)}
            sceneDefinitions={sceneSchema.scenes}
            videoScenes={videoScenes}
            onOpenSceneManager={() => setShowSceneManager(true)}
            onAutoDetectScenes={() => void handleAutoDetectScenes()}
            cameraGroup={cameraGroup}
            activeCameraGroup={cameraGroup.activeGroup}
            datasetVideos={datasetVideos}
            crossCamera={crossCamera}
            reIdCandidates={reIdCandidates}
            onReIdLink={handleReIdLink}
            currentItemId={itemId ?? ''}
            footer={
              itemId ? (
                <VideoOpsPanel
                  itemId={itemId}
                  filename={item.relative_path || item.original_filename || item.filename}
                  width={item.width ?? 1280}
                  height={item.height ?? 720}
                  fps={fps}
                  frameCount={(player.maxFrame ?? 0) + 1}
                  currentFrame={player.currentFrame}
                  role={role}
                  username={username}
                  selected={selectedDisplay && 'width' in selectedDisplay ? selectedDisplay : null}
                  rgbD={rgbD}
                  lidar={lidar}
                  review={review}
                  collab={collab}
                  versions={versions}
                  videoEl={player.videoRef.current}
                  trajectories={videoTrajectories.trajectories}
                  onImportedRects={(rects) => {
                    for (const r of rects) {
                      const { id: _id, ...rest } = r
                      annotations.addObject(rest)
                    }
                  }}
                  cloudSync={cloudSync}
                  datasetId={item.dataset_id}
                />
              ) : null
            }
          />
        )}
      </div>
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showSkeletonTemplates && (
        <SkeletonTemplateManager
          schema={skeletonSchema}
          onChange={setSkeletonSchema}
          onClose={() => setShowSkeletonTemplates(false)}
        />
      )}
      {showEventManager && (
        <EventDefinitionManager
          schema={eventSchema}
          onChange={setEventSchema}
          onClose={() => setShowEventManager(false)}
        />
      )}
      {showActionManager && (
        <ActionDefinitionManager
          schema={actionSchema}
          onChange={setActionSchema}
          onClose={() => setShowActionManager(false)}
        />
      )}
      {showRelationManager && (
        <RelationDefinitionManager
          schema={relationSchema}
          onChange={setRelationSchema}
          onClose={() => setShowRelationManager(false)}
        />
      )}
      {showSceneManager && (
        <SceneDefinitionManager
          schema={sceneSchema}
          onChange={setSceneSchema}
          onClose={() => setShowSceneManager(false)}
        />
      )}
      {showLabelManager && (
        <LabelManager
          schema={schema}
          onChange={(next) => {
            setSchema(next)
            if (activeLabelId && !next.labels.some((l) => l.id === activeLabelId)) {
              setActiveLabelId(next.labels.find((l) => l.enabled)?.id ?? null)
            }
          }}
          onClose={() => setShowLabelManager(false)}
        />
      )}
    </div>
  )
}
