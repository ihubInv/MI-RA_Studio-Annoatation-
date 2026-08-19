import type { VideoTrack } from '@/modules/video/timeline/track.types'

interface Props {
  track: VideoTrack | null
  mergeCandidateId: string | null
  allTracks: VideoTrack[]
  onMergeCandidateChange: (objectId: string | null) => void
  onMerge: () => void
}

export function TrackPanel({
  track,
  mergeCandidateId,
  allTracks,
  onMergeCandidateChange,
  onMerge,
}: Props) {
  const mergeOptions = allTracks.filter((t) => t.object_id !== track?.object_id)

  return (
    <section className="border-b border-border bg-white shrink-0">
      <div className="px-3 py-2 border-b border-border/60">
        <p className="mira-section-label">Track</p>
      </div>
      {!track ? (
        <p className="text-2xs text-muted-foreground px-3 py-3">Select an object to view its track.</p>
      ) : (
        <div className="p-3 space-y-2 text-xs">
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <span className="text-2xs text-muted-foreground uppercase">Object ID</span>
            <span className="font-mono truncate" style={{ color: track.color }}>
              {track.object_id}
            </span>
            <span className="text-2xs text-muted-foreground uppercase">Class</span>
            <span>{track.class_name}</span>
            <span className="text-2xs text-muted-foreground uppercase">Start</span>
            <span className="font-mono tabular-nums">{track.start_frame}</span>
            <span className="text-2xs text-muted-foreground uppercase">End</span>
            <span className="font-mono tabular-nums">{track.end_frame}</span>
            <span className="text-2xs text-muted-foreground uppercase">Keyframes</span>
            <span className="font-mono text-2xs leading-relaxed">{track.keyframes.join(', ')}</span>
          </div>

          {mergeOptions.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <label className="block space-y-0.5">
                <span className="text-2xs text-muted-foreground uppercase">Merge with</span>
                <select
                  className="mira-input h-8 w-full text-xs font-mono"
                  value={mergeCandidateId ?? ''}
                  onChange={(e) => onMergeCandidateChange(e.target.value || null)}
                >
                  <option value="">— select track —</option>
                  {mergeOptions.map((t) => (
                    <option key={t.object_id} value={t.object_id}>
                      {t.object_id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="mira-btn-ghost h-7 text-xs w-full"
                disabled={!mergeCandidateId}
                onClick={onMerge}
              >
                Merge into {track.object_id}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
