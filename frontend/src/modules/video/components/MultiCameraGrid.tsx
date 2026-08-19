import { cn } from '@/utils/cn'
import type { CameraSlot } from '@/modules/video/multicamera/cameraGroupStore'
import { masterFrameToCameraFrame } from '@/modules/video/multicamera/cameraGroupStore'

export interface CameraFeed {
  slot: CameraSlot
  src: string | null
  poster?: string | null
  loading?: boolean
}

interface Props {
  feeds: CameraFeed[]
  masterFrame: number
  fps: number
  activeItemId: string | null
  masterItemId: string | null
  onSelectCamera: (itemId: string) => void
  className?: string
}

/** Task 24.3 — multi-camera grid synced to master playhead. */
export function MultiCameraGrid({
  feeds,
  masterFrame,
  fps,
  activeItemId,
  masterItemId,
  onSelectCamera,
  className,
}: Props) {
  if (feeds.length < 2) return null

  const cols = feeds.length <= 2 ? 2 : feeds.length <= 4 ? 2 : 3

  return (
    <div
      className={cn('grid gap-1 p-1 bg-black/90 border-b border-border shrink-0', className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {feeds.map(({ slot, src, poster, loading }) => {
        const camFrame = masterFrameToCameraFrame(masterFrame, slot)
        const isActive = slot.item_id === activeItemId
        const isMaster = slot.item_id === masterItemId
        return (
          <button
            key={slot.id}
            type="button"
            className={cn(
              'relative aspect-video rounded overflow-hidden border-2 text-left',
              isActive ? 'border-brand-orange ring-1 ring-brand-orange' : 'border-transparent hover:border-white/30',
            )}
            onClick={() => onSelectCamera(slot.item_id)}
          >
            {src ? (
              <SyncedCameraVideo src={src} poster={poster} targetFrame={camFrame} fps={fps} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted text-2xs text-muted-foreground">
                {loading ? 'Loading…' : 'No source'}
              </div>
            )}
            <div className="absolute top-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-2xs text-white flex justify-between">
              <span style={{ color: slot.color }}>{slot.label}</span>
              <span className="font-mono opacity-80">
                {isMaster ? '★ ' : ''}f{camFrame + 1}
                {slot.offset_frames !== 0 ? ` (${slot.offset_frames >= 0 ? '+' : ''}${slot.offset_frames})` : ''}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function SyncedCameraVideo({
  src,
  poster,
  targetFrame,
  fps,
}: {
  src: string
  poster?: string | null
  targetFrame: number
  fps: number
}) {
  const timeSec = targetFrame / Math.max(fps, 1)
  return (
    <video
      key={`${src}-${targetFrame}`}
      src={src}
      poster={poster ?? undefined}
      className="w-full h-full object-contain bg-black pointer-events-none"
      muted
      preload="metadata"
      ref={(el) => {
        if (el && Math.abs(el.currentTime - timeSec) > 0.05) {
          el.currentTime = timeSec
        }
      }}
    />
  )
}
