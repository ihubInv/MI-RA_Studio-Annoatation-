/** Phase 13 — occlusion states for video objects and joints. */
export type OcclusionState =
  | 'visible'
  | 'partially_occluded'
  | 'fully_occluded'
  | 'outside_frame'
  | 'reappeared'

export const OCCLUSION_STATES: { id: OcclusionState; label: string }[] = [
  { id: 'visible', label: 'Visible' },
  { id: 'partially_occluded', label: 'Partially occluded' },
  { id: 'fully_occluded', label: 'Fully occluded' },
  { id: 'outside_frame', label: 'Outside frame' },
  { id: 'reappeared', label: 'Reappeared' },
]

export function normalizeOcclusion(raw: unknown): OcclusionState {
  const v = String(raw ?? 'visible')
  if (OCCLUSION_STATES.some((s) => s.id === v)) return v as OcclusionState
  return 'visible'
}

export function occlusionStrokeDash(state: OcclusionState): string | undefined {
  switch (state) {
    case 'partially_occluded':
      return '6 4'
    case 'fully_occluded':
      return '2 4'
    case 'outside_frame':
      return '1 6'
    case 'reappeared':
      return '8 2 2 2'
    default:
      return undefined
  }
}

export function occlusionOpacity(state: OcclusionState): number {
  switch (state) {
    case 'fully_occluded':
      return 0.35
    case 'partially_occluded':
      return 0.65
    case 'outside_frame':
      return 0.25
    case 'reappeared':
      return 0.9
    default:
      return 1
  }
}
