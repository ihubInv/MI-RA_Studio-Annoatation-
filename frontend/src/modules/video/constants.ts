/** Video ingest constants — Phase 1 upload & validation. */
export const VIDEO_EXTENSIONS = [
  '.mp4',
  '.avi',
  '.mov',
  '.mkv',
  '.webm',
  '.mpeg',
  '.mpg',
  '.m4v',
  '.wmv',
  '.flv',
  '.ts',
  '.mts',
  '.m2ts',
  '.3gp',
] as const

const VIDEO_EXT_RE = /\.(mp4|avi|mov|mkv|webm|mpeg|mpg|m4v|wmv|flv|ts|mts|m2ts|3gp)$/i

export const VIDEO_ACCEPT: Record<string, string[]> = {
  'video/mp4': ['.mp4', '.m4v'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
  'video/webm': ['.webm'],
  'video/mpeg': ['.mpeg', '.mpg'],
  'video/x-ms-wmv': ['.wmv'],
  'video/x-flv': ['.flv'],
  'video/mp2t': ['.ts', '.mts', '.m2ts'],
  'video/3gpp': ['.3gp'],
  'application/zip': ['.zip'],
}

export function isVideoPath(name: string) {
  return VIDEO_EXT_RE.test(name)
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}
