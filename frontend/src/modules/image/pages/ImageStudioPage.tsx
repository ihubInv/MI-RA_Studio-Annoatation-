import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from 'react-konva'
import {
  ArrowLeft,
  FolderInput,
  FolderTree,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Save,
  Send,
  Sparkles,
  Tags,
  Trash2,
  Undo2,
} from 'lucide-react'
import { datasetsService } from '@/services/datasets.service'
import { annotationsService, type AnnotationObjectPayload } from '@/services/annotations.service'
import { BRAND } from '@/lib/brand'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette'
import { cn } from '@/utils/cn'
import { DatasetExplorer } from '@/features/datasets/components/DatasetExplorer'
import { StorageBadge } from '@/features/datasets/components/StorageBadge'
import { STATUS_META } from '@/features/datasets/datasetTree.types'
import { getLocalBlob, reconnectDirectory } from '@/features/datasets/local/registry'
import { saveAnnotationLocalFirst, type SyncState } from '@/features/datasets/local/syncQueue'
import { detectObjects, estimatePose, poseAt, segmentAt, segmentWithPrompts } from '../ai/assist'
import { inferenceService, type DetectOutput, type InferenceModel } from '../api/inference.service'
import { DEFAULT_SHORTCUTS, TOOL_BY_ID } from '../tools/registry'
import { loadLabelSchema, saveLabelSchema, type LabelSchema } from '../schema/labelStore'
import { schemasService } from '../api/schemas.service'
import { cloneShapes, dist, type AnnShape, type Point } from '../canvas/annTypes'
import { AnnotationShapes } from '../canvas/AnnotationShapes'
import { DraftOverlay } from '../canvas/DraftOverlay'
import { maskIsEmpty, mergeManyMasks, polygonToMaskGeometry, rleToHullPoints, splitMaskByLine, strokeToMaskGeometry } from '../canvas/maskRle'
import {
  AUTO_POINTS,
  CLOSED_TYPES,
  MASK_TYPES,
  asPoints,
  buildPointGeometry,
  convexHull,
  cuboidGeometry,
  COCO_KEYPOINT_NAMES,
} from '../canvas/geometryDraw'
import { ToolPanel } from '../panels/ToolPanel'
import { ClassManager } from '../panels/ClassManager'

const ZOOM_PRESETS = [0.25, 0.5, 1, 2, 4]
const MIN_ZOOM = 0.05
const MAX_ZOOM = 16
const DEFAULT_DETECT_MODELS: { id: string; label: string }[] = [
  { id: 'yolov8n', label: 'YOLOv8 Nano (bbox)' },
  { id: 'yolov8s', label: 'YOLOv8 Small (bbox)' },
  { id: 'yolov8n-seg', label: 'YOLOv8 Nano Seg' },
  { id: 'yolov8s-seg', label: 'YOLOv8 Small Seg' },
]

function hitShapeId(e: { target?: { name?: () => string } }, shapes: AnnShape[]) {
  const named = typeof e.target?.name === 'function' ? e.target.name() : ''
  return shapes.some((s) => s.clientId === named) ? named : null
}

function nearestJoint(shapes: AnnShape[], pt: Point, maxDist: number) {
  let bestId: string | null = null
  let bestIndex = -1
  let bestD = maxDist
  for (const s of shapes) {
    if (s.tool_type !== 'skeleton' && s.tool_type !== 'keypoint') continue
    const pts = asPoints(s.geometry.points)
    for (let i = 0; i < pts.length; i++) {
      const d = dist(pts[i], pt)
      if (d <= bestD) {
        bestId = s.clientId
        bestIndex = i
        bestD = d
      }
    }
  }
  return bestId ? { id: bestId, index: bestIndex } : null
}

function nextTrackId(shapes: AnnShape[]) {
  let max = 0
  for (const s of shapes) {
    const raw = String(s.track_id || s.attributes?.track_id || '').replace(/^T/i, '')
    const n = Number(raw)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `T${max + 1}`
}

function shapeAtPoint(shapes: AnnShape[], pt: Point): AnnShape | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i]
    if (s.visible === false) continue
    const g = s.geometry
    const pts = asPoints(g.points)
    if (pts.length >= 3) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of pts) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
      if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) return s
    }
    if (g.x != null && g.w != null && g.y != null && g.h != null) {
      const x = Number(g.x)
      const y = Number(g.y)
      const w = Number(g.w)
      const h = Number(g.h)
      if (pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h) return s
    }
  }
  return null
}

