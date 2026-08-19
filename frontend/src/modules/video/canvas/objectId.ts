/** Phase 9 — human-readable object IDs: Person_001, Car_002, … */

/** Sanitize a label into an ID prefix (letters, digits, underscore). */
export function labelToIdPrefix(label: string): string {
  const cleaned = label
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return cleaned || 'Object'
}

const ID_RE = /^(.+)_(\d+)$/

export function parseObjectId(objectId: string): { prefix: string; num: number } | null {
  const m = objectId.match(ID_RE)
  if (!m) return null
  return { prefix: m[1], num: Number(m[2]) }
}

/** Next free ID for a label among existing object_id values, e.g. Person_003. */
export function nextLabeledObjectId(label: string, existingIds: Iterable<string>): string {
  const prefix = labelToIdPrefix(label)
  let max = 0
  for (const id of existingIds) {
    const parsed = parseObjectId(id)
    if (parsed && parsed.prefix.toLowerCase() === prefix.toLowerCase()) {
      max = Math.max(max, parsed.num)
    }
  }
  return `${prefix}_${String(max + 1).padStart(3, '0')}`
}

export function formatObjectId(prefix: string, num: number): string {
  return `${labelToIdPrefix(prefix)}_${String(num).padStart(3, '0')}`
}
