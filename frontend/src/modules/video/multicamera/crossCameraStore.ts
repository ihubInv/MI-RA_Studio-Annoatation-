/** Cross-camera object links — Phase 24. */

export interface CrossCameraEntry {
  item_id: string
  object_id: string
  label?: string
}

export interface CrossCameraLink {
  id: string
  /** Shared logical ID, e.g. Person_global_001 */
  global_object_id: string
  entries: CrossCameraEntry[]
}

export interface CrossCameraSchema {
  version: 1
  dataset_id: string
  links: CrossCameraLink[]
}

function storageKey(datasetId: string) {
  return `mira.video.cross-camera.${datasetId}`
}

export function loadCrossCameraLinks(datasetId: string): CrossCameraSchema {
  try {
    const raw = localStorage.getItem(storageKey(datasetId))
    if (raw) {
      const parsed = JSON.parse(raw) as CrossCameraSchema
      if (parsed?.links) return { ...parsed, dataset_id: datasetId, version: 1 }
    }
  } catch {
    /* ignore */
  }
  return { version: 1, dataset_id: datasetId, links: [] }
}

export function saveCrossCameraLinks(schema: CrossCameraSchema) {
  localStorage.setItem(storageKey(schema.dataset_id), JSON.stringify(schema))
}

export function newCrossCameraLinkId() {
  return crypto.randomUUID()
}

export function nextGlobalObjectId(links: CrossCameraLink[], label: string): string {
  const base = label.replace(/\s+/g, '_')
  const n = links.filter((l) => l.global_object_id.startsWith(`${base}_global`)).length + 1
  return `${base}_global_${String(n).padStart(3, '0')}`
}

export function findLinkForObject(
  links: CrossCameraLink[],
  itemId: string,
  objectId: string,
): CrossCameraLink | null {
  return links.find((l) => l.entries.some((e) => e.item_id === itemId && e.object_id === objectId)) ?? null
}

export interface ReIdCandidate {
  linkId: string
  global_object_id: string
  item_id: string
  object_id: string
  label: string
  score: number
}

/** Simple re-ID: same label on another camera at similar master frame. */
export function suggestReIdCandidates(
  links: CrossCameraLink[],
  currentItemId: string,
  currentObjectId: string,
  currentLabel: string,
  masterFrame: number,
  otherCameraObjects: { item_id: string; object_id: string; label: string; frame: number }[],
  fps: number,
  windowSec = 2,
): ReIdCandidate[] {
  const windowFrames = Math.round(windowSec * fps)
  const existing = findLinkForObject(links, currentItemId, currentObjectId)
  if (existing) return []

  const out: ReIdCandidate[] = []
  for (const obj of otherCameraObjects) {
    if (obj.item_id === currentItemId) continue
    if (obj.label.toLowerCase() !== currentLabel.toLowerCase()) continue
    const frameDist = Math.abs(obj.frame - masterFrame)
    if (frameDist > windowFrames) continue
    const linked = findLinkForObject(links, obj.item_id, obj.object_id)
    const score = 1 - frameDist / windowFrames
    out.push({
      linkId: linked?.id ?? '',
      global_object_id: linked?.global_object_id ?? nextGlobalObjectId(links, currentLabel),
      item_id: obj.item_id,
      object_id: obj.object_id,
      label: obj.label,
      score,
    })
  }
  return out.sort((a, b) => b.score - a.score)
}
