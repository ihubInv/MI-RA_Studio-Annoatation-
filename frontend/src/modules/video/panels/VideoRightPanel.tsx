import { TrackPanel } from '@/modules/video/panels/TrackPanel'
import { isMaskDisplay } from '@/modules/video/canvas/maskInterpolation'
import { isSkeletonDisplay } from '@/modules/video/canvas/skeletonInterpolation'
import type { VideoDisplayAnnotation } from '@/modules/video/hooks/useVideoAnnotations'
import type { VideoTrack } from '@/modules/video/timeline/track.types'
import { LabelPalette } from '@/modules/video/panels/LabelPalette'
import { ObjectInspector } from '@/modules/video/panels/ObjectInspector'
import { SkeletonInspector } from '@/modules/video/panels/SkeletonInspector'
import { MaskInspector } from '@/modules/video/panels/MaskInspector'
import { SegmentationModeToggle } from '@/modules/video/panels/SegmentationModeToggle'
import { ObjectManager } from '@/modules/video/panels/ObjectManager'
import { EventPanel } from '@/modules/video/panels/EventPanel'
import { EventInspector } from '@/modules/video/panels/EventInspector'
import { ActionPanel } from '@/modules/video/panels/ActionPanel'
import { ActionInspector } from '@/modules/video/panels/ActionInspector'
import { RelationPanel } from '@/modules/video/panels/RelationPanel'
import { RelationInspector } from '@/modules/video/panels/RelationInspector'
import { TrajectoryPanel } from '@/modules/video/panels/TrajectoryPanel'
import { AudioPanel } from '@/modules/video/panels/AudioPanel'
import { ScenePanel } from '@/modules/video/panels/ScenePanel'
import { SceneInspector } from '@/modules/video/panels/SceneInspector'
import { CameraManagerPanel } from '@/modules/video/panels/CameraManagerPanel'
import { CrossCameraPanel } from '@/modules/video/panels/CrossCameraPanel'
import { ReIdPanel } from '@/modules/video/panels/ReIdPanel'
import type { VideoEventsApi } from '@/modules/video/hooks/useVideoEvents'
import type { VideoActionsApi } from '@/modules/video/hooks/useVideoActions'
import type { VideoRelationsApi } from '@/modules/video/hooks/useVideoRelations'
import type { VideoTrajectoriesApi } from '@/modules/video/hooks/useVideoTrajectories'
import type { VideoAudioApi } from '@/modules/video/hooks/useVideoAudio'
import type { VideoScenesApi } from '@/modules/video/hooks/useVideoScenes'
import type { CameraGroupApi } from '@/modules/video/hooks/useCameraGroup'
import type { CrossCameraApi } from '@/modules/video/hooks/useCrossCameraLinks'
import type { EventDefinition } from '@/modules/video/schema/eventStore'
import type { ActionDefinition } from '@/modules/video/schema/actionStore'
import type { RelationDefinition } from '@/modules/video/schema/relationStore'
import type { SceneDefinition } from '@/modules/video/schema/sceneStore'
import type { CameraGroup } from '@/modules/video/multicamera/cameraGroupStore'
import type { ReIdCandidate } from '@/modules/video/multicamera/crossCameraStore'
import type { FrameIndex } from '@/modules/video/api/video.service'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import type { SegmentationMode, VideoMaskObject } from '@/modules/video/canvas/maskTypes'
import type { ObjectManagerEntry } from '@/modules/video/hooks/useVideoAnnotations'
import type { VideoLabelSchema } from '@/modules/video/schema/labelStore'
import type { AttributeValues } from '@/modules/video/panels/AttributeForm'

interface Props {
  schema: VideoLabelSchema
  selected: VideoDisplayAnnotation | null
  activeTrack: VideoTrack | null
  allTracks: VideoTrack[]
  mergeCandidateId: string | null
  onMergeCandidateChange: (objectId: string | null) => void
  onMergeTracks: () => void
  objectEntries: ObjectManagerEntry[]
  activeLabelId: string | null
  attributeValues: AttributeValues
  onSelectLabel: (labelId: string) => void
  onAttributeChange: (values: AttributeValues) => void
  onOpenManager: () => void
  onOpenSkeletonTemplates?: () => void
  segmentationMode?: SegmentationMode
  onSegmentationModeChange?: (mode: SegmentationMode) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: () => boolean
  canRedo?: () => boolean
  onObjectChange: (patch: Partial<VideoRectObject> | Partial<VideoSkeletonObject> | Partial<VideoMaskObject>) => void
  onObjectDelete: () => void
  onObjectCopy: () => void
  onPromoteKeyframe?: () => void
  onSelectObjectId: (objectId: string) => void
  onToggleVisible: (objectId: string) => void
  onToggleLocked: (objectId: string) => void
  /** Phase 18 events */
  eventDefinitions?: EventDefinition[]
  videoEvents?: VideoEventsApi
  /** Phase 19 actions */
  actionDefinitions?: ActionDefinition[]
  videoActions?: VideoActionsApi
  /** Phase 20 relations */
  relationDefinitions?: RelationDefinition[]
  videoRelations?: VideoRelationsApi
  videoTrajectories?: VideoTrajectoriesApi
  videoAudio?: VideoAudioApi
  frameIndex?: FrameIndex | null
  hasAudio?: boolean
  onGenerateTrajectory?: () => void
  onExtractAudio?: () => void
  currentFrame?: number
  maxFrame?: number
  onOpenEventManager?: () => void
  onOpenActionManager?: () => void
  onOpenRelationManager?: () => void
  /** Phase 23 scenes */
  sceneDefinitions?: SceneDefinition[]
  videoScenes?: VideoScenesApi
  onOpenSceneManager?: () => void
  onAutoDetectScenes?: () => void
  /** Phase 24 multi-camera */
  cameraGroup?: CameraGroupApi
  activeCameraGroup?: CameraGroup | null
  datasetVideos?: { id: string; name: string }[]
  crossCamera?: CrossCameraApi
  reIdCandidates?: ReIdCandidate[]
  onReIdLink?: (candidate: ReIdCandidate) => void
  currentItemId?: string
  footer?: React.ReactNode
}

