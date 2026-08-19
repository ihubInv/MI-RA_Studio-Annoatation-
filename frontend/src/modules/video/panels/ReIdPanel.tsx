import { Users } from 'lucide-react'
import type { CrossCameraApi } from '@/modules/video/hooks/useCrossCameraLinks'
import type { ReIdCandidate } from '@/modules/video/multicamera/crossCameraStore'

interface Props {
  crossCamera: CrossCameraApi
  itemId: string
  objectId: string | null
  objectLabel: string | null
  candidates: ReIdCandidate[]
  onLink: (candidate: ReIdCandidate) => void
}

/** Task 24.5–24.6 — cross-camera tracking & re-identification suggestions. */
export function ReIdPanel({ crossCamera, itemId, objectId, objectLabel, candidates, onLink }: Props) {
  if (!objectId || !objectLabel) return null
  if (crossCamera.getGlobalId(itemId, objectId)) return null

  return (
    <div className="border-t border-border shrink-0 px-2 py-2">
      <p className="mira-section-label mb-1 text-violet-900 flex items-center gap-1">
        <Users className="w-3.5 h-3.5" /> Re-ID candidates
      </p>
      {candidates.length === 0 ? (
        <p className="text-2xs text-muted-foreground">No matching objects on other cameras.</p>
      ) : (
        <ul className="space-y-1 max-h-24 overflow-y-auto">
          {candidates.slice(0, 5).map((c) => (
            <li key={`${c.item_id}:${c.object_id}`}>
              <button
                type="button"
                className="w-full text-left text-2xs px-1.5 py-1 rounded border hover:bg-accent"
                onClick={() => onLink(c)}
              >
                <span className="font-mono">{c.object_id}</span>
                <span className="text-muted-foreground ml-1">· {Math.round(c.score * 100)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
