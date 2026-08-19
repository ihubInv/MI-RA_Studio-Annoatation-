import { Camera, Star, Trash2 } from 'lucide-react'
import type { CameraGroupApi } from '@/modules/video/hooks/useCameraGroup'
import type { CameraGroup } from '@/modules/video/multicamera/cameraGroupStore'
import { emptyCameraSlot } from '@/modules/video/multicamera/cameraGroupStore'

interface DatasetVideo {
  id: string
  name: string
}

interface Props {
  cameraGroup: CameraGroupApi
  group: CameraGroup | null
  currentItemId: string
  datasetVideos: DatasetVideo[]
  fps: number
  onOpenFullManager?: () => void
}

/** Task 24.1 — camera management panel. */
export function CameraManagerPanel({
  cameraGroup,
  group,
  currentItemId,
  datasetVideos,
  fps,
}: Props) {
  const others = datasetVideos.filter((v) => !group?.cameras.some((c) => c.item_id === v.id))

  const ensureGroup = () => {
    if (group) return group
    cameraGroup.createGroup('Camera group', currentItemId, [
      emptyCameraSlot(currentItemId, 'Cam A'),
    ])
    return cameraGroup.activeGroup
  }

  const g = group ?? cameraGroup.activeGroup

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1.5 flex items-center justify-between bg-violet-50/50">
        <p className="mira-section-label mb-0 text-violet-900 flex items-center gap-1">
          <Camera className="w-3.5 h-3.5" /> Cameras
        </p>
      </div>
      <div className="px-2 py-2 space-y-2">
        {!g && (
          <button
            type="button"
            className="w-full mira-btn-ghost h-8 text-xs"
            onClick={() => ensureGroup()}
          >
            Create camera group
          </button>
        )}
        {g && (
          <>
            <p className="text-2xs font-medium truncate">{g.name}</p>
            <ul className="space-y-1">
              {g.cameras.map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center gap-1 text-2xs border rounded px-1.5 py-1"
                  style={{ borderColor: slot.color }}
                >
                  <button
                    type="button"
                    title="Set as master"
                    className="shrink-0 opacity-60 hover:opacity-100"
                    onClick={() => cameraGroup.setMaster(g.id, slot.item_id)}
                  >
                    <Star
                      className={`w-3 h-3 ${g.master_item_id === slot.item_id ? 'fill-amber-400 text-amber-500' : ''}`}
                    />
                  </button>
                  <span className="flex-1 truncate font-mono">{slot.label}</span>
                  <input
                    type="number"
                    className="w-12 h-5 text-2xs font-mono border rounded px-0.5"
                    title="Offset frames"
                    value={slot.offset_frames}
                    onChange={(e) =>
                      cameraGroup.updateSlot(g.id, slot.id, {
                        offset_frames: Number(e.target.value) || 0,
                        offset_sec: (Number(e.target.value) || 0) / Math.max(fps, 1),
                      })
                    }
                  />
                  {g.cameras.length > 1 && (
                    <button
                      type="button"
                      className="text-destructive shrink-0"
                      onClick={() => cameraGroup.removeCamera(g.id, slot.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {others.length > 0 && (
              <select
                className="mira-input h-7 text-2xs w-full"
                defaultValue=""
                onChange={(e) => {
                  const v = others.find((o) => o.id === e.target.value)
                  if (v) {
                    cameraGroup.addCameraToGroup(
                      g.id,
                      v.id,
                      `Cam ${String.fromCharCode(65 + g.cameras.length)}`,
                    )
                    e.target.value = ''
                  }
                }}
              >
                <option value="">Add camera from dataset…</option>
                {others.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>
    </div>
  )
}
