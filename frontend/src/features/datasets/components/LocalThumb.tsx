import { useEffect, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getOrCreateThumb } from '@/features/datasets/local/registry'

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
        <ImageIcon className="w-8 h-8" />
      </div>
    )
  }
  return <img src={src} alt={alt} className="w-full h-full object-contain" loading="lazy" />
}
