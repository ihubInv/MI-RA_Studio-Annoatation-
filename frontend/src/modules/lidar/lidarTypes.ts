/** LiDAR annotation types — Phase 26. Lives in modules/lidar, consumed by video studio for RGB sync. */

export interface LidarPoint {
  x: number
  y: number
  z: number
  intensity?: number
}

export interface LidarCuboid {
  id: string
  object_id: string
  label: string
  color: string
  x: number
  y: number
  z: number
  l: number
  w: number
  h: number
  yaw: number
}

export interface LidarTrack {
  object_id: string
  cuboid_ids: string[]
}

export interface LidarFrame {
  frame: number
  points: LidarPoint[]
}

export interface LidarState {
  enabled: boolean
  showBev: boolean
  showCloud: boolean
  showCuboids: boolean
  rgbOffsetFrames: number
  selectedPointIndex: number | null
  segmentedIndices: number[]
  cuboids: LidarCuboid[]
  tracks: LidarTrack[]
  /** Cached sample cloud for current frame (synthetic or imported). */
  cloud: LidarPoint[]
}

export function emptyLidarState(): LidarState {
  return {
    enabled: false,
    showBev: true,
    showCloud: true,
    showCuboids: true,
    rgbOffsetFrames: 0,
    selectedPointIndex: null,
    segmentedIndices: [],
    cuboids: [],
    tracks: [],
    cloud: [],
  }
}

export function generateDemoCloud(n = 800, seed = 1): LidarPoint[] {
  const pts: LidarPoint[] = []
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  for (let i = 0; i < n; i++) {
    pts.push({
      x: (rand() - 0.5) * 40,
      y: (rand() - 0.3) * 8,
      z: rand() * 30 + 1,
      intensity: rand(),
    })
  }
  return pts
}

export function parseXyzCsv(text: string): LidarPoint[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const pts: LidarPoint[] = []
  for (const line of lines) {
    if (line.startsWith('#') || /[a-zA-Z]/.test(line.split(',')[0] ?? '')) continue
    const parts = line.split(/[,\s]+/).map(Number)
    if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) continue
    pts.push({ x: parts[0], y: parts[1], z: parts[2], intensity: parts[3] })
  }
  return pts
}

/** ASCII PCD (DATA ascii). Binary PCD is rejected. */
export function parsePcd(text: string): LidarPoint[] {
  const lines = text.split(/\r?\n/)
  let dataIdx = lines.findIndex((l) => l.toUpperCase().startsWith('DATA'))
  if (dataIdx < 0) return parseXyzCsv(text)
  const dataLine = lines[dataIdx].trim()
  if (!/ascii/i.test(dataLine)) {
    throw new Error('Only ASCII PCD is supported (convert binary PCD with pcl_convert or CloudCompare)')
  }
  const fieldsLine = lines.find((l) => l.toUpperCase().startsWith('FIELDS'))
  const fields = (fieldsLine?.slice(6).trim().split(/\s+/) ?? ['x', 'y', 'z']).map((f) => f.toLowerCase())
  const xi = fields.indexOf('x')
  const yi = fields.indexOf('y')
  const zi = fields.indexOf('z')
  const ii = fields.findIndex((f) => f === 'intensity' || f === 'i')
  const pts: LidarPoint[] = []
  for (const line of lines.slice(dataIdx + 1)) {
    if (!line.trim() || line.startsWith('#')) continue
    const parts = line.trim().split(/\s+/)
    const x = Number(parts[xi])
    const y = Number(parts[yi])
    const z = Number(parts[zi])
    if (![x, y, z].every(Number.isFinite)) continue
    pts.push({ x, y, z, intensity: ii >= 0 ? Number(parts[ii]) : undefined })
  }
  return pts
}

/** ASCII PLY. */
export function parsePly(text: string): LidarPoint[] {
  const lines = text.split(/\r?\n/)
  const headerEnd = lines.findIndex((l) => l.trim() === 'end_header')
  if (headerEnd < 0) return parseXyzCsv(text)
  const header = lines.slice(0, headerEnd)
  if (header.some((l) => /format\s+binary/i.test(l))) {
    throw new Error('Only ASCII PLY is supported')
  }
  const props: string[] = []
  for (const l of header) {
    const m = l.match(/^property\s+\w+\s+(\w+)/)
    if (m) props.push(m[1].toLowerCase())
  }
  const xi = props.indexOf('x')
  const yi = props.indexOf('y')
  const zi = props.indexOf('z')
  const ii = props.findIndex((f) => f === 'intensity' || f === 'scalar_intensity')
  const pts: LidarPoint[] = []
  for (const line of lines.slice(headerEnd + 1)) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\s+/)
    const x = Number(parts[xi < 0 ? 0 : xi])
    const y = Number(parts[yi < 0 ? 1 : yi])
    const z = Number(parts[zi < 0 ? 2 : zi])
    if (![x, y, z].every(Number.isFinite)) continue
    pts.push({ x, y, z, intensity: ii >= 0 ? Number(parts[ii]) : undefined })
  }
  return pts
}

export async function parseLidarFile(file: File): Promise<LidarPoint[]> {
  const name = file.name.toLowerCase()
  const text = await file.text()
  if (name.endsWith('.pcd')) return parsePcd(text)
  if (name.endsWith('.ply')) return parsePly(text)
  return parseXyzCsv(text)
}
