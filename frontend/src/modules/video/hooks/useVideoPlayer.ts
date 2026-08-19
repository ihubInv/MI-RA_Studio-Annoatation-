import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FrameIndex } from '@/modules/video/api/video.service'
import { clampFrame, frameToTimeSec, timeSecToFrame } from '@/modules/video/frameIndex'

export type PlaybackState = 'idle' | 'playing' | 'paused'

export interface UseVideoPlayerOptions {
  src: string | null
  frameIndex: FrameIndex | null
  fps?: number
  durationSec?: number
  frameCount?: number
}

const DEFAULT_FPS = 30

function buildIndex(args: {
  frameIndex: FrameIndex | null
  fps?: number
  durationSec?: number
  frameCount?: number
  mediaDuration?: number
}): FrameIndex {
  const fps = args.frameIndex?.fps || args.fps || DEFAULT_FPS
  const duration =
    (Number.isFinite(args.mediaDuration) && (args.mediaDuration ?? 0) > 0 ? args.mediaDuration : 0) ||
    args.frameIndex?.duration_sec ||
    args.durationSec ||
    0
  const fromMeta =
    args.frameIndex?.frame_count ||
    args.frameCount ||
    0
  const fromDuration = duration > 0 ? Math.max(1, Math.round(duration * fps)) : 0
  const frameCount = Math.max(fromMeta, fromDuration, 1)
  return {
    version: args.frameIndex?.version ?? '1',
    frame_count: frameCount,
    fps,
    duration_sec: duration || frameCount / fps,
    fps_rational: args.frameIndex?.fps_rational,
  }
}

export function useVideoPlayer({ src, frameIndex, fps, durationSec, frameCount }: UseVideoPlayerOptions) {
  const innerVideo = useRef<HTMLVideoElement | null>(null)
  const notifiedEl = useRef<HTMLVideoElement | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [currentTime, setCurrentTime] = useState(0)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)

  const videoRef = useMemo(() => {
    return {
      get current() {
        return innerVideo.current
      },
      set current(el: HTMLVideoElement | null) {
        innerVideo.current = el
        // Ignore detach (null). Callback refs fire null on every parent re-render
        // when the callback identity changes; setState there loops forever.
        if (el && notifiedEl.current !== el) {
          notifiedEl.current = el
          setVideoEl(el)
        }
      },
    }
  }, [])

  const index = useMemo(
    () =>
      buildIndex({
        frameIndex,
        fps,
        durationSec,
        frameCount,
        mediaDuration,
      }),
    [frameIndex, fps, durationSec, frameCount, mediaDuration],
  )

  const maxFrame = Math.max(0, index.frame_count - 1)

  const syncFromVideo = useCallback(() => {
    const video = innerVideo.current
    if (!video) return
    const t = Number.isFinite(video.currentTime) ? video.currentTime : 0
    setCurrentTime(t)
    setCurrentFrame(timeSecToFrame(t, index))
    if (Number.isFinite(video.duration) && video.duration > 0 && video.duration !== mediaDuration) {
      setMediaDuration(video.duration)
    }
  }, [index, mediaDuration])

  useEffect(() => {
    const video = videoEl ?? innerVideo.current
    if (!video) return

    const onTimeUpdate = () => syncFromVideo()
    const onPlay = () => setPlaybackState('playing')
    const onPause = () => setPlaybackState('paused')
    const onEnded = () => {
      setPlaybackState('paused')
      syncFromVideo()
    }
    const onLoaded = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setMediaDuration(video.duration)
      }
      setPlaybackState(video.paused ? 'paused' : 'playing')
      syncFromVideo()
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('durationchange', onLoaded)
    video.addEventListener('seeked', syncFromVideo)

    if (video.readyState >= 1) onLoaded()

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('durationchange', onLoaded)
      video.removeEventListener('seeked', syncFromVideo)
    }
  }, [src, videoEl, syncFromVideo])

  const seekToTime = useCallback(
    (timeSec: number) => {
      const video = innerVideo.current
      const max = (Number.isFinite(video?.duration) ? video!.duration : 0) || index.duration_sec || Infinity
      const clamped = Math.min(Math.max(0, timeSec), max)
      if (video) video.currentTime = clamped
      setCurrentTime(clamped)
      setCurrentFrame(timeSecToFrame(clamped, index))
    },
    [index],
  )

  const seekToFrame = useCallback(
    (frame: number) => {
      const clamped = clampFrame(frame, index)
      seekToTime(frameToTimeSec(clamped, index))
    },
    [index, seekToTime],
  )

  const play = useCallback(async () => {
    const video = innerVideo.current
    if (!video) return
    try {
      await video.play()
      setPlaybackState('playing')
    } catch {
      setPlaybackState('paused')
    }
  }, [])

  const pause = useCallback(() => {
    innerVideo.current?.pause()
    setPlaybackState('paused')
  }, [])

  const stop = useCallback(() => {
    const video = innerVideo.current
    if (!video) return
    video.pause()
    seekToFrame(0)
    setPlaybackState('paused')
  }, [seekToFrame])

  const restart = useCallback(async () => {
    seekToFrame(0)
    await play()
  }, [play, seekToFrame])

  const nextFrame = useCallback(() => seekToFrame(currentFrame + 1), [currentFrame, seekToFrame])
  const prevFrame = useCallback(() => seekToFrame(currentFrame - 1), [currentFrame, seekToFrame])
  const jumpFrames = useCallback((delta: number) => seekToFrame(currentFrame + delta), [currentFrame, seekToFrame])
  const firstFrame = useCallback(() => seekToFrame(0), [seekToFrame])
  const lastFrame = useCallback(() => seekToFrame(maxFrame), [maxFrame, seekToFrame])

  return {
    videoRef,
    playbackState,
    isPlaying: playbackState === 'playing',
    currentTime,
    currentFrame,
    maxFrame,
    index,
    play,
    pause,
    stop,
    restart,
    seekToTime,
    seekToFrame,
    nextFrame,
    prevFrame,
    jumpFrames,
    firstFrame,
    lastFrame,
  }
}

export type VideoPlayer = ReturnType<typeof useVideoPlayer>
