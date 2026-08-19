import {
  ChevronFirst,
  ChevronLast,
  ChevronsLeft,
  ChevronsRight,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import type { VideoPlayer } from '@/modules/video/hooks/useVideoPlayer'
import { cn } from '@/utils/cn'

interface Props {
  player: VideoPlayer
  disabled?: boolean
}

export function FrameNavigation({ player, disabled }: Props) {
  const { currentFrame, maxFrame, prevFrame, nextFrame, jumpFrames, firstFrame, lastFrame } = player

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-2xs text-muted-foreground mr-1 hidden sm:inline">Frame</span>
      <button type="button" disabled={disabled} onClick={firstFrame} className={cn('mira-btn-ghost h-8 w-8 p-0', disabled && 'opacity-40')} title="First frame (Home)">
        <ChevronFirst className="w-4 h-4" />
      </button>
      <button type="button" disabled={disabled} onClick={() => jumpFrames(-100)} className={cn('mira-btn-ghost h-8 px-2 text-2xs', disabled && 'opacity-40')} title="−100 frames">
        <ChevronsLeft className="w-3.5 h-3.5" /> 100
      </button>
      <button type="button" disabled={disabled} onClick={() => jumpFrames(-10)} className={cn('mira-btn-ghost h-8 px-2 text-2xs', disabled && 'opacity-40')} title="−10 frames (Shift+←)">
        −10
      </button>
      <button type="button" disabled={disabled} onClick={prevFrame} className={cn('mira-btn-ghost h-8 w-8 p-0', disabled && 'opacity-40')} title="Previous frame (←)">
        <SkipBack className="w-4 h-4" />
      </button>
      <span className="text-xs font-mono tabular-nums min-w-[5.5rem] text-center px-1">
        {currentFrame} <span className="text-muted-foreground">/ {maxFrame}</span>
      </span>
      <button type="button" disabled={disabled} onClick={nextFrame} className={cn('mira-btn-ghost h-8 w-8 p-0', disabled && 'opacity-40')} title="Next frame (→)">
        <SkipForward className="w-4 h-4" />
      </button>
      <button type="button" disabled={disabled} onClick={() => jumpFrames(10)} className={cn('mira-btn-ghost h-8 px-2 text-2xs', disabled && 'opacity-40')} title="+10 frames (Shift+→)">
        +10
      </button>
      <button type="button" disabled={disabled} onClick={() => jumpFrames(100)} className={cn('mira-btn-ghost h-8 px-2 text-2xs', disabled && 'opacity-40')} title="+100 frames">
        100 <ChevronsRight className="w-3.5 h-3.5" />
      </button>
      <button type="button" disabled={disabled} onClick={lastFrame} className={cn('mira-btn-ghost h-8 w-8 p-0', disabled && 'opacity-40')} title="Last frame (End)">
        <ChevronLast className="w-4 h-4" />
      </button>
    </div>
  )
}
