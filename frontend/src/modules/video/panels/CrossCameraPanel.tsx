import { Link2, Unlink } from 'lucide-react'
import type { CrossCameraApi } from '@/modules/video/hooks/useCrossCameraLinks'

interface Props {
  crossCamera: CrossCameraApi
  itemId: string
  objectId: string | null
  objectLabel: string | null
}

/** Task 24.4 — shared object IDs across cameras. */
export function CrossCameraPanel({ crossCamera, itemId, objectId, objectLabel }: Props) {
  if (!objectId || !objectLabel) {
    return (
      <div className="border-t border-border px-2 py-2">
        <p className="text-2xs text-muted-foreground">Select an object to link cross-camera ID.</p>
      </div>
    )
  }

  const globalId = crossCamera.getGlobalId(itemId, objectId)
  const link = crossCamera.links.find((l) =>
    l.entries.some((e) => e.item_id === itemId && e.object_id === objectId),
  )

  return (
    <div className="border-t border-border shrink-0 px-2 py-2 space-y-2">
      <p className="mira-section-label mb-0 text-violet-900">Shared object ID</p>
      <p className="text-2xs font-mono truncate">{objectId}</p>
      {globalId ? (
        <>
          <p className="text-xs font-mono text-violet-700 bg-violet-50 rounded px-2 py-1">{globalId}</p>
          {link && link.entries.length > 1 && (
            <ul className="text-2xs space-y-0.5">
              {link.entries.map((e) => (
                <li key={`${e.item_id}:${e.object_id}`} className="font-mono truncate">
                  {e.item_id === itemId ? '● ' : '○ '}{e.object_id}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="w-full mira-btn-ghost h-7 text-2xs text-destructive"
            onClick={() => crossCamera.unlinkObject(itemId, objectId)}
          >
            <Unlink className="w-3 h-3 inline mr-1" /> Unlink
          </button>
        </>
      ) : (
        <button
          type="button"
          className="w-full mira-btn-ghost h-8 text-xs"
          onClick={() => crossCamera.linkObject(itemId, objectId, objectLabel)}
        >
          <Link2 className="w-3.5 h-3.5 inline mr-1" /> Create shared ID
        </button>
      )}
    </div>
  )
}
