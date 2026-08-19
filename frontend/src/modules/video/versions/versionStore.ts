import type { VideoAnnotationStore } from '@/modules/video/canvas/annotationStorage'

export interface AnnotationVersion {
  id: string
  version: number
  label: string
  created_at: string
  created_by: string
  snapshot: VideoAnnotationStore
}

function key(itemId: string) {
  return `mira.video.versions.${itemId}`
}

export function loadVersions(itemId: string): AnnotationVersion[] {
  try {
    const raw = localStorage.getItem(key(itemId))
    if (raw) return JSON.parse(raw) as AnnotationVersion[]
  } catch {
    /* ignore */
  }
  return []
}

export function saveVersions(itemId: string, versions: AnnotationVersion[]) {
  try {
    localStorage.setItem(key(itemId), JSON.stringify(versions.slice(-20)))
  } catch {
    /* quota */
  }
}

export function nextVersionNumber(versions: AnnotationVersion[]) {
  return (versions[versions.length - 1]?.version ?? 0) + 1
}

export function compareStores(a: VideoAnnotationStore, b: VideoAnnotationStore) {
  return {
    rects: b.rects.length - a.rects.length,
    skeletons: b.skeletons.length - a.skeletons.length,
    masks: b.masks.length - a.masks.length,
    events: b.events.length - a.events.length,
    actions: b.actions.length - a.actions.length,
    relations: b.relations.length - a.relations.length,
  }
}
