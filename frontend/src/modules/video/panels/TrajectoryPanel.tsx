import { Route, Trash2 } from 'lucide-react'
import type { VideoTrajectoriesApi } from '@/modules/video/hooks/useVideoTrajectories'
import type { VideoTrajectory } from '@/modules/video/trajectory/trajectoryTypes'

interface Props {
  trajectories: VideoTrajectoriesApi
  objectId: string | null
  onGenerate: () => void
}

function formatMetrics(tr: VideoTrajectory) {
  const m = tr.metrics
  if (!m) return null
  return (
    <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-2xs">
      <dt className="text-muted-foreground">Distance</dt>
      <dd className="font-mono">{m.total_distance_px.toFixed(1)} px</dd>
      <dt className="text-muted-foreground">Direction</dt>
      <dd className="font-mono">{m.direction_deg.toFixed(1)}°</dd>
      <dt className="text-muted-foreground">Avg velocity</dt>
      <dd className="font-mono">{m.avg_velocity_px_per_sec.toFixed(1)} px/s</dd>
      <dt className="text-muted-foreground">Max velocity</dt>
      <dd className="font-mono">{m.max_velocity_px_per_sec.toFixed(1)} px/s</dd>
      <dt className="text-muted-foreground col-span-2">Acceleration</dt>
      <dd className="font-mono col-span-2">{m.avg_acceleration_px_per_sec2.toFixed(1)} px/s²</dd>
    </dl>
  )
}

export function TrajectoryPanel({ trajectories, objectId, onGenerate }: Props) {
  const tr = objectId ? trajectories.trajectoryForObject(objectId) : null

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1.5 flex items-center justify-between bg-orange-50/50">
        <p className="mira-section-label mb-0 text-orange-900">Trajectory</p>
        <label className="flex items-center gap-1 text-2xs text-muted-foreground">
          <input
            type="checkbox"
            checked={trajectories.showTrajectories}
            onChange={(e) => trajectories.setShowTrajectories(e.target.checked)}
          />
          Show
        </label>
      </div>
      {!objectId && (
        <p className="px-2 py-2 text-2xs text-muted-foreground">Select an object track to generate trajectory.</p>
      )}
      {objectId && (
        <div className="px-2 pb-2 space-y-2">
          <p className="text-2xs font-mono truncate pt-1">{objectId}</p>
          <button
            type="button"
            className="w-full mira-btn-ghost h-8 text-xs flex items-center justify-center gap-1.5"
            onClick={onGenerate}
          >
            <Route className="w-3.5 h-3.5" /> Generate trajectory
          </button>
          {tr && (
            <>
              <div className="rounded-md border border-border p-2 bg-white/80">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-2xs font-medium">{tr.points.length} points</span>
                  <button
                    type="button"
                    className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                    title="Remove trajectory"
                    onClick={() => trajectories.removeForObject(objectId)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {formatMetrics(tr)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
