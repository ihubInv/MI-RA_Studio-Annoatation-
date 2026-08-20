import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'

import { Film } from 'lucide-react'

import { AiInteractionLayer } from '@/modules/video/components/AiInteractionLayer'

import { AiSuggestionOverlay } from '@/modules/video/components/AiSuggestionOverlay'

import { AnnotationInteractionLayer } from '@/modules/video/components/AnnotationInteractionLayer'

import { BboxOverlay } from '@/modules/video/components/BboxOverlay'

import { MaskInteractionLayer } from '@/modules/video/components/MaskInteractionLayer'

import { MaskOverlay } from '@/modules/video/components/MaskOverlay'

import { SkeletonOverlay } from '@/modules/video/components/SkeletonOverlay'
import { TrajectoryOverlay } from '@/modules/video/components/TrajectoryOverlay'
import { DepthOverlay } from '@/modules/video/components/DepthOverlay'
import { Cuboid3DOverlay } from '@/modules/video/components/Cuboid3DOverlay'
import { LidarRgbOverlay } from '@/modules/lidar/components/LidarRgbOverlay'
import type { RgbDState } from '@/modules/video/rgbd/rgbdTypes'
import type { LidarState } from '@/modules/lidar/lidarTypes'

import { CanvasControls } from '@/modules/video/components/CanvasControls'

import type { VideoDisplayMask } from '@/modules/video/canvas/maskInterpolation'

import type { VideoDisplaySkeleton } from '@/modules/video/canvas/skeletonInterpolation'
import type { VideoBbox, VideoRectObject, VideoTool } from '@/modules/video/canvas/types'
import { isAiTool, isDrawRectTool, isMaskTool, toolTypeForDraw } from '@/modules/video/tools/registry'

import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'

import type { SkeletonTemplate } from '@/modules/video/schema/skeletonTemplateStore'

import { useCanvasViewport } from '@/modules/video/hooks/useCanvasViewport'

import { VideoToolStrip } from '@/modules/video/panels/VideoToolStrip'

