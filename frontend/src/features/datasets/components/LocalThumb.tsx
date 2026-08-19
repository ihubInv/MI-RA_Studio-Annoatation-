import { useEffect, useState } from 'react'
import { Film, Image as ImageIcon } from 'lucide-react'
import { getOrCreateThumb } from '@/features/datasets/local/registry'
import { isVideoPath } from '@/modules/video/constants'

export function LocalThumb({
  datasetId,
  relativePath,
  fallback,
  alt,
}: {
  datasetId: string
  relativePath: string
  fallback?: string | null
  alt: string
}) {
  const [src, setSrc] = useState<string | null>(fallback || null)
  const video = isVideoPath(relativePath)

  useEffect(() => {
    let alive = true
    let created: string | null = null
    setSrc(fallback || null)
    getOrCreateThumb(datasetId, relativePath).then((url) => {
      if (!url) return
      if (!alive) {
        URL.revokeObjectURL(url)
        return
      }
      created = url
      setSrc(url)
    })
    return () => {
      alive = false
      if (created) URL.revokeObjectURL(created)
    }
  }, [datasetId, relativePath, fallback])

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        {video ? <Film className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
      </div>
    )
  }
  return (
    <div className="relative w-full h-full">
      <img src={src} alt={alt} className="w-full h-full object-contain" loading="lazy" />
      {video && (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 p-0.5 text-white">
          <Film className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  )
}
