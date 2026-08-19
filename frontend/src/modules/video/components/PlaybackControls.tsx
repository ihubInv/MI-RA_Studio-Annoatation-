import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import type { VideoPlayer } from '@/modules/video/hooks/useVideoPlayer'
import { cn } from '@/utils/cn'

interface Props {
  player: VideoPlayer
  disabled?: boolean
}

export function PlaybackControls({ player, disabled }: Props) {
  const { isPlaying, play, pause, stop, restart } = player

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (isPlaying ? pause() : play())}
        className={cn('mira-btn-primary h-8 px-3 text-xs', disabled && 'opacity-40')}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={stop}
        className={cn('mira-btn-ghost h-8 px-2 text-xs', disabled && 'opacity-40')}
        title="Stop"
      >
        <Square className="w-3.5 h-3.5" /> Stop
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => restart()}
        className={cn('mira-btn-ghost h-8 px-2 text-xs', disabled && 'opacity-40')}
        title="Restart"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Restart
      </button>
    </div>
  )
}