import type { AiSuggestion } from '@/modules/video/ai/mapAiResults'
import type { VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'

import { cn } from '@/utils/cn'



interface Props {

  src: string | null

  poster?: string | null

  loading?: boolean

  error?: string | null

  naturalWidth?: number

  naturalHeight?: number

  onSpaceTap?: () => void

  annotationFullscreen?: boolean

  onAnnotationFullscreenChange?: (value: boolean) => void

  className?: string

  tool?: VideoTool

  onToolChange?: (tool: VideoTool) => void

  currentFrame?: number

  frameObjects?: VideoRectObject[]

  frameSkeletons?: VideoDisplaySkeleton[]

  frameMasks?: VideoDisplayMask[]

  skeletonTemplate?: SkeletonTemplate | null

  onBrushStroke?: (points: { x: number; y: number }[]) => void

  onEraserStroke?: (points: { x: number; y: number }[], targetId: string) => void

  onPolygonMask?: (points: { x: number; y: number }[]) => void

  maskDraftStroke?: { points: { x: number; y: number }[] } | null

  onMaskDraftStroke?: (points: { x: number; y: number }[] | null) => void

  onContentSize?: (w: number, h: number) => void

  selectedId?: string | null

  onSelect?: (id: string | null) => void

  onCreateObject?: (obj: Omit<VideoRectObject, 'id'>) => void

  onUpdateObject?: (id: string, patch: Partial<VideoRectObject>) => void

  onCreateSkeleton?: (obj: Omit<VideoSkeletonObject, 'id'>) => void

  onUpdateSkeleton?: (id: string, patch: Partial<VideoSkeletonObject>) => void

  onNextObjectId?: (labelName: string) => string

  activeLabelName?: string

  activeLabelColor?: string

  draft?: VideoBbox | null

  onDraftChange?: (draft: VideoBbox | null) => void

  aiSuggestions?: AiSuggestion[]

  segPrompts?: { positive: { x: number; y: number }[]; negative: { x: number; y: number }[] }

  onSegPrompt?: (positive: { x: number; y: number }[], negative: { x: number; y: number }[]) => void

  onSegFinish?: () => void

  onPoseClick?: (point: { x: number; y: number }) => void

  /** Phase 21 trajectories */
  trajectories?: VideoTrajectory[]
  showTrajectories?: boolean
  selectedObjectId?: string | null
  rgbD?: RgbDState | null
  lidar?: LidarState | null
  currentTimeSec?: number
}



export const VideoViewport = forwardRef<HTMLVideoElement, Props>(function VideoViewport(

  {

    src,

    poster,

    loading,

    error,

    naturalWidth = 0,

    naturalHeight = 0,

    onSpaceTap,

    annotationFullscreen = false,

    onAnnotationFullscreenChange,

    className,

    tool = 'select',

    onToolChange,

    currentFrame = 0,

    frameObjects = [],

    frameSkeletons = [],

    frameMasks = [],

    skeletonTemplate = null,

    onBrushStroke,

    onEraserStroke,

    onPolygonMask,

    maskDraftStroke = null,

    onMaskDraftStroke,

    onContentSize,

    selectedId = null,

    onSelect,

    onCreateObject,

    onUpdateObject,

    onCreateSkeleton,

    onUpdateSkeleton,

    onNextObjectId,

    activeLabelName = 'Object',

    activeLabelColor = '#0d559e',

    draft = null,

    onDraftChange,

    aiSuggestions = [],

    segPrompts = { positive: [], negative: [] },

    onSegPrompt,

    onSegFinish,

    onPoseClick,

    trajectories = [],

    showTrajectories = true,

    selectedObjectId = null,

    rgbD = null,

    lidar = null,

    currentTimeSec = 0,

  },

  videoRef,

) {

  const viewportRef = useRef<HTMLDivElement>(null)

  const frameCanvasRef = useRef<HTMLCanvasElement>(null)

  const localVideoRef = useRef<HTMLVideoElement | null>(null)

  const setVideoNode = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el
    if (typeof videoRef === 'function') videoRef(el)
    else if (videoRef) (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
  }, [videoRef])

  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

  const [mediaSize, setMediaSize] = useState({ w: naturalWidth, h: naturalHeight })

  const [browserFullscreen, setBrowserFullscreen] = useState(false)

  const [isPanning, setIsPanning] = useState(false)

  const [localDraft, setLocalDraft] = useState<VideoBbox | null>(null)
  const [pathDraft, setPathDraft] = useState<{ points: { x: number; y: number }[]; closed?: boolean } | null>(null)

  const draftBox = draft ?? localDraft
  const setDraftBox = onDraftChange ?? setLocalDraft



  const contentSize = {

    w: mediaSize.w || naturalWidth || 1280,

    h: mediaSize.h || naturalHeight || 720,

  }



  const viewport = useCanvasViewport(contentSize, viewportSize)



  const toggleAnnotationFs = () => onAnnotationFullscreenChange?.(!annotationFullscreen)



  useEffect(() => {

    const el = viewportRef.current

    if (!el) return

    const ro = new ResizeObserver(([entry]) => {

      const { width, height } = entry.contentRect

      setViewportSize({ w: width, h: height })

    })

    ro.observe(el)

    return () => ro.disconnect()

  }, [])



  useEffect(() => {

    if (naturalWidth && naturalHeight) {

      setMediaSize({ w: naturalWidth, h: naturalHeight })

      onContentSize?.(naturalWidth, naturalHeight)

    }

  }, [naturalWidth, naturalHeight, onContentSize])



  useEffect(() => {

    return viewport.bindSpaceKey(onSpaceTap)

  }, [viewport, onSpaceTap])



  useEffect(() => {

    const canvas = frameCanvasRef.current

    if (!canvas || !contentSize.w || !contentSize.h) return

    canvas.width = contentSize.w

    canvas.height = contentSize.h

  }, [contentSize.w, contentSize.h])



  const onVideoLoaded = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {

    const v = e.currentTarget

    if (v.videoWidth && v.videoHeight) {

      setMediaSize({ w: v.videoWidth, h: v.videoHeight })

      onContentSize?.(v.videoWidth, v.videoHeight)

    }

  }, [onContentSize])



  const toggleBrowserFullscreen = useCallback(async () => {

    const el = viewportRef.current

    if (!el) return

    if (!document.fullscreenElement) {

      await el.requestFullscreen()

      setBrowserFullscreen(true)

    } else {

      await document.exitFullscreen()

      setBrowserFullscreen(false)

    }

  }, [])



  useEffect(() => {

    const onFsChange = () => setBrowserFullscreen(Boolean(document.fullscreenElement))

    document.addEventListener('fullscreenchange', onFsChange)

    return () => document.removeEventListener('fullscreenchange', onFsChange)

  }, [])



  const onPanStart = useCallback(

    (e: React.MouseEvent) => {

      if (viewport.onPointerDown(e, tool === 'pan')) {

        setIsPanning(true)

        return true

      }

      return false

    },

    [tool, viewport],

  )



  const onPanMove = useCallback(

    (e: React.MouseEvent) => {

      viewport.onPointerMove(e)

    },

    [viewport],

  )



  const onPanEnd = useCallback(() => {

    viewport.onPointerUp()

    setIsPanning(false)

  }, [viewport])



  const annotationsEnabled = Boolean(onSelect && onCreateObject && onUpdateObject && onNextObjectId)



  return (

    <div

      ref={viewportRef}

      className={cn(

        'relative flex-1 min-h-0 bg-workspace overflow-hidden',

        browserFullscreen && 'bg-black',

        className,

      )}

    >

      {!error && src && (

        <CanvasControls

          viewport={viewport}

          onFit={() => viewport.fitToView()}

          onFullscreenCanvas={toggleBrowserFullscreen}

          onAnnotationFullscreen={toggleAnnotationFs}

          browserFullscreen={browserFullscreen}

          annotationFullscreen={annotationFullscreen}

        />

      )}



      {onToolChange && !error && src && !loading && (

        <VideoToolStrip tool={tool} onToolChange={onToolChange} />

      )}



      <div

        className="absolute top-0 left-0"

        style={{

          transform: `translate(${viewport.position.x}px, ${viewport.position.y}px) scale(${viewport.scale})`,

          transformOrigin: '0 0',

          width: contentSize.w,

          height: contentSize.h,

        }}

      >

        {error ? (

          <div className="flex items-center justify-center w-full h-full min-h-[240px] bg-black/5 rounded-lg border border-border/60">

            <div className="text-center px-6">

              <Film className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />

              <p className="text-sm font-medium text-destructive">{error}</p>

            </div>

          </div>

        ) : !src ? (

          <div className="flex items-center justify-center w-full h-full min-h-[240px] bg-black/5 rounded-lg border border-border/60">

            <div className="text-center px-6">

              {poster ? (

                <img src={poster} alt="" className="max-w-full object-contain opacity-60 rounded-md mb-3" />

              ) : (

                <Film className="w-10 h-10 mx-auto mb-2 text-muted-foreground animate-pulse" />

              )}

              <p className="text-sm text-muted-foreground">{loading ? 'Loading video…' : 'No video source'}</p>

            </div>

          </div>

        ) : (

          <>

            <video

              ref={setVideoNode}

              src={src}

              poster={poster || undefined}

              width={contentSize.w}

              height={contentSize.h}

              className="block max-w-none shadow-lg rounded-sm bg-black"

              playsInline

              preload="auto"

              onLoadedMetadata={onVideoLoaded}

              style={{ pointerEvents: 'none' }}

            />

            <canvas ref={frameCanvasRef} className="absolute inset-0 pointer-events-none z-[5]" aria-hidden />

            <BboxOverlay

              width={contentSize.w}

              height={contentSize.h}

              objects={frameObjects}

              selectedId={selectedId}

              draft={draftBox}

              draftColor={activeLabelColor}

              draftTool={isDrawRectTool(tool) ? toolTypeForDraw(tool) : 'bbox'}

              pathDraft={pathDraft ? { ...pathDraft, color: activeLabelColor } : null}

            />

            <SkeletonOverlay

              width={contentSize.w}

              height={contentSize.h}

              skeletons={frameSkeletons}

              selectedId={selectedId}

            />

            <MaskOverlay

              width={contentSize.w}

              height={contentSize.h}

              masks={frameMasks}

              selectedId={selectedId}

              draftStroke={
                maskDraftStroke
                  ? { ...maskDraftStroke, color: activeLabelColor, width: 16 }
                  : null
              }

            />

            {showTrajectories && trajectories.length > 0 && (
              <TrajectoryOverlay
                width={contentSize.w}
                height={contentSize.h}
                trajectories={trajectories}
                currentFrame={currentFrame}
                selectedObjectId={selectedObjectId}
              />
            )}

            {rgbD?.enabled && (
              <DepthOverlay
                rgbVideo={localVideoRef.current}
                depthSrc={rgbD.depth.depth_video_url ?? null}
                currentTime={currentTimeSec}
                offsetSec={rgbD.depth.offset_frames / 30}
                colormap={rgbD.colormap}
                opacity={rgbD.opacity}
                enabled={rgbD.enabled}
                width={contentSize.w}
                height={contentSize.h}
              />
            )}

            {rgbD && (rgbD.showCuboids || rgbD.showTrajectories3d) && (
              <Cuboid3DOverlay
                width={contentSize.w}
                height={contentSize.h}
                cuboids={rgbD.cuboids}
                trajectories={rgbD.trajectories3d}
                K={rgbD.intrinsics}
                currentFrame={currentFrame}
                showCuboids={rgbD.showCuboids}
                showTrajectories={rgbD.showTrajectories3d}
              />
            )}

            {lidar?.enabled && (
              <LidarRgbOverlay
                width={contentSize.w}
                height={contentSize.h}
                points={lidar.cloud}
                cuboids={lidar.cuboids}
                K={rgbD?.intrinsics ?? { fx: contentSize.w * 0.9, fy: contentSize.w * 0.9, cx: contentSize.w / 2, cy: contentSize.h / 2 }}
              />
            )}

          </>

        )}

      </div>



      {!error && src && !loading && annotationsEnabled && !isMaskTool(tool) && !isAiTool(tool) && (

        <AnnotationInteractionLayer

          viewport={viewport}

          viewportRef={viewportRef}

          tool={tool}

          enabled

          contentW={contentSize.w}

          contentH={contentSize.h}

          frame={currentFrame}

          objects={frameObjects}

          skeletons={frameSkeletons}

          masks={frameMasks}

          skeletonTemplate={skeletonTemplate}

          selectedId={selectedId}

          label={activeLabelName}

          color={activeLabelColor}

          onNextObjectId={onNextObjectId!}

          onSelect={onSelect!}

          onCreate={onCreateObject!}

          onUpdate={onUpdateObject!}

          onCreateSkeleton={onCreateSkeleton}

          onUpdateSkeleton={onUpdateSkeleton}

          onPanStart={onPanStart}

          onPanMove={onPanMove}

          onPanEnd={onPanEnd}

          isPanning={isPanning}

          draft={draftBox}

          onDraftChange={setDraftBox}

          pathDraft={pathDraft}

          onPathDraftChange={setPathDraft}

        />

      )}



      {!error && src && !loading && onBrushStroke && onEraserStroke && onPolygonMask && onMaskDraftStroke && (

        <MaskInteractionLayer

          viewport={viewport}

          viewportRef={viewportRef}

          tool={tool}

          enabled

          masks={frameMasks}

          selectedId={selectedId}

          strokeColor={activeLabelColor}

          onSelect={onSelect!}

          onBrushStroke={onBrushStroke}

          onEraserStroke={onEraserStroke}

          onPolygonMask={onPolygonMask}

          onDraftStroke={onMaskDraftStroke}

          onPanStart={onPanStart}

          onPanMove={onPanMove}

          onPanEnd={onPanEnd}

          isPanning={isPanning}

        />

      )}



      {!error && src && !loading && isAiTool(tool) && onSegPrompt && onSegFinish && onPoseClick && (
        <AiInteractionLayer
          viewport={viewport}
          viewportRef={viewportRef}
          tool={tool}
          enabled
          segPrompts={segPrompts}
          onSegPrompt={onSegPrompt}
          onSegFinish={onSegFinish}
          onPoseClick={onPoseClick}
        />
      )}

      {!error && src && !loading && aiSuggestions.length > 0 && (
        <AiSuggestionOverlay viewport={viewport} suggestions={aiSuggestions} />
      )}


      {!error && src && !loading && !annotationsEnabled && (

        <div

          className={cn('absolute inset-0 z-20', isPanning || viewport.spaceHeld.current ? 'cursor-grabbing' : 'cursor-grab')}

          onWheel={(e) => {

            const rect = viewportRef.current?.getBoundingClientRect()

            viewport.onWheel(e, {

              x: e.clientX - (rect?.left ?? 0),

              y: e.clientY - (rect?.top ?? 0),

            })

          }}

          onMouseDown={(e) => {

            if (viewport.onPointerDown(e, true)) setIsPanning(true)

          }}

          onMouseMove={(e) => viewport.onPointerMove(e)}

          onMouseUp={onPanEnd}

          onMouseLeave={onPanEnd}

          onContextMenu={(e) => e.preventDefault()}

        />

      )}



      <div className="absolute bottom-3 left-14 z-30 text-2xs font-mono tabular-nums bg-white/90 border border-border rounded px-2 py-1 shadow-sm pointer-events-none">

        {Math.round(viewport.scale * 100)}% · frame {currentFrame + 1}
        {frameObjects.length + frameSkeletons.length + frameMasks.length
          ? ` · ${frameObjects.length + frameSkeletons.length + frameMasks.length} obj`
          : ''}
        <span className="text-muted-foreground"> · Alt-drag pan</span>

      </div>

    </div>

  )

})


