/** Phase 36 — cheap rendering/memory helpers (after functionality). */

export function downsample<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  const step = items.length / max
  const out: T[] = []
  for (let i = 0; i < max; i++) out.push(items[Math.floor(i * step)])
  return out
}

export function shouldSeekInsteadOfDecode(deltaFrames: number) {
  return Math.abs(deltaFrames) > 2
}
