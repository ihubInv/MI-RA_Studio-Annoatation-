/** Multi-camera group — Phase 24 (dataset-level). */

export interface CameraSlot {
  id: string
  item_id: string
  label: string
  color: string
  /** Frame offset relative to master timeline (+ = this camera starts later) */
  offset_frames: number
  offset_sec: number
}

export interface CameraGroup {
  id: string
  name: string
  dataset_id: string
  master_item_id: string
  cameras: CameraSlot[]
}

export interface VideoCameraGroupSchema {
  version: 1
  dataset_id: string
  groups: CameraGroup[]
}

function storageKey(datasetId: string) {
  return `mira.video.camera-groups.${datasetId}`
}

export function loadCameraGroups(datasetId: string): VideoCameraGroupSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetId))
    if (raw) {
      const parsed = JSON.parse(raw) as VideoCameraGroupSchema
      if (parsed?.groups) return { ...parsed, dataset_id: datasetId, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, dataset_id: datasetId, groups: [] }
}

export function saveCameraGroups(schema: VideoCameraGroupSchema) {
  localStorage.setItem(storageKey(schema.dataset_id), JSON.stringify(schema))
}

export function newCameraGroupId() {
  return crypto.randomUUID()
}

export function newCameraSlotId() {
  return crypto.randomUUID()
}

export function emptyCameraSlot(itemId: string, label: string): CameraSlot {
  return {
    id: newCameraSlotId(),
    item_id: itemId,
    label,
    color: '#6366f1',
    offset_frames: 0,
    offset_sec: 0,
  }
}

export function findGroupForItem(groups: CameraGroup[], itemId: string): CameraGroup | null {
  return groups.find((g) => g.cameras.some((c) => c.item_id === itemId)) ?? null
}

export function masterFrameToCameraFrame(masterFrame: number, slot: CameraSlot): number {
  return Math.max(0, masterFrame - slot.offset_frames)
}

export function cameraFrameToMasterFrame(cameraFrame: number, slot: CameraSlot): number {
  return cameraFrame + slot.offset_frames
}

export function syncTimeSec(masterFrame: number, fps: number, slot: CameraSlot): number {
  const cf = masterFrameToCameraFrame(masterFrame, slot)
  return cf / Math.max(fps, 1)
}