export function VideoRightPanel({
  schema,
  selected,
  activeTrack,
  allTracks,
  mergeCandidateId,
  onMergeCandidateChange,
  onMergeTracks,
  objectEntries,
  activeLabelId,
  attributeValues,
  onSelectLabel,
  onAttributeChange,
  onOpenManager,
  onOpenSkeletonTemplates,
  segmentationMode,
  onSegmentationModeChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onObjectChange,
  onObjectDelete,
  onObjectCopy,
  onPromoteKeyframe,
  onSelectObjectId,
  onToggleVisible,
  onToggleLocked,
  eventDefinitions = [],
  videoEvents,
  actionDefinitions = [],
  videoActions,
  relationDefinitions = [],
  videoRelations,
  videoTrajectories,
  videoAudio,
  frameIndex,
  hasAudio,
  onGenerateTrajectory,
  onExtractAudio,
  currentFrame = 0,
  maxFrame = 0,
  onOpenEventManager,
  onOpenActionManager,
  onOpenRelationManager,
  sceneDefinitions = [],
  videoScenes,
  onOpenSceneManager,
  onAutoDetectScenes,
  cameraGroup,
  activeCameraGroup,
  datasetVideos = [],
  crossCamera,
  reIdCandidates = [],
  onReIdLink,
  currentItemId = '',
  footer,
}: Props) {
  const actorObjectId = selected?.object_id ?? null

  return (
    <aside
      className="w-80 min-w-80 shrink-0 bg-white border-l border-border flex flex-col min-h-0 overflow-y-auto overflow-x-hidden"
      style={{ width: 320, minWidth: 320 }}
    >
      <ObjectManager
        entries={objectEntries}
        selectedObjectId={selected?.object_id ?? null}
        onSelect={onSelectObjectId}
        onToggleVisible={onToggleVisible}
        onToggleLocked={onToggleLocked}
      />
      {onSegmentationModeChange && segmentationMode && (
        <div className="shrink-0">
          <SegmentationModeToggle mode={segmentationMode} onChange={onSegmentationModeChange} />
        </div>
      )}
      {(onUndo || onRedo) && (
        <div className="px-3 py-2 border-b border-border flex gap-1 shrink-0">
          <button
            type="button"
            className="mira-btn-ghost h-7 text-xs flex-1 disabled:opacity-30"
            disabled={!canUndo?.()}
            onClick={onUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="mira-btn-ghost h-7 text-xs flex-1 disabled:opacity-30"
            disabled={!canRedo?.()}
            onClick={onRedo}
          >
            Redo
          </button>
        </div>
      )}
      {onOpenSkeletonTemplates && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <button type="button" onClick={onOpenSkeletonTemplates} className="mira-btn-ghost h-7 text-xs w-full">
            Skeleton templates…
          </button>
        </div>
      )}
      <TrackPanel
        track={activeTrack}
        mergeCandidateId={mergeCandidateId}
        allTracks={allTracks}
        onMergeCandidateChange={onMergeCandidateChange}
        onMerge={onMergeTracks}
      />
      {videoScenes?.selectedScene && (
        <SceneInspector
          scene={videoScenes.selectedScene}
          definitions={sceneDefinitions}
          maxFrame={maxFrame}
          onChange={(patch) => videoScenes.updateScene(videoScenes.selectedScene!.id, patch)}
          onDelete={videoScenes.deleteSelected}
        />
      )}
      {videoRelations?.selectedRelation && !videoScenes?.selectedScene && (
        <RelationInspector
          relation={videoRelations.selectedRelation}
          maxFrame={maxFrame}
          objectEntries={objectEntries}
          onChange={(patch) => videoRelations.updateRelation(videoRelations.selectedRelation!.id, patch)}
          onDelete={videoRelations.deleteSelected}
        />
      )}
      {videoActions?.selectedAction && !videoRelations?.selectedRelation && !videoScenes?.selectedScene && (
        <ActionInspector
          action={videoActions.selectedAction}
          maxFrame={maxFrame}
          objectEntries={objectEntries}
          onChange={(patch) => videoActions.updateAction(videoActions.selectedAction!.id, patch)}
          onDelete={videoActions.deleteSelected}
        />
      )}
      {videoEvents?.selectedEvent && !videoActions?.selectedAction && !videoRelations?.selectedRelation && !videoScenes?.selectedScene && (
        <EventInspector
          event={videoEvents.selectedEvent}
          maxFrame={maxFrame}
          onChange={(patch) => videoEvents.updateEvent(videoEvents.selectedEvent!.id, patch)}
          onDelete={videoEvents.deleteSelected}
        />
      )}
      {selected && !videoEvents?.selectedEvent && !videoActions?.selectedAction && !videoRelations?.selectedRelation && !videoScenes?.selectedScene && isMaskDisplay(selected) && (
        <MaskInspector
          object={selected}
          schema={schema}
          onChange={onObjectChange}
          onDelete={onObjectDelete}
          onCopy={onObjectCopy}
          onPromoteKeyframe={onPromoteKeyframe}
        />
      )}
      {selected && !videoEvents?.selectedEvent && !videoActions?.selectedAction && !videoRelations?.selectedRelation && !videoScenes?.selectedScene && isSkeletonDisplay(selected) && (
        <SkeletonInspector
          object={selected}
          schema={schema}
          onChange={onObjectChange}
          onDelete={onObjectDelete}
          onCopy={onObjectCopy}
          onPromoteKeyframe={onPromoteKeyframe}
        />
      )}
      {selected && !videoEvents?.selectedEvent && !videoActions?.selectedAction && !videoRelations?.selectedRelation && !videoScenes?.selectedScene && !isSkeletonDisplay(selected) && !isMaskDisplay(selected) && (
        <ObjectInspector
          object={selected}
          schema={schema}
          onChange={onObjectChange}
          onDelete={onObjectDelete}
          onCopy={onObjectCopy}
          onPromoteKeyframe={onPromoteKeyframe}
        />
      )}
      {cameraGroup && (
        <CameraManagerPanel
          cameraGroup={cameraGroup}
          group={activeCameraGroup ?? null}
          currentItemId={currentItemId}
          datasetVideos={datasetVideos}
          fps={frameIndex?.fps ?? 30}
        />
      )}
      {crossCamera && (
        <CrossCameraPanel
          crossCamera={crossCamera}
          itemId={currentItemId}
          objectId={actorObjectId}
          objectLabel={selected?.label ?? null}
        />
      )}
      {crossCamera && onReIdLink && (
        <ReIdPanel
          crossCamera={crossCamera}
          itemId={currentItemId}
          objectId={actorObjectId}
          objectLabel={selected?.label ?? null}
          candidates={reIdCandidates}
          onLink={onReIdLink}
        />
      )}
      {videoScenes && (
        <ScenePanel
          definitions={sceneDefinitions}
          scenes={videoScenes}
          currentFrame={currentFrame}
          onOpenManager={onOpenSceneManager}
          onAutoDetect={onAutoDetectScenes}
        />
      )}
      {videoEvents && (
        <EventPanel
          schema={eventDefinitions}
          events={videoEvents}
          currentFrame={currentFrame}
          onOpenManager={onOpenEventManager}
        />
      )}
      {videoActions && (
        <ActionPanel
          definitions={actionDefinitions}
          actions={videoActions}
          actorObjectId={actorObjectId}
          objectEntries={objectEntries}
          currentFrame={currentFrame}
          onOpenManager={onOpenActionManager}
        />
      )}
      {videoRelations && (
        <RelationPanel
          definitions={relationDefinitions}
          relations={videoRelations}
          subjectObjectId={actorObjectId}
          objectEntries={objectEntries}
          currentFrame={currentFrame}
          onOpenManager={onOpenRelationManager}
        />
      )}
      {videoTrajectories && onGenerateTrajectory && (
        <TrajectoryPanel
          trajectories={videoTrajectories}
          objectId={actorObjectId}
          onGenerate={onGenerateTrajectory}
        />
      )}
      {videoAudio && onExtractAudio && (
        <AudioPanel
          audio={videoAudio}
          currentFrame={currentFrame}
          maxFrame={maxFrame}
          frameIndex={frameIndex ?? null}
          hasAudio={hasAudio}
          onExtract={onExtractAudio}
        />
      )}
      {footer}
      <LabelPalette
        schema={schema}
        activeLabelId={activeLabelId}
        onSelectLabel={(label) => onSelectLabel(label.id)}
        attributeValues={attributeValues}
        onAttributeChange={onAttributeChange}
        onOpenManager={onOpenManager}
        className="w-full border-l-0 shrink-0"
      />
    </aside>
  )
}
