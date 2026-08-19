import { useEffect, useState } from 'react'
import type { VideoPlayer } from '@/modules/video/hooks/useVideoPlayer'
import { formatTimecode, parseFrameInput, parseTimecode } from '@/modules/video/frameIndex'
import { cn } from '@/utils/cn'

interface Props {
  player: VideoPlayer
  disabled?: boolean
}

export function TimestampNavigation({ player, disabled }: Props) {
  const { currentTime, currentFrame, seekToTime, seekToFrame, maxFrame } = player
  const [timeInput, setTimeInput] = useState('')
  const [frameInput, setFrameInput] = useState('')
  const [timeError, setTimeError] = useState('')
  const [frameError, setFrameError] = useState('')

  useEffect(() => {
    setTimeInput(formatTimecode(currentTime))
    setFrameInput(String(currentFrame))
  }, [currentTime, currentFrame])

  const submitTime = () => {
    const sec = parseTimecode(timeInput)
    if (sec == null) {
      setTimeError('Use HH:MM:SS.mmm or seconds')
      return
    }
    setTimeError('')
    seekToTime(sec)
  }

  const submitFrame = () => {
    const frame = parseFrameInput(frameInput)
    if (frame == null) {
      setFrameError('Enter a frame number')
      return
    }
    if (frame > maxFrame) {
      setFrameError(`Max frame is ${maxFrame}`)
      return
    }
    setFrameError('')
    seekToFrame(frame)
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground whitespace-nowrap">Time</span>
        <input
          type="text"
          disabled={disabled}
          value={timeInput}
          onChange={(e) => {
            setTimeInput(e.target.value)
            setTimeError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && submitTime()}
          onBlur={submitTime}
          placeholder="00:01:25.350"
          className={cn('mira-input h-8 w-32 font-mono text-xs tabular-nums', timeError && 'border-destructive')}
        />
      </label>
      {timeError && <span className="text-2xs text-destructive">{timeError}</span>}

      <label className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground whitespace-nowrap">Frame</span>
        <input
          type="text"
          disabled={disabled}
          value={frameInput}
          onChange={(e) => {
            setFrameInput(e.target.value)
            setFrameError('')
          }}
          onKeyDown={(e) => e.key === 'Enter' && submitFrame()}
          onBlur={submitFrame}
          placeholder="1250"
          className={cn('mira-input h-8 w-24 font-mono text-xs tabular-nums', frameError && 'border-destructive')}
        />
      </label>
      {frameError && <span className="text-2xs text-destructive">{frameError}</span>}
    </div>
  )
}