export function ImageStudioPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const [params] = useSearchParams()
  const taskId = params.get('taskId') || undefined
  const folderParam = params.get('folder')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const palette = useCommandPalette()
  const [showTree, setShowTree] = useState(true)
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>({})

  const { data: item, isLoading } = useQuery({
    queryKey: ['dataset-item', itemId],
    queryFn: () => datasetsService.getItem(itemId!),
    enabled: Boolean(itemId),
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

  const { data: treeData } = useQuery({
    queryKey: ['dataset-tree', item?.dataset_id],
    queryFn: () => datasetsService.tree(item!.dataset_id),
    enabled: Boolean(item?.dataset_id),
  })

  useEffect(() => {
    const items = navIndex?.items
    if (!items?.length || !itemId || !folderParam) return
    if (items.some((entry) => entry.id === itemId)) return
    navigate(`/annotate/${items[0].id}?folder=${encodeURIComponent(folderParam)}`, { replace: true })
  }, [navIndex, itemId, folderParam, navigate])

  const schemaKey = item?.dataset_id || 'default'
  const [schema, setSchema] = useState<LabelSchema>(() => loadLabelSchema(schemaKey))
  const enabledClasses = schema.classes.filter((c) => c.enabled)

  const [tool, setTool] = useState('bbox')
  const [activeClass, setActiveClass] = useState(enabledClasses[0]?.name || 'Object')
  const [shapes, setShapes] = useState<AnnShape[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [annotationId, setAnnotationId] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')
  const [syncState, setSyncState] = useState<SyncState | 'idle'>('idle')
  const [localError, setLocalError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [segPrompts, setSegPrompts] = useState<{ positive: Point[]; negative: Point[] }>({ positive: [], negative: [] })
  const [detectOutput, setDetectOutput] = useState<DetectOutput>('bbox')
  const [detectModel, setDetectModel] = useState('yolov8n')
  const [detectConfidence, setDetectConfidence] = useState(0.25)
  const [detectClasses, setDetectClasses] = useState('')
  const [inferenceAvailable, setInferenceAvailable] = useState<boolean | null>(null)
  const [inferenceModels, setInferenceModels] = useState<InferenceModel[]>([])
  const [aiStatus, setAiStatus] = useState('')
  const [showClassManager, setShowClassManager] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [objectSearch, setObjectSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({
    classification: false,
    relations: false,
    measurement: false,
    '3d': false,
    pose: false,
    segmentation: false,
    ai: false,
  })
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mira.favorite-tools') || '["select","bbox","polygon","pan"]')
    } catch {
      return ['select', 'bbox', 'polygon', 'pan']
    }
  })
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 })
  const [scale, setScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })

  const history = useRef<AnnShape[][]>([[]])
  const redo = useRef<AnnShape[][]>([])
  const drawing = useRef<Point | null>(null)
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; w: number; h: number; r?: number } | null>(null)
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const draftPointsRef = useRef<Point[]>([])
  draftPointsRef.current = draftPoints
  const spaceHeld = useRef(false)
  const panning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, sx: 0, sy: 0 })
  const stageRef = useRef<any>(null)
  const trRef = useRef<any>(null)
  const selectedNode = useRef<any>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const fitted = useRef(false)
  const linkFrom = useRef<string | null>(null)
  const poseDrag = useRef<{ id: string; index: number } | null>(null)
  const shapesRef = useRef<AnnShape[]>([])
  const eraserTargetRef = useRef<string | null>(null)
  const segDraftId = useRef<string | null>(null)
  const splitLineStart = useRef<Point | null>(null)
  const [inspectInfo, setInspectInfo] = useState<{ class_name: string; tool_type: string; confidence?: number } | null>(null)
  const [segModel, setSegModel] = useState('mobile_sam')
  const [poseModel, setPoseModel] = useState('yolov8n-pose')

  const selectShape = useCallback((id: string | null, opts?: { additive?: boolean }) => {
    if (!id) {
      setSelectedId(null)
      setSelectedIds([])
      return
    }
    if (opts?.additive) {
      setSelectedIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        setSelectedId(id)
        return next.length ? next : [id]
      })
    } else {
      setSelectedId(id)
      setSelectedIds([id])
    }
  }, [])

  const { data: dataset } = useQuery({
    queryKey: ['dataset', item?.dataset_id],
    queryFn: () => datasetsService.get(item!.dataset_id),
    enabled: Boolean(item?.dataset_id),
  })

  const isLocal = Boolean(item?.is_local) || (item?.storage_path || '').startsWith('local:')

  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const natural = { w: item?.width || image?.width || 1, h: item?.height || image?.height || 1 }
  const drawMode = TOOL_BY_ID[tool]?.drawMode ?? 'select'

  useEffect(() => {
    fitted.current = false
    const local = loadLabelSchema(schemaKey)
    setSchema(local)
    if (!item?.dataset_id) return
    let cancelled = false
    schemasService
      .getForDataset(item.dataset_id)
      .then((remote) => {
        if (cancelled) return
        if (remote?.classes?.length) setSchema(remote)
        else schemasService.saveForDataset(item.dataset_id, local).catch(() => undefined)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [schemaKey, item?.dataset_id])

  useEffect(() => {
    saveLabelSchema(schema)
    if (!schema.classes.some((c) => c.name === activeClass && c.enabled) && schema.classes[0]) {
      setActiveClass(schema.classes.find((c) => c.enabled)?.name || schema.classes[0].name)
    }
    if (!item?.dataset_id) return
    const t = window.setTimeout(() => {
      schemasService.saveForDataset(item.dataset_id, schema).catch(() => undefined)
    }, 900)
    return () => window.clearTimeout(t)
  }, [schema, item?.dataset_id])

  useEffect(() => {
    localStorage.setItem('mira.favorite-tools', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    if (!item) return
    let cancelled = false
    let objectUrl: string | null = null
    setImage(null)
    setLocalError(null)
    fitted.current = false

    const load = async () => {
      try {
        if (isLocal) {
          const blob = await getLocalBlob(
            item.dataset_id,
            item.relative_path || item.original_filename || item.filename,
          )
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          const img = new window.Image()
          img.onload = () => {
            if (!cancelled) setImage(img)
          }
          img.onerror = () => {
            if (!cancelled) setLocalError('LOCAL_DATASET_MISSING')
          }
          img.src = objectUrl
          return
        }
        if (!item.media_url) return
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          if (!cancelled) setImage(img)
        }
        img.src = item.media_url
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'LOCAL_DATASET_MISSING'
        if (!cancelled) setLocalError(message)
      }
    }
    load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [
    item?.id,
    item?.dataset_id,
    item?.relative_path,
    item?.original_filename,
    item?.filename,
    item?.media_url,
    isLocal,
    reloadToken,
  ])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setStageSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setStageSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [isLoading, item])

  const fitToScreen = useCallback(() => {
    const pad = 32
    const s = Math.min((stageSize.w - pad) / natural.w, (stageSize.h - pad) / natural.h, 8)
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s))
    setScale(next)
    setStagePos({
      x: (stageSize.w - natural.w * next) / 2,
      y: (stageSize.h - natural.h * next) / 2,
    })
  }, [stageSize, natural.w, natural.h])

  useEffect(() => {
    if (!image || fitted.current || stageSize.w < 50) return
    fitted.current = true
    fitToScreen()
  }, [image, stageSize, fitToScreen])

  const toImage = (pos: { x: number; y: number }) => ({
    x: (pos.x - stagePos.x) / scale,
    y: (pos.y - stagePos.y) / scale,
  })

  const pushHistory = (next: AnnShape[]) => {
    shapesRef.current = next
    history.current.push(cloneShapes(next))
    redo.current = []
    setShapes(next)
    setDirty(true)
  }

  const undo = () => {
    if (history.current.length <= 1) return
    const current = history.current.pop()!
    redo.current.push(current)
    setShapes(cloneShapes(history.current[history.current.length - 1]))
    setDirty(true)
  }

  const redoAction = () => {
    const next = redo.current.pop()
    if (!next) return
    history.current.push(cloneShapes(next))
    setShapes(cloneShapes(next))
    setDirty(true)
  }

  const runSegmentPrompts = useCallback(
    async (positive: Point[], negative: Point[]) => {
      if (!image || aiBusy || !positive.length) return
      setShowAiPanel(true)
      setAiBusy(true)
      setAiStatus('Refining mask…')
      try {
        const points = await segmentWithPrompts(image, positive, negative, 38, segModel)
        if (points.length < 3) {
          setAiStatus('No region found. Add more foreground clicks or try a different spot.')
          return
        }
        const draftId = segDraftId.current
        if (draftId) {
          pushHistory(
            shapes.map((s) =>
              s.clientId === draftId ? { ...s, geometry: { points, rle: undefined } } : s,
            ),
          )
        } else {
          const id = crypto.randomUUID()
          segDraftId.current = id
          pushHistory([
            ...shapes,
            {
              clientId: id,
              class_name: activeClass,
              tool_type: 'instance_seg',
              geometry: { points },
              attributes: { source: 'ai_segment' },
              visible: true,
              locked: false,
            },
          ])
          selectShape(id)
        }
        setAiStatus(
          `Segment updated · ${positive.length} include · ${negative.length} exclude click${negative.length === 1 ? '' : 's'}. Press Enter to finish.`,
        )
      } catch (err) {
        setAiStatus(err instanceof Error ? err.message : 'Segmentation failed')
      } finally {
        setAiBusy(false)
      }
    },
    [image, aiBusy, shapes, activeClass, selectShape, segModel],
  )

  const runAi = async (kind: string, pt?: Point) => {
    if (!image || aiBusy) return
    setShowAiPanel(true)
    setAiBusy(true)
    setAiStatus('Running AI assist…')
    try {
      const origin = pt || { x: natural.w / 2, y: natural.h / 2 }
      const make = (tool_type: string, geometry: Record<string, unknown>): AnnShape => ({
        clientId: crypto.randomUUID(),
        class_name: activeClass,
        tool_type,
        geometry,
        attributes: { source: kind },
        visible: true,
        locked: false,
      })
      if (kind === 'magic_wand' || kind === 'ai_segment') {
        const positive = kind === 'ai_segment' && segPrompts.positive.length ? segPrompts.positive : pt ? [pt] : []
        const negative = kind === 'ai_segment' ? segPrompts.negative : []
        if (!positive.length) {
          setAiStatus('Click the object on the image.')
          return
        }
        if (kind === 'ai_segment') {
          await runSegmentPrompts(positive, negative)
          return
        }
        const points = await segmentAt(image, positive[0], 30)
        if (points.length < 3) {
          setAiStatus('No region found. Click a more uniform area of the object.')
          return
        }
        pushHistory([
          ...shapes,
          make('polygon_mask', { points }),
        ])
        setAiStatus('Mask added. Adjust with Select or Eraser.')
        return
      }
      if (kind === 'ai_detect') {
        const classFilter = detectClasses
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        const { objects, engine, model } = await detectObjects(image, {
          output: detectOutput,
          model: detectModel,
          confidence: detectConfidence,
          classes: classFilter.length ? classFilter : undefined,
        })
        if (!objects.length) {
          setAiStatus(
            engine === 'yolo'
              ? 'No objects matched. Lower confidence, change class filter, or try polygon output.'
              : 'No objects found. Install ML stack (requirements-ml.txt) for YOLO detection.',
          )
          return
        }
        pushHistory([
          ...shapes,
          ...objects.map((o) => ({
            clientId: crypto.randomUUID(),
            class_name: o.class_name || activeClass,
            tool_type: o.tool_type,
            geometry: o.geometry,
            attributes: {
              source: 'ai_detect',
              confidence: o.confidence,
              engine,
              model,
            },
            visible: true,
            locked: false,
          })),
        ])
        setAiStatus(
          `Detected ${objects.length} object${objects.length === 1 ? '' : 's'} (${engine}${model ? ` · ${model}` : ''}).`,
        )
        return
      }
      if (kind === 'ai_pose') {
        const pose = await estimatePose(image, origin, poseModel)
        pushHistory([
          ...shapes,
          make('skeleton', {
            ...pose,
            names: 'names' in pose && pose.names ? pose.names : COCO_KEYPOINT_NAMES,
          }),
        ])
        setAiStatus('Pose detected. Drag joints with Pose Edit to refine.')
        return
      }
    } catch (err) {
      setAiStatus(err instanceof Error ? err.message : 'AI assist failed')
    } finally {
      setAiBusy(false)
    }
  }

  useEffect(() => {
    inferenceService
      .listModels()
      .then((res) => {
        setInferenceAvailable(res.available)
        setInferenceModels(res.items)
        if (res.items.length) {
          setDetectModel((prev) => (res.items.some((m) => m.id === prev) ? prev : res.default_model))
        }
      })
      .catch(() => setInferenceAvailable(false))
  }, [])

  useEffect(() => {
    if (!itemId) return
    annotationsService.latest(itemId).then((ann) => {
      if (!ann) return
      setAnnotationId(ann.id)
      const loaded: AnnShape[] = (ann.objects || []).map((o) => ({
        clientId: o.id || crypto.randomUUID(),
        class_name: o.class_name,
        tool_type: o.tool_type || 'bbox',
        geometry: (o.geometry || {}) as Record<string, unknown>,
        attributes: o.attributes as Record<string, unknown> | undefined,
        visible: !o.is_hidden,
        locked: o.is_locked,
        occluded: Boolean(o.attributes?.occluded),
        track_id: (o.attributes?.track_id as string) || undefined,
        linked_object_id: o.linked_object_id,
        link_relation: o.link_relation,
        hierarchical_labels: o.hierarchical_labels,
      }))
      setShapes(loaded)
      history.current = [cloneShapes(loaded)]
      setDirty(false)
    })
  }, [itemId])

  useEffect(() => {
    if (trRef.current && selectedNode.current && selectedId && drawMode === 'select') {
      trRef.current.nodes([selectedNode.current])
      trRef.current.getLayer()?.batchDraw()
    } else if (trRef.current) {
      trRef.current.nodes([])
    }
  }, [selectedId, shapes, drawMode, scale])

  const toPayload = (): AnnotationObjectPayload[] =>
    shapes.map((s) => ({
      id: s.clientId,
      class_name: s.class_name,
      tool_type: s.tool_type,
      geometry: s.geometry,
      attributes: {
        ...(s.attributes || {}),
        ...(s.occluded != null ? { occluded: s.occluded } : {}),
        ...(s.track_id ? { track_id: s.track_id } : {}),
      },
      is_locked: Boolean(s.locked),
      is_hidden: s.visible === false,
      linked_object_id: s.linked_object_id,
      link_relation: s.link_relation,
      hierarchical_labels: s.hierarchical_labels,
    }))

  const save = useCallback(
    async (submit = false) => {
      if (!itemId) return
      setStatus(submit ? 'submitting' : 'syncing')
      setSyncState('syncing')
      try {
        const { annotation, state } = await saveAnnotationLocalFirst(annotationId, {
          item_id: itemId,
          task_id: taskId,
          objects: toPayload(),
        })
        if (annotation) {
          setAnnotationId(annotation.id)
          if (submit) await annotationsService.submit(annotation.id)
        }
        setDirty(false)
        setSyncState(state)
        setStatus(submit && state === 'synced' ? 'submitted' : state)
        if (item?.dataset_id && state === 'synced') {
          queryClient.invalidateQueries({ queryKey: ['annotation-previews', item.dataset_id] })
          queryClient.invalidateQueries({ queryKey: ['dataset-tree', item.dataset_id] })
          queryClient.invalidateQueries({ queryKey: ['dataset-index', item.dataset_id] })
        }
      } catch {
        setStatus('error')
        setSyncState('pending')
      }
    },
    [annotationId, shapes, itemId, taskId, item?.dataset_id, queryClient],
  )

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => save(false), 2500)
    return () => clearTimeout(t)
  }, [dirty, save])

  const completeShape = useCallback(() => {
    const pts = draftPointsRef.current
    const closed = CLOSED_TYPES.has(tool)
    const isPose = tool === 'keypoint'
    const min = AUTO_POINTS[tool] || (isPose ? 1 : closed ? 3 : 2)
    if (pts.length < min) return false
    if (tool === 'mask_refine') {
      const target =
        shapes.find((s) => s.clientId === selectedId && (MASK_TYPES.has(s.tool_type) || s.geometry.rle)) ||
        [...shapes].reverse().find((s) => MASK_TYPES.has(s.tool_type) || s.geometry.rle)
      const geometry = strokeToMaskGeometry(
        pts,
        natural.w,
        natural.h,
        16,
        target
          ? {
              rle: target.geometry.rle as { counts: number[]; size: [number, number] },
              points: target.geometry.points,
              tool_type: target.tool_type,
            }
          : undefined,
        'add',
      )
      if (target) {
        pushHistory(
          shapes.map((s) => (s.clientId === target.clientId ? { ...s, geometry: { ...s.geometry, ...geometry } } : s)),
        )
      } else {
        pushHistory([
          ...shapes,
          {
            clientId: crypto.randomUUID(),
            class_name: activeClass,
            tool_type: 'brush',
            geometry,
            visible: true,
            locked: false,
          },
        ])
      }
      setDraftPoints([])
      return true
    }
    if (tool === 'eraser') {
      const targetId = eraserTargetRef.current
      eraserTargetRef.current = null
      const target =
        shapes.find(
          (s) =>
            s.clientId === targetId &&
            (MASK_TYPES.has(s.tool_type) || s.geometry.rle || CLOSED_TYPES.has(s.tool_type)),
        ) ||
        shapes.find((s) => s.clientId === selectedId && (MASK_TYPES.has(s.tool_type) || s.geometry.rle || CLOSED_TYPES.has(s.tool_type)))
      if (!target || pts.length < 2) {
        setDraftPoints([])
        return true
      }
      const geometry = strokeToMaskGeometry(
        pts,
        natural.w,
        natural.h,
        16,
        {
          rle: target.geometry.rle as { counts: number[]; size: [number, number] } | undefined,
          points: target.geometry.points,
          tool_type: target.tool_type,
        },
        'subtract',
      )
      if (maskIsEmpty('rle' in geometry ? geometry.rle : undefined)) {
        pushHistory(shapes.filter((s) => s.clientId !== target.clientId))
        selectShape(null)
      } else {
        pushHistory(
          shapes.map((s) =>
            s.clientId === target.clientId ? { ...s, geometry: { ...s.geometry, ...geometry } } : s,
          ),
        )
      }
      setDraftPoints([])
      return true
    }
    const geometry =
      tool === 'brush'
        ? strokeToMaskGeometry(pts, natural.w, natural.h, 16)
        : tool === 'semantic_seg' && closed
          ? polygonToMaskGeometry(pts, natural.w, natural.h)
          : buildPointGeometry(tool, pts)

    if (tool === 'semantic_seg') {
      const existing = shapes.find((s) => s.tool_type === 'semantic_seg' && s.class_name === activeClass)
      const newRle = (geometry as { rle?: { counts: number[]; size: [number, number] } }).rle
      const oldRle = existing?.geometry?.rle as { counts: number[]; size: [number, number] } | undefined
      if (existing && newRle && oldRle?.counts) {
        const merged = mergeManyMasks([oldRle, newRle])
        if (merged) {
          pushHistory(
            shapes.map((s) =>
              s.clientId === existing.clientId
                ? { ...s, geometry: { ...s.geometry, rle: merged, points: rleToHullPoints(merged) } }
                : s,
            ),
          )
          setDraftPoints([])
          return true
        }
      }
    }

    pushHistory([
      ...shapes,
      {
        clientId: crypto.randomUUID(),
        class_name: activeClass,
        tool_type: tool,
        geometry,
        visible: true,
        locked: false,
      },
    ])
    setDraftPoints([])
    return true
  }, [tool, shapes, activeClass, natural.w, natural.h, selectedId, selectShape])

  const finishPoints = (_closed?: boolean, _type?: string) => {
    completeShape()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        spaceHeld.current = true
        e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (draftPointsRef.current.length) completeShape()
        save(false)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redoAction()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (draftPointsRef.current.length) {
          setDraftPoints((pts) => pts.slice(0, -1))
        } else if (selectedIds.length > 1) {
          const drop = new Set(selectedIds)
          pushHistory(shapes.filter((s) => !drop.has(s.clientId)))
          selectShape(null)
        } else if (selectedId) {
          pushHistory(shapes.filter((s) => s.clientId !== selectedId))
          selectShape(null)
        }
      } else if (e.key === 'Enter') {
        if (segDraftId.current) {
          segDraftId.current = null
          setSegPrompts({ positive: [], negative: [] })
          setAiStatus('Mask committed.')
          e.preventDefault()
          return
        }
        if (draftPointsRef.current.length) {
          e.preventDefault()
          completeShape()
          return
        }
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        if (draftPointsRef.current.length) {
          e.preventDefault()
          completeShape()
          return
        }
      } else if (e.key === 'Escape') {
        setDraftPoints([])
        drawing.current = null
        setDraftRect(null)
        eraserTargetRef.current = null
        if (segDraftId.current) {
          const draftId = segDraftId.current
          segDraftId.current = null
          pushHistory(shapes.filter((s) => s.clientId !== draftId))
          setSegPrompts({ positive: [], negative: [] })
          setAiStatus('Segment cancelled.')
        }
        selectShape(null)
      } else if (e.key === 'f' && !e.ctrlKey) fitToScreen()
      else if (e.key === 'g' || e.key === 'G') setShowGrid((v) => !v)
      else if (!e.ctrlKey && !e.metaKey && !draftPointsRef.current.length && (e.key === '[' || e.key === ']')) {
        e.preventDefault()
        const items = navIndex?.items ?? []
        const i = items.findIndex((x) => x.id === itemId)
        const q = folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''
        if (e.key === '[' && i > 0) navigate(`/annotate/${items[i - 1].id}${q}`)
        if (e.key === ']' && i >= 0 && i < items.length - 1) navigate(`/annotate/${items[i + 1].id}${q}`)
      } else if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n' && !draftPointsRef.current.length) {
        e.preventDefault()
        const items = navIndex?.items ?? []
        const i = items.findIndex((x) => x.id === itemId)
        const q = folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''
        const pool = e.shiftKey ? [...items.slice(0, Math.max(i, 0))].reverse() : items.slice(Math.max(i, 0) + 1)
        const hit = pool.find((x) => x.status === 'ready' || x.status === 'pending')
        if (hit) navigate(`/annotate/${hit.id}${q}`)
      } else if (!e.ctrlKey && !e.metaKey && e.key.length === 1) {
        const mapped = DEFAULT_SHORTCUTS[e.key.toLowerCase()]
        if (mapped) setTool(mapped)
        const cls = enabledClasses.find((c) => c.hotkey === e.key)
        if (cls) setActiveClass(cls.name)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onUp)
  }
  }, [shapes, selectedId, selectedIds, selectShape, save, drawMode, enabledClasses, fitToScreen, completeShape, navIndex, itemId, folderParam, navigate])

  const zoomAt = (pointer: Point, nextScale: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale))
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / scale,
      y: (pointer.y - stagePos.y) / scale,
    }
    setScale(clamped)
    setStagePos({
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    })
  }

  const onWheel = (e: any) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const direction = e.evt.deltaY > 0 ? -1 : 1
    zoomAt(pointer, scale * (direction > 0 ? 1.12 : 1 / 1.12))
  }

  const onMouseDown = (e: any) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    if (!pos) return
    const imgPt = toImage(pos)

    if (spaceHeld.current || drawMode === 'pan') {
      panning.current = true
      panStart.current = { x: pos.x, y: pos.y, sx: stagePos.x, sy: stagePos.y }
      return
    }
    if (tool === 'zoom') {
      zoomAt(pos, Math.min(MAX_ZOOM, scale * (e.evt.altKey ? 1 / 1.5 : 1.5)))
      return
    }
    if (tool === 'pointer') {
      const id = hitShapeId(e, shapes)
      if (id) selectShape(id, { additive: e.evt.ctrlKey || e.evt.metaKey })
      return
    }

    if (tool === 'classify') {
      pushHistory([
        ...shapes.filter((s) => s.tool_type !== 'classify'),
        {
          clientId: crypto.randomUUID(),
          class_name: activeClass,
          tool_type: 'classify',
          geometry: { kind: 'image' },
        },
      ])
      return
    }
    if (tool === 'multilabel') {
      const existing = shapes.find((s) => s.tool_type === 'multilabel')
      const labels = new Set((existing?.geometry.labels as string[]) || [])
      if (labels.has(activeClass)) labels.delete(activeClass)
      else labels.add(activeClass)
      const next = shapes.filter((s) => s.tool_type !== 'multilabel')
      if (labels.size) {
        next.push({
          clientId: existing?.clientId || crypto.randomUUID(),
          class_name: [...labels][0] || activeClass,
          tool_type: 'multilabel',
          geometry: { kind: 'image', labels: [...labels] },
        })
      }
      pushHistory(next)
      return
    }
    if (tool === 'tags') {
      const existing = shapes.find((s) => s.tool_type === 'tags')
      const tags = new Set((existing?.geometry.tags as string[]) || [])
      tags.add(activeClass)
      pushHistory([
        ...shapes.filter((s) => s.tool_type !== 'tags'),
        {
          clientId: existing?.clientId || crypto.randomUUID(),
          class_name: activeClass,
          tool_type: 'tags',
          geometry: { kind: 'image', tags: [...tags] },
        },
      ])
      return
    }
    if (tool === 'mask_merge') {
      const masks = shapes.filter(
        (s) =>
          selectedIds.includes(s.clientId) &&
          (CLOSED_TYPES.has(s.tool_type) || Boolean(s.geometry.rle)),
      )
      if (masks.length < 2) return
      const rles = masks
        .map((m) => m.geometry.rle as { counts: number[]; size: [number, number] } | undefined)
        .filter((r): r is { counts: number[]; size: [number, number] } => Boolean(r?.counts?.length))
      const mergedRle = rles.length >= 2 ? mergeManyMasks(rles) : rles[0] || null
      const pts = mergedRle ? rleToHullPoints(mergedRle) : convexHull(masks.flatMap((m) => asPoints(m.geometry.points)))
      const mergeIds = new Set(masks.map((m) => m.clientId))
      const mergedId = crypto.randomUUID()
      pushHistory([
        ...shapes.filter((s) => !mergeIds.has(s.clientId)),
        {
          ...masks[0],
          clientId: mergedId,
          geometry: {
            ...masks[0].geometry,
            points: pts.length >= 3 ? pts : convexHull(masks.flatMap((m) => asPoints(m.geometry.points))),
            ...(mergedRle ? { rle: mergedRle } : {}),
          },
        },
      ])
      selectShape(mergedId)
      return
    }
    if (tool === 'mask_split') {
      const mask =
        shapes.find((s) => s.clientId === selectedId && (CLOSED_TYPES.has(s.tool_type) || s.geometry.rle)) ||
        [...shapes].reverse().find((s) => CLOSED_TYPES.has(s.tool_type) || s.geometry.rle)
      if (!mask) return
      if (!splitLineStart.current) {
        splitLineStart.current = imgPt
        setDraftPoints([imgPt])
        setAiStatus('Mask split: click the second point on the cut line.')
        return
      }
      const [partA, partB] = splitMaskByLine(
        { rle: mask.geometry.rle as { counts: number[]; size: [number, number] } | undefined, points: mask.geometry.points },
        splitLineStart.current,
        imgPt,
        natural.w,
        natural.h,
      )
      splitLineStart.current = null
      setDraftPoints([])
      if (!partA || !partB) {
        setAiStatus('Split failed — draw a line that crosses the mask.')
        return
      }
      pushHistory([
        ...shapes.filter((s) => s.clientId !== mask.clientId),
        { ...mask, clientId: crypto.randomUUID(), geometry: { ...mask.geometry, points: partA.points, rle: partA.rle } },
        {
          ...mask,
          clientId: crypto.randomUUID(),
          instance_id: crypto.randomUUID(),
          geometry: { ...mask.geometry, points: partB.points, rle: partB.rle },
        },
      ])
      return
    }
    if (tool === 'relation' || tool === 'hierarchy') {
      const id = hitShapeId(e, shapes)
      if (!id) return
      if (!linkFrom.current || linkFrom.current === id) {
        linkFrom.current = id
        selectShape(id)
        return
      }
      const parent = shapes.find((s) => s.clientId === linkFrom.current)
      const childId = id
      const relation = tool === 'hierarchy' ? 'parent' : activeClass || 'related_to'
      pushHistory(
        shapes.map((s) =>
          s.clientId === childId
            ? {
                ...s,
                linked_object_id: linkFrom.current || undefined,
                link_relation: relation,
                hierarchical_labels:
                  tool === 'hierarchy' && parent ? [parent.class_name, s.class_name] : s.hierarchical_labels,
              }
            : s,
        ),
      )
      linkFrom.current = null
      selectShape(childId)
      return
    }
    if (tool === 'track_id') {
      const id = hitShapeId(e, shapes) || selectedId
      if (!id) return
      const assigned = nextTrackId(shapes)
      pushHistory(
        shapes.map((s) =>
          s.clientId === id ? { ...s, track_id: assigned, attributes: { ...s.attributes, track_id: assigned } } : s,
        ),
      )
      selectShape(id)
      return
    }
    if (tool === 'pose_edit') {
      const hit = nearestJoint(shapes, imgPt, 14 / scale)
      if (hit) {
        poseDrag.current = { id: hit.id, index: hit.index }
        selectShape(hit.id)
        return
      }
      const id = hitShapeId(e, shapes)
      selectShape(id)
      return
    }

    if (drawMode === 'select') {
      if (e.target === stage) selectShape(null)
      return
    }

    if (drawMode === 'ai') {
      setShowAiPanel(true)
      if (tool === 'ai_detect') {
        runAi('ai_detect')
        return
      }
      if (tool === 'ai_segment') {
        const negative = e.evt.altKey || e.evt.button === 2
        const next = negative
          ? { ...segPrompts, negative: [...segPrompts.negative, imgPt] }
          : { ...segPrompts, positive: [...segPrompts.positive, imgPt] }
        setSegPrompts(next)
        void runSegmentPrompts(next.positive, next.negative)
        return
      }
      runAi(tool === 'magic_wand' ? 'magic_wand' : tool, imgPt)
      return
    }

    if (drawMode === 'click-point') {
      if (tool === 'skeleton') {
        const pose = poseAt(imgPt, natural.w, natural.h)
        pushHistory([
          ...shapes,
          {
            clientId: crypto.randomUUID(),
            class_name: activeClass,
            tool_type: 'skeleton',
            geometry: { ...pose, names: COCO_KEYPOINT_NAMES },
            visible: true,
            locked: false,
          },
        ])
        return
      }
      pushHistory([
        ...shapes,
        {
          clientId: crypto.randomUUID(),
          class_name: activeClass,
          tool_type: 'point',
          geometry: { x: imgPt.x, y: imgPt.y },
        },
      ])
      return
    }

    if (drawMode === 'polygon' || drawMode === 'polyline' || drawMode === 'measure-angle' || drawMode === 'keypoints') {
      if (e.evt.button === 2 || e.evt.detail === 2) {
        e.evt.preventDefault()
        completeShape()
        return
      }
      const pts = draftPointsRef.current
      if (
        (drawMode === 'polygon' || CLOSED_TYPES.has(tool) || MASK_TYPES.has(tool)) &&
        pts.length >= 3 &&
        dist(imgPt, pts[0]) * scale <= 12
      ) {
        completeShape()
        return
      }
      const next = [...pts, imgPt]
      draftPointsRef.current = next
      setDraftPoints(next)
      const auto = AUTO_POINTS[tool]
      if (auto && next.length >= auto) completeShape()
      return
    }

    if (drawMode === 'measure-line') {
      if (draftPoints.length === 0) setDraftPoints([imgPt])
      else {
        pushHistory([
          ...shapes,
          {
            clientId: crypto.randomUUID(),
            class_name: 'measure',
            tool_type: 'measure',
            geometry: { points: [draftPoints[0], imgPt] },
          },
        ])
        setDraftPoints([])
      }
      return
    }

    drawing.current = imgPt
    if (tool === 'eraser') {
      const hit = hitShapeId(e, shapes)
      const target =
        shapes.find(
          (s) =>
            s.clientId === (hit || selectedId) &&
            (MASK_TYPES.has(s.tool_type) || s.geometry.rle || CLOSED_TYPES.has(s.tool_type)),
        ) ||
        [...shapes]
          .reverse()
          .find((s) => MASK_TYPES.has(s.tool_type) || s.geometry.rle || CLOSED_TYPES.has(s.tool_type))
      if (!target) return
      eraserTargetRef.current = target.clientId
      selectShape(target.clientId)
      setDraftPoints([imgPt])
      return
    }
    selectShape(null)
    if (drawMode === 'freehand') setDraftPoints([imgPt])
    else setDraftRect({ x: imgPt.x, y: imgPt.y, w: 0, h: 0, r: 0 })
  }

  const onMouseMove = (e: any) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    if (!pos) return
    const imgPt = toImage(pos)
    setCursor({ x: Math.round(imgPt.x), y: Math.round(imgPt.y) })

    if (tool === 'pointer') {
      const hit = shapeAtPoint(shapes, imgPt)
      setInspectInfo(
        hit
          ? {
              class_name: hit.class_name,
              tool_type: hit.tool_type,
              confidence: hit.attributes?.confidence as number | undefined,
            }
          : null,
      )
    }

    if (poseDrag.current) {
      const { id, index } = poseDrag.current
      setShapes((prev) => {
        const next = prev.map((s) => {
          if (s.clientId !== id) return s
          const pts = asPoints(s.geometry.points).map((p, i) => (i === index ? imgPt : p))
          return { ...s, geometry: { ...s.geometry, points: pts } }
        })
        shapesRef.current = next
        return next
      })
      return
    }

    if (panning.current) {
      setStagePos({
        x: panStart.current.sx + (pos.x - panStart.current.x),
        y: panStart.current.sy + (pos.y - panStart.current.y),
      })
      return
    }

    if (drawMode === 'freehand' && drawing.current) {
      setDraftPoints((pts) => [...pts, imgPt])
      return
    }

    if (!drawing.current || !draftRect) return
    if (drawMode === 'circle') {
      setDraftRect({
        x: drawing.current.x,
        y: drawing.current.y,
        w: 0,
        h: 0,
        r: dist(drawing.current, imgPt),
      })
      return
    }
    setDraftRect({
      x: Math.min(drawing.current.x, imgPt.x),
      y: Math.min(drawing.current.y, imgPt.y),
      w: Math.abs(imgPt.x - drawing.current.x),
      h: Math.abs(imgPt.y - drawing.current.y),
      r: 0,
    })
  }

  const onMouseUp = () => {
    panning.current = false
    if (poseDrag.current) {
      poseDrag.current = null
      pushHistory(cloneShapes(shapesRef.current))
      return
    }
    if (drawMode === 'freehand' && drawing.current) {
      const minPts = tool === 'eraser' ? 2 : 4
      if (draftPoints.length > minPts) {
        finishPoints(tool.includes('mask'), tool)
      }
      drawing.current = null
      return
    }
    if (draftRect && drawing.current) {
      if (drawMode === 'circle' && (draftRect.r || 0) > 3) {
        pushHistory([
          ...shapes,
          {
            clientId: crypto.randomUUID(),
            class_name: activeClass,
            tool_type: 'circle',
            geometry: { x: draftRect.x, y: draftRect.y, r: draftRect.r },
          },
        ])
      } else if (drawMode === 'ellipse' && draftRect.w > 4 && draftRect.h > 4) {
        pushHistory([
          ...shapes,
          {
            clientId: crypto.randomUUID(),
            class_name: activeClass,
            tool_type: 'ellipse',
            geometry: {
              x: draftRect.x + draftRect.w / 2,
              y: draftRect.y + draftRect.h / 2,
              rx: draftRect.w / 2,
              ry: draftRect.h / 2,
            },
          },
        ])
      } else if (draftRect.w > 4 && draftRect.h > 4) {
        const rectTool =
          tool === 'rotated_bbox' || tool === 'roi' || tool === 'cuboid' || tool === 'bbox3d' ? tool : 'bbox'
        const geometry =
          rectTool === 'cuboid' || rectTool === 'bbox3d'
            ? cuboidGeometry(draftRect.x, draftRect.y, draftRect.w, draftRect.h)
            : { x: draftRect.x, y: draftRect.y, w: draftRect.w, h: draftRect.h, rotation: 0 }
        const id = crypto.randomUUID()
        pushHistory([
          ...shapes,
          {
            clientId: id,
            class_name: activeClass,
            tool_type: rectTool,
            geometry,
          },
        ])
        if (rectTool === 'rotated_bbox') {
          selectShape(id)
          setTool('select')
        }
      }
    }
    drawing.current = null
    setDraftRect(null)
    if (drawMode !== 'freehand') setDraftPoints((pts) => pts)
  }

  const onDblClick = (e: any) => {
    e.evt?.preventDefault()
    if (['polygon', 'polyline', 'keypoints', 'measure-angle'].includes(drawMode) || tool.includes('mask')) {
      completeShape()
    }
  }

  const selected = shapes.find((s) => s.clientId === selectedId)
  const siblingItems = navIndex?.items ?? []
  const idx = siblingItems.findIndex((i) => i.id === itemId)
  const prev = idx > 0 ? siblingItems[idx - 1] : null
  const next = idx >= 0 && idx < siblingItems.length - 1 ? siblingItems[idx + 1] : null
  const nextUnannotated = siblingItems.slice(idx + 1).find((i) => i.status === 'ready' || i.status === 'pending')
  const prevUnannotated = [...siblingItems.slice(0, idx)].reverse().find((i) => i.status === 'ready' || i.status === 'pending')
  const nextReview = siblingItems.slice(idx + 1).find((i) => i.status === 'in_review' || i.status === 'rejected')
  const goItem = (id?: string) => {
    if (!id) return
    const q = folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''
    navigate(`/annotate/${id}${q}`)
  }
  const classColors = Object.fromEntries(schema.classes.map((c) => [c.name, c.color]))

  const grouped = useMemo(() => {
    const q = objectSearch.toLowerCase()
    const groups: Record<string, AnnShape[]> = {}
    shapes
      .filter((s) => !q || s.class_name.toLowerCase().includes(q))
      .forEach((s) => {
        groups[s.class_name] = groups[s.class_name] || []
        groups[s.class_name].push(s)
      })
    return groups
  }, [shapes, objectSearch])

  if (isLoading || !item) {
    return (
      <div className="h-screen flex items-center justify-center bg-workspace text-muted-foreground text-sm">
        Loading studio…
      </div>
    )
  }

  const cursorClass =
    tool === 'pointer'
      ? 'cursor-crosshair'
      : tool === 'zoom'
        ? 'cursor-zoom-in'
        : drawMode === 'pan' || spaceHeld.current
      ? 'pan-mode'
      : drawMode === 'select'
        ? 'select-mode'
        : ''

  return (
    <div className="h-screen flex flex-col bg-workspace overflow-hidden">
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
            <p className="text-sm font-semibold truncate">{item.relative_path || item.original_filename || item.filename}</p>
            <p className="text-2xs text-muted-foreground flex items-center gap-2 flex-wrap">
              <StorageBadge mode={dataset?.storage_mode || (isLocal ? 'local' : 'server')} compact />
              <span>
                {natural.w}×{natural.h} · {shapes.length} objects · {idx >= 0 ? `${idx + 1}/${siblingItems.length}` : ''}
              </span>
              {dirty && <span className="text-brand-orange">· unsaved</span>}
              {syncState === 'synced' && <span className="text-emerald-600">· ✓ Synced</span>}
              {syncState === 'saved' && <span className="text-emerald-600">· ✓ Saved</span>}
              {syncState === 'syncing' && <span className="text-sky-700">· ⟳ Syncing</span>}
              {syncState === 'pending' && <span className="text-amber-700">· ⚠ Pending Sync</span>}
              {status === 'error' && <span className="text-destructive">· save failed</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTree((v) => !v)} className="mira-btn-ghost text-xs h-8" title="Dataset tree">
            <FolderTree className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setShowClassManager(true)} className="mira-btn-ghost text-xs h-8">
            <Tags className="w-3.5 h-3.5" /> Classes
          </button>
          <button
            onClick={() => setShowAiPanel((v) => !v)}
            className={cn(
              'hidden sm:inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-md',
              showAiPanel ? 'bg-brand-orange text-white' : 'bg-brand-orange/10 text-brand-orange',
            )}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Assist
          </button>
          <button onClick={() => goItem(prevUnannotated?.id)} disabled={!prevUnannotated} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30" title="Previous unannotated">
            ⏮
          </button>
          <button onClick={() => goItem(prev?.id)} disabled={!prev} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30" title="Previous [">
            Prev
          </button>
          <button onClick={() => goItem(next?.id)} disabled={!next} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30" title="Next ]">
            Next
          </button>
          <button onClick={() => goItem(nextUnannotated?.id)} disabled={!nextUnannotated} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30" title="Next unannotated N">
            Next empty
          </button>
          <button onClick={() => goItem(nextReview?.id)} disabled={!nextReview} className="mira-btn-ghost text-xs h-7 px-2 disabled:opacity-30">
            Review
          </button>
          <button onClick={() => save(false)} className="mira-btn-ghost text-xs h-8">
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => save(true)} className="mira-btn-primary text-xs h-8">
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {!fullscreen && showTree && treeData?.tree && (
          <aside className="w-56 shrink-0 bg-white border-r border-border overflow-auto p-2">
            <p className="mira-section-label px-1 py-1">Dataset</p>
            <DatasetExplorer
              node={treeData.tree}
              selectedPath={item.parent_folder || folderParam || ''}
              onSelect={(path) => {
                const q = path ? `?folder=${encodeURIComponent(path)}` : ''
                navigate(`/annotate/${item.id}${q}`)
              }}
              expanded={treeExpanded}
              onToggle={(path) => setTreeExpanded((e) => ({ ...e, [path]: e[path] === false }))}
            />
          </aside>
        )}
        {!fullscreen && (
          <ToolPanel
            tool={tool}
            collapsed={collapsedCats}
            favorites={favorites}
            onToggleCategory={(id) => setCollapsedCats((c) => ({ ...c, [id]: !c[id] }))}
            onSelect={(id) => {
              setTool(id)
              if (TOOL_BY_ID[id]?.ai) setShowAiPanel(true)
              if (id === 'grid') setShowGrid((v) => !v)
            }}
            onToggleFavorite={(id) =>
              setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
            }
          />
        )}

        <div ref={wrapRef} className="flex-1 min-w-0 relative bg-workspace overflow-hidden">
          {localError && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-workspace/95 p-6">
              <div className="bg-white border border-amber-200 rounded-md max-w-md p-5 space-y-3">
                <p className="font-semibold">Local Dataset Access Required</p>
                <p className="text-sm text-muted-foreground">
                  MI-RA Studio cannot currently access the original dataset. Please select the original dataset folder.
                  Files are not uploaded.
                </p>
                <button
                  className="mira-btn-primary"
                  onClick={async () => {
                    try {
                      await reconnectDirectory(item.dataset_id)
                      setLocalError(null)
                      setReloadToken((n) => n + 1)
                    } catch (err: unknown) {
                      setLocalError(err instanceof Error ? err.message : 'Reconnect failed')
                    }
                  }}
                >
                  <FolderInput className="w-4 h-4" /> Select Dataset Folder
                </button>
              </div>
            </div>
          )}
          {aiBusy && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="bg-white border border-border rounded-md px-4 py-2 text-sm shadow-sm">Running AI assist…</div>
            </div>
          )}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1 max-w-[46%]">
            {shapes
              .filter((s) => s.tool_type === 'classify' || s.tool_type === 'multilabel' || s.tool_type === 'tags')
              .map((s) => (
                <span
                  key={s.clientId}
                  className="bg-white border border-border rounded-md px-2 py-0.5 text-2xs font-medium shadow-sm"
                >
                  {s.tool_type === 'classify' && `Class · ${s.class_name}`}
                  {s.tool_type === 'multilabel' &&
                    `Labels · ${((s.geometry.labels as string[]) || [s.class_name]).join(', ')}`}
                  {s.tool_type === 'tags' && `Tags · ${((s.geometry.tags as string[]) || []).join(', ')}`}
                </span>
              ))}
          </div>
          <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-white border border-border rounded-md shadow-sm p-0.5">
            <button onClick={() => setScale((s) => Math.max(MIN_ZOOM, s / 1.2))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent" title="Zoom out">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <select
              value={ZOOM_PRESETS.includes(Number(scale.toFixed(2))) ? String(scale) : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'fit') fitToScreen()
                else if (e.target.value !== 'custom') {
                  const z = Number(e.target.value)
                  zoomAt({ x: stageSize.w / 2, y: stageSize.h / 2 }, z)
                }
              }}
              className="h-7 text-2xs font-mono bg-transparent px-1"
            >
              <option value="custom">{Math.round(scale * 100)}%</option>
              <option value="fit">Fit</option>
              {ZOOM_PRESETS.map((z) => (
                <option key={z} value={z}>
                  {z * 100}%
                </option>
              ))}
            </select>
            <button onClick={() => setScale((s) => Math.min(MAX_ZOOM, s * 1.2))} className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent" title="Zoom in">
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={fitToScreen} className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent" title="Fit to screen">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => zoomAt({ x: stageSize.w / 2, y: stageSize.h / 2 }, 1)} className="h-7 px-1.5 text-2xs rounded hover:bg-accent" title="100%">
              100%
            </button>
            <button onClick={() => setFullscreen((v) => !v)} className="h-7 px-1.5 text-2xs rounded hover:bg-accent">
              {fullscreen ? 'Exit' : 'Full'}
            </button>
          </div>

          <Stage
            ref={stageRef}
            width={stageSize.w}
            height={stageSize.h}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            className={cn('annotation-canvas', cursorClass)}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onDblClick={onDblClick}
            onContextMenu={(e: any) => {
              e.evt.preventDefault()
              if (draftPointsRef.current.length) completeShape()
            }}
            style={{ background: '#eef2f7' }}
          >
            <Layer>
              <Rect x={0} y={0} width={natural.w} height={natural.h} fill="#ffffff" listening={false} />
              {image && <KonvaImage image={image} width={natural.w} height={natural.h} listening={false} />}
              {showGrid &&
                Array.from({ length: Math.ceil(natural.w / 50) }, (_, i) => (
                  <Line key={`gx${i}`} points={[i * 50, 0, i * 50, natural.h]} stroke="#e5e7eb" strokeWidth={1} listening={false} />
                ))}
              {showGrid &&
                Array.from({ length: Math.ceil(natural.h / 50) }, (_, i) => (
                  <Line key={`gy${i}`} points={[0, i * 50, natural.w, i * 50]} stroke="#e5e7eb" strokeWidth={1} listening={false} />
                ))}
              <AnnotationShapes
                shapes={shapes}
                selectedId={selectedId}
                selectedIds={selectedIds}
                classColors={classColors}
                showLabels={showLabels}
                viewScale={scale}
                toolSelect={drawMode === 'select'}
                onSelect={(id, additive) => {
                  setTool('select')
                  selectShape(id, { additive })
                }}
                bindNode={(id, node) => {
                  if (id === selectedId) selectedNode.current = node
                }}
                onDragEnd={(id, x, y) => {
                  pushHistory(
                    shapes.map((s) =>
                      s.clientId === id ? { ...s, geometry: { ...s.geometry, x, y } } : s,
                    ),
                  )
                }}
                onTranslatePoints={(id, dx, dy) => {
                  pushHistory(
                    shapes.map((s) => {
                      if (s.clientId !== id) return s
                      const pts = asPoints(s.geometry.points).map((p) => ({ x: p.x + dx, y: p.y + dy }))
                      return { ...s, geometry: { ...s.geometry, points: pts } }
                    }),
                  )
                }}
              />
              <DraftOverlay
                draftRect={draftRect}
                draftPoints={draftPoints}
                cursor={cursor}
                drawMode={drawMode}
                tool={tool}
                viewScale={scale}
                classColor={classColors[activeClass] || BRAND.blue}
              />
              <Transformer
                ref={trRef}
                rotateEnabled={drawMode === 'select'}
                rotateAnchorOffset={22}
                anchorSize={7}
                anchorCornerRadius={0}
                anchorStroke="#ffffff"
                anchorStrokeWidth={1}
                anchorFill={BRAND.orange}
                borderStroke={BRAND.blue}
                borderStrokeWidth={1}
                borderDash={[]}
                ignoreStroke
                boundBoxFunc={(_old, next) => next}
                onTransformEnd={(e) => {
                  const node = e.target
                  if (!selectedId) return
                  const sx = node.scaleX()
                  const sy = node.scaleY()
                  node.scaleX(1)
                  node.scaleY(1)
                  pushHistory(
                    shapes.map((s) =>
                      s.clientId === selectedId
                        ? {
                            ...s,
                            geometry: {
                              ...s.geometry,
                              x: node.x(),
                              y: node.y(),
                              w: Math.max(4, (Number(s.geometry.w) || node.width()) * sx),
                              h: Math.max(4, (Number(s.geometry.h) || node.height()) * sy),
                              rotation: node.rotation(),
                            },
                          }
                        : s,
                    ),
                  )
                }}
              />
            </Layer>
          </Stage>

          {draftPoints.length > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-border rounded-md shadow-sm px-3 py-1.5 text-xs text-foreground">
              <span className="font-medium">{draftPoints.length} points</span>
              <span className="text-muted-foreground">
                {' '}
                · Press <kbd className="font-mono text-2xs px-1 border border-border rounded">S</kbd> or{' '}
                <kbd className="font-mono text-2xs px-1 border border-border rounded">Enter</kbd> to complete · click first
                point · Esc cancel
              </span>
            </div>
          )}

          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1">
            <button onClick={undo} className="w-8 h-8 bg-white border border-border rounded-md flex items-center justify-center" title="Undo Ctrl+Z">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redoAction} className="w-8 h-8 bg-white border border-border rounded-md flex items-center justify-center" title="Redo Ctrl+Y">
              <Redo2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (selectedIds.length > 1) {
                  const drop = new Set(selectedIds)
                  pushHistory(shapes.filter((s) => !drop.has(s.clientId)))
                  selectShape(null)
                } else if (selectedId) {
                  pushHistory(shapes.filter((s) => s.clientId !== selectedId))
                  selectShape(null)
                }
              }}
              className="w-8 h-8 bg-white border border-border rounded-md flex items-center justify-center"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="absolute bottom-3 right-3 z-10 bg-white/95 border border-border rounded-md px-2.5 py-1.5 text-2xs font-mono text-muted-foreground shadow-sm">
            Zoom {Math.round(scale * 100)}% · X {cursor.x} · Y {cursor.y}
            {tool === 'pointer' && inspectInfo && (
              <> · {inspectInfo.class_name} ({inspectInfo.tool_type})</>
            )}
            {draftRect && drawMode !== 'circle' && (
              <> · {Math.round(draftRect.w)}×{Math.round(draftRect.h)} px</>
            )}
            {draftRect && drawMode === 'circle' && (
              <> · r {Math.round(draftRect.r || 0)} px</>
            )}
            {draftPoints.length === 2 && tool === 'measure' && (
              <> · d={Math.round(dist(draftPoints[0], draftPoints[1]))}px</>
            )}
          </div>
        </div>

        {!fullscreen && (
          <aside className="w-[320px] shrink-0 bg-white border-l border-border flex flex-col overflow-hidden">
            {showAiPanel ? (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-border flex items-center justify-between bg-brand-orange/5">
                  <span className="text-sm font-semibold text-brand-orange">AI Assist</span>
                  <button onClick={() => setShowAiPanel(false)} className="text-xs text-muted-foreground">
                    Close
                  </button>
                </div>
                <div className="p-3 border-b border-border space-y-2">
                  <p className="mira-section-label">Detect settings</p>
                  {inferenceAvailable === false && (
                    <p className="text-2xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      YOLO not available on server. Run{' '}
                      <code className="font-mono">pip install -r requirements-ml.txt</code> in backend/.venv
                    </p>
                  )}
                  {inferenceAvailable && (
                    <p className="text-2xs text-emerald-700">Pretrained YOLO models ready on server.</p>
                  )}
                  <label className="block text-2xs text-muted-foreground">
                    Output shape
                    <select
                      className="mira-input h-8 text-xs mt-1 w-full"
                      value={detectOutput}
                      onChange={(e) => setDetectOutput(e.target.value as DetectOutput)}
                    >
                      <option value="bbox">Bounding boxes</option>
                      <option value="polygon">Instance polygons (YOLO-seg)</option>
                      <option value="mask">Mask polygons (YOLO-seg)</option>
                    </select>
                  </label>
                  <label className="block text-2xs text-muted-foreground">
                    Model
                    <select
                      className="mira-input h-8 text-xs mt-1 w-full"
                      value={detectModel}
                      onChange={(e) => setDetectModel(e.target.value)}
                    >
                      {(inferenceModels.length ? inferenceModels : DEFAULT_DETECT_MODELS).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-2xs text-muted-foreground">
                    Confidence ({Math.round(detectConfidence * 100)}%)
                    <input
                      type="range"
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      value={detectConfidence}
                      onChange={(e) => setDetectConfidence(Number(e.target.value))}
                      className="w-full mt-1"
                    />
                  </label>
                  <label className="block text-2xs text-muted-foreground">
                    Class filter (optional, comma-separated COCO names)
                    <input
                      className="mira-input h-8 text-xs mt-1 w-full"
                      placeholder="person, car, dog"
                      value={detectClasses}
                      onChange={(e) => setDetectClasses(e.target.value)}
                    />
                  </label>
                  <label className="block text-2xs text-muted-foreground">
                    SAM model
                    <select
                      className="mira-input h-8 text-xs mt-1 w-full"
                      value={segModel}
                      onChange={(e) => setSegModel(e.target.value)}
                    >
                      <option value="mobile_sam">Mobile SAM (fast)</option>
                      <option value="sam_b">SAM Base (accurate)</option>
                    </select>
                  </label>
                  <label className="block text-2xs text-muted-foreground">
                    Pose model
                    <select
                      className="mira-input h-8 text-xs mt-1 w-full"
                      value={poseModel}
                      onChange={(e) => setPoseModel(e.target.value)}
                    >
                      <option value="yolov8n-pose">YOLOv8 Nano Pose</option>
                      <option value="yolov8s-pose">YOLOv8 Small Pose</option>
                    </select>
                  </label>
                </div>
                <div className="p-3 space-y-1 text-sm">
                  <button
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
                    disabled={aiBusy || !image}
                    onClick={() => {
                      setTool('ai_segment')
                      setSegPrompts({ positive: [], negative: [] })
                      segDraftId.current = null
                      setAiStatus('Click to include. Alt+click or right-click to exclude. Enter to finish.')
                    }}
                  >
                    Segment Object (SAM-style)
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
                    disabled={aiBusy || !image}
                    onClick={() => {
                      setTool('ai_detect')
                      setAiStatus('Running YOLO detection with current settings…')
                      runAi('ai_detect')
                    }}
                  >
                    Detect Objects (YOLO)
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
                    disabled={aiBusy || !image}
                    onClick={() => {
                      setTool('ai_pose')
                      setAiStatus('Click where the person should be placed.')
                    }}
                  >
                    Generate Pose
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
                    disabled={aiBusy || !image}
                    onClick={() => {
                      setTool('magic_wand')
                      setAiStatus('Click a region of similar color.')
                    }}
                  >
                    Magic Wand
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
                    disabled={aiBusy || !image}
                    onClick={() => {
                      setTool('ai_segment')
                      setAiStatus('Click to generate a mask for the active class.')
                    }}
                  >
                    Generate Mask
                  </button>
                </div>
                <p className="px-3 text-xs text-muted-foreground">
                  {aiBusy
                    ? 'Working…'
                    : aiStatus ||
                      'SAM-style: click to include, Alt+click to exclude. Magic Wand uses color similarity.'}
                </p>
                <p className="px-3 mt-2 text-2xs text-muted-foreground">
                  Detection uses pretrained YOLO on the server (COCO classes). Segmentation uses on-device clicks.
                </p>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border">
                  <p className="mira-section-label mb-2">Image</p>
                  <p className="text-xs font-medium truncate" title={item.relative_path || item.filename}>
                    {item.original_filename || item.filename}
                  </p>
                  <p className="text-2xs text-muted-foreground truncate">{item.parent_folder || 'Root'}</p>
                  <p className={cn('text-2xs mt-1', (STATUS_META[item.status] || STATUS_META.ready).text)}>
                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', (STATUS_META[item.status] || STATUS_META.ready).dot)} />
                    {(STATUS_META[item.status] || STATUS_META.ready).label}
                  </p>
                </div>
                <div className="p-3 border-b border-border">
                  <p className="mira-section-label mb-2">Annotation</p>
                  {selected ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">
                        {selected.class_name} · {selected.tool_type}
                      </p>
                      <label className="text-2xs text-muted-foreground">Class</label>
                      <select
                        value={selected.class_name}
                        onChange={(e) =>
                          pushHistory(
                            shapes.map((s) =>
                              s.clientId === selected.clientId ? { ...s, class_name: e.target.value } : s,
                            ),
                          )
                        }
                        className="mira-input"
                      >
                        {enabledClasses.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.category} / {c.name}
                          </option>
                        ))}
                      </select>
                      {schema.classes
                        .find((c) => c.name === selected.class_name)
                        ?.attributes.map((attr) => {
                          const value = selected.attributes?.[attr.name]
                          const patch = (next: unknown) =>
                            pushHistory(
                              shapes.map((s) =>
                                s.clientId === selected.clientId
                                  ? { ...s, attributes: { ...s.attributes, [attr.name]: next } }
                                  : s,
                              ),
                            )
                          if (attr.input_type === 'boolean') {
                            return (
                              <label key={attr.name} className="flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={Boolean(value)} onChange={(e) => patch(e.target.checked)} />
                                {attr.name}
                              </label>
                            )
                          }
                          if (attr.input_type === 'number') {
                            return (
                              <label key={attr.name} className="block text-xs space-y-1">
                                <span className="text-2xs text-muted-foreground">{attr.name}</span>
                                <input
                                  type="number"
                                  value={value == null ? '' : Number(value)}
                                  onChange={(e) => patch(e.target.value === '' ? '' : Number(e.target.value))}
                                  className="mira-input h-7"
                                />
                              </label>
                            )
                          }
                          if (attr.input_type === 'select') {
                            return (
                              <label key={attr.name} className="block text-xs space-y-1">
                                <span className="text-2xs text-muted-foreground">{attr.name}</span>
                                <select
                                  value={String(value ?? '')}
                                  onChange={(e) => patch(e.target.value)}
                                  className="mira-input h-7"
                                >
                                  <option value="">—</option>
                                  {(attr.values || []).map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )
                          }
                          if (attr.input_type === 'multiselect') {
                            const picked = new Set(Array.isArray(value) ? (value as string[]) : [])
                            return (
                              <div key={attr.name} className="text-xs space-y-1">
                                <span className="text-2xs text-muted-foreground">{attr.name}</span>
                                {(attr.values || []).map((v) => (
                                  <label key={v} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={picked.has(v)}
                                      onChange={() => {
                                        const next = new Set(picked)
                                        if (next.has(v)) next.delete(v)
                                        else next.add(v)
                                        patch([...next])
                                      }}
                                    />
                                    {v}
                                  </label>
                                ))}
                              </div>
                            )
                          }
                          return (
                            <label key={attr.name} className="block text-xs space-y-1">
                              <span className="text-2xs text-muted-foreground">{attr.name}</span>
                              <input
                                value={String(value ?? '')}
                                onChange={(e) => patch(e.target.value)}
                                className="mira-input h-7"
                              />
                            </label>
                          )
                        })}
                      {!schema.classes
                        .find((c) => c.name === selected.class_name)
                        ?.attributes.some((a) => a.name.toLowerCase() === 'occluded') && (
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(selected.occluded || selected.attributes?.occluded)}
                          onChange={(e) =>
                            pushHistory(
                              shapes.map((s) =>
                                s.clientId === selected.clientId
                                  ? {
                                      ...s,
                                      occluded: e.target.checked,
                                      attributes: { ...s.attributes, occluded: e.target.checked },
                                    }
                                  : s,
                              ),
                            )
                          }
                        />
                        Occluded
                      </label>
                      )}
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(selected.locked)}
                          onChange={(e) =>
                            pushHistory(
                              shapes.map((s) =>
                                s.clientId === selected.clientId ? { ...s, locked: e.target.checked } : s,
                              ),
                            )
                          }
                        />
                        Locked
                      </label>
                      <label className="block text-xs space-y-1">
                        <span className="text-2xs text-muted-foreground">Track ID</span>
                        <input
                          value={selected.track_id || ''}
                          onChange={(e) =>
                            pushHistory(
                              shapes.map((s) =>
                                s.clientId === selected.clientId
                                  ? { ...s, track_id: e.target.value, attributes: { ...s.attributes, track_id: e.target.value } }
                                  : s,
                              ),
                            )
                          }
                          className="mira-input h-7"
                          placeholder="T1"
                        />
                      </label>
                      {(selected.link_relation || selected.linked_object_id) && (
                        <p className="text-2xs text-muted-foreground">
                          {selected.link_relation || 'related'} →{' '}
                          {shapes.find((s) => s.clientId === selected.linked_object_id)?.class_name || 'object'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Select an object or draw with the active tool.</p>
                      {tool === 'classify' && (
                        <p className="text-xs">Click the image to assign class <strong>{activeClass}</strong>.</p>
                      )}
                      {tool === 'multilabel' && (
                        <p className="text-xs">Click to toggle <strong>{activeClass}</strong> on this image.</p>
                      )}
                      {tool === 'tags' && (
                        <p className="text-xs">Click to add tag <strong>{activeClass}</strong>.</p>
                      )}
                      {tool === 'relation' && (
                        <p className="text-xs">Click the source object, then the target. Relation uses the active class name.</p>
                      )}
                      {tool === 'hierarchy' && (
                        <p className="text-xs">Click the parent object, then the child.</p>
                      )}
                      {tool === 'track_id' && (
                        <p className="text-xs">Click an object to assign the next track ID (T1, T2, …).</p>
                      )}
                      {tool === 'pose_edit' && (
                        <p className="text-xs">Drag a numbered joint to move it.</p>
                      )}
                      {tool === 'skeleton' && (
                        <p className="text-xs">Click to place a COCO-17 skeleton. Use Pose Edit to adjust joints.</p>
                      )}
                      {tool === 'mask_refine' && (
                        <p className="text-xs">Select a mask, then paint to add region.</p>
                      )}
                      {tool === 'rotated_bbox' && (
                        <p className="text-xs">Draw a box, then use Select and the rotate handle.</p>
                      )}
                      {tool === 'mask_split' && (
                        <p className="text-xs">Select a mask, then click two points to draw the split line.</p>
                      )}
                      {tool === 'pointer' && (
                        <p className="text-xs">Hover to inspect objects. Click to select. Ctrl+click to multi-select.</p>
                      )}
                      {tool === 'zoom' && (
                        <p className="text-xs">Click to zoom in. Alt+click to zoom out. Scroll wheel also works.</p>
                      )}
                      {tool === 'semantic_seg' && (
                        <p className="text-xs">Draw a region — merges with existing masks of the same class.</p>
                      )}
                      {tool === 'mask_merge' && (
                        <p className="text-xs">Ctrl+click masks to multi-select, then click Merge or press the tool again.</p>
                      )}
                      {tool === 'eraser' && (
                        <p className="text-xs">Select a mask and paint to erase pixels. Delete removes the whole object.</p>
                      )}
                      {tool === 'magic_wand' && (
                        <p className="text-xs">Click a uniform region to generate a mask for <strong>{activeClass}</strong>.</p>
                      )}
                      {tool === 'ai_segment' && (
                        <p className="text-xs">
                          Click to include, Alt+click or right-click to exclude. Enter commits the mask for{' '}
                          <strong>{activeClass}</strong>.
                        </p>
                      )}
                      {tool === 'ai_detect' && (
                        <p className="text-xs">
                          Open AI Assist → set output (bbox/polygon), model, and confidence → Detect Objects (YOLO).
                        </p>
                      )}
                      {tool === 'ai_pose' && <p className="text-xs">Click the person to place a skeleton.</p>}
                      {['polygon', 'polyline', 'polygon_mask', 'semantic_seg', 'instance_seg', 'skeleton', 'keypoint', 'area'].includes(tool) && (
                        <p className="text-xs">Click vertices. Press S or Enter to complete.</p>
                      )}
                      {tool === 'line' && <p className="text-xs">Click two points.</p>}
                      {tool === 'arc' && <p className="text-xs">Click start, bend, and end points.</p>}
                      {tool === 'angle' && <p className="text-xs">Click A, vertex, then C.</p>}
                    </div>
                  )}
                </div>

                <div className="p-3 border-b border-border max-h-48 overflow-auto">
                  <p className="mira-section-label mb-2">Active class</p>
                  {enabledClasses.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setActiveClass(cls.name)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs',
                        activeClass === cls.name ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
                      )}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cls.color }} />
                      <span className="flex-1 text-left truncate">
                        {cls.parent_id ? '↳ ' : ''}
                        {cls.name}
                      </span>
                      {cls.hotkey && <span className="font-mono text-2xs text-muted-foreground">{cls.hotkey}</span>}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-auto p-3">
                  <p className="mira-section-label mb-2">Objects · {shapes.length}</p>
                  <input
                    value={objectSearch}
                    onChange={(e) => setObjectSearch(e.target.value)}
                    placeholder="Search objects"
                    className="mira-input h-7 text-xs mb-2"
                  />
                  {Object.entries(grouped).map(([group, items]) => (
                    <div key={group}>
                      <button
                        onClick={() => setCollapsedGroups((c) => ({ ...c, [group]: !c[group] }))}
                        className="text-xs font-semibold py-1"
                      >
                        {group} ({items.length})
                      </button>
                      {!collapsedGroups[group] &&
                        items.map((s, i) => (
                          <button
                            key={s.clientId}
                            onClick={(evt) => {
                              setTool('select')
                              selectShape(s.clientId, { additive: evt.ctrlKey || evt.metaKey })
                            }}
                            className={cn(
                              'w-full text-left pl-3 pr-1 py-1 text-xs rounded flex items-center gap-2',
                              selectedIds.includes(s.clientId) ? 'bg-primary/10' : 'hover:bg-accent',
                            )}
                          >
                            <span className="flex-1 truncate">
                              {group}_{String(i + 1).padStart(3, '0')}
                              <span className="text-muted-foreground"> · {s.tool_type}</span>
                            </span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex items-center gap-2">
                  <label className="text-2xs flex items-center gap-1">
                    <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
                    Labels
                  </label>
                  <label className="text-2xs flex items-center gap-1">
                    <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                    Grid
                  </label>
                </div>
                <p className="px-3 pb-3 text-2xs text-muted-foreground">
                  Wheel zoom · Space/H pan · [ ] prev/next · N next empty · S/Enter complete polygon · I pointer
                </p>
              </>
            )}
          </aside>
        )}
      </div>

      {showClassManager && (
        <ClassManager
          schema={schema}
          onChange={setSchema}
          onClose={() => setShowClassManager(false)}
        />
      )}
      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  )
}
