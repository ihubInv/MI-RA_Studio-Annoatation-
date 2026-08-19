import { PlaybackControls } from '@/modules/video/components/PlaybackControls'
import { FrameNavigation } from '@/modules/video/components/FrameNavigation'
import { TimestampNavigation } from '@/modules/video/components/TimestampNavigation'
import type { VideoPlayer } from '@/modules/video/hooks/useVideoPlayer'
import { formatTimecode } from '@/modules/video/frameIndex'

interface Props {
  player: VideoPlayer
  disabled?: boolean
}

export function VideoTransportBar({ player, disabled }: Props) {
  return (
    <div className="shrink-0 border-t border-border bg-white/95 backdrop-blur-sm px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PlaybackControls player={player} disabled={disabled} />
        <p className="text-xs font-mono tabular-nums text-muted-foreground">
          {formatTimecode(player.currentTime)}
          {player.index?.duration_sec ? (
            <span> / {formatTimecode(player.index.duration_sec)}</span>
          ) : null}
        </p>
      </div>
      <FrameNavigation player={player} disabled={disabled} />
      <TimestampNavigation player={player} disabled={disabled} />
      <p className="text-2xs text-muted-foreground">
        Draw on a frame to create a keyframe · annotations save automatically · press K to save the current frame of a selected object
      </p>
    </div>
  )
}
