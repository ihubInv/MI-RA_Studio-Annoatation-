import { useEffect, useState } from 'react'
import { scanLocalVideoAnalytics } from '@/modules/video/analytics/collectStats'
import { analyticsService } from '@/services/studioOps.service'

const LABELS: { key: keyof ReturnType<typeof scanLocalVideoAnalytics>; label: string }[] = [
  { key: 'videos', label: 'Videos' },
  { key: 'total_frames', label: 'Total Frames' },
  { key: 'annotated_frames', label: 'Annotated Frames' },
  { key: 'objects', label: 'Objects' },
  { key: 'tracks', label: 'Tracks' },
  { key: 'keyframes', label: 'Keyframes' },
  { key: 'masks', label: 'Masks' },
  { key: 'events', label: 'Events' },
  { key: 'qa_errors', label: 'QA Errors' },
]

export function VideoAnalyticsPage() {
  const local = scanLocalVideoAnalytics()
  const [server, setServer] = useState<Awaited<ReturnType<typeof analyticsService.overview>> | null>(null)

  useEffect(() => {
    analyticsService.overview().then(setServer).catch(() => setServer(null))
  }, [])

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-lg font-semibold mb-1">Video analytics</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Server counts from PostgreSQL, plus this browser’s local annotation cache.
      </p>
      {server && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {(['videos', 'annotations', 'objects', 'qa_results', 'reviews', 'tasks', 'datasets', 'total_frames'] as const).map((key) => (
            <div key={key} className="rounded-lg border bg-white p-4">
              <p className="text-xs text-muted-foreground">Server · {key.replace('_', ' ')}</p>
              <p className="text-2xl font-semibold tabular-nums mt-1">{server[key].toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      <h2 className="text-sm font-semibold mb-2">This browser</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {LABELS.map(({ key, label }) => (
          <div key={key} className="rounded-lg border bg-white p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{local[key].toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
