import type { TemplateTimelineConfig } from './document'
import type { TemplateTimelineTrackId } from './catalog'
import { TEMPLATE_TIMELINE_TRACKS, isTemplateTimelineTrackId } from './catalog'

export interface NormalizedTimelineTrack {
  id: TemplateTimelineTrackId
  enabled: boolean
  display_name?: string
}

export function normalizeTimelineTracks(timeline?: TemplateTimelineConfig | null): NormalizedTimelineTrack[] {
  const src = timeline ?? {}
  const seen = new Set<TemplateTimelineTrackId>()
  const rows: NormalizedTimelineTrack[] = []
  for (const id of TEMPLATE_TIMELINE_TRACKS) {
    if (id in src) {
      seen.add(id)
      rows.push({ id, enabled: Boolean(src[id]), display_name: id.replace(/_/g, ' ') })
    }
  }
  for (const key of Object.keys(src)) {
    if (isTemplateTimelineTrackId(key) && !seen.has(key)) {
      rows.push({ id: key, enabled: Boolean(src[key]), display_name: key.replace(/_/g, ' ') })
    }
  }
  return rows
}
