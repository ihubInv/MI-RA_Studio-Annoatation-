import { forwardRef } from 'react'
import { Film } from 'lucide-react'
import { cn } from '@/utils/cn'

interface Props {
  src: string | null
  poster?: string | null
  loading?: boolean
  error?: string | null
  className?: string
}

export const VideoCanvas = forwardRef<HTMLVideoElement, Props>(function VideoCanvas(
  { src, poster, loading, error, className },
  ref,
) {
  return (
    <div
      className={cn(
        'relative flex-1 min-h-0 flex items-center justify-center bg-workspace overflow-hidden',
        className,
      )}
    >
      <div className="absolute inset-3 border border-border/60 rounded-lg bg-black/5 pointer-events-none" />

      {error ? (
        <div className="text-center px-6 max-w-md">
          <Film className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      ) : loading || !src ? (
        <div className="text-center px-6">
          {poster ? (
            <img src={poster} alt="" className="max-h-[60vh] max-w-full object-contain opacity-60 rounded-md mb-3" />
          ) : (
            <Film className="w-10 h-10 mx-auto mb-2 text-muted-foreground animate-pulse" />
          )}
          <p className="text-sm text-muted-foreground">{loading ? 'Loading video…' : 'No video source'}</p>
        </div>
      ) : (
        <video
          ref={ref}
          src={src}
          poster={poster || undefined}
          className="max-h-full max-w-full object-contain shadow-lg rounded-sm"
          playsInline
          preload="auto"
        />
      )}

      {!error && src && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-2xs uppercase tracking-widest text-muted-foreground/50 pointer-events-none select-none">
          Video
        </div>
      )}
    </div>
  )
})
