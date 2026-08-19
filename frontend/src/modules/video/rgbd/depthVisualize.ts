/** Map a grayscale depth sample (0–255 or 0–1) to RGB colormap. */

export type DepthColormap = 'turbo' | 'viridis' | 'gray'

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t))
}

function lerpC(a: number[], b: number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

const TURBO = [
  [48, 18, 59],
  [70, 107, 227],
  [40, 188, 214],
  [124, 217, 87],
  [239, 176, 33],
  [204, 70, 12],
]

const VIRIDIS = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
]

export function colormapRgb(t: number, map: DepthColormap): [number, number, number] {
  const x = clamp01(t)
  if (map === 'gray') {
    const g = Math.round(x * 255)
    return [g, g, g]
  }
  const stops = map === 'viridis' ? VIRIDIS : TURBO
  const scaled = x * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(scaled))
  const f = scaled - i
  const c = lerpC(stops[i], stops[i + 1], f)
  return [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]
}

/** Colorize an ImageData in place using luminance as depth. */
export function colorizeDepthImageData(data: ImageData, map: DepthColormap, opacity: number) {
  const a = Math.round(clamp01(opacity) * 255)
  for (let i = 0; i < data.data.length; i += 4) {
    const y = (0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]) / 255
    const [r, g, b] = colormapRgb(1 - y, map)
    data.data[i] = r
    data.data[i + 1] = g
    data.data[i + 2] = b
    data.data[i + 3] = a
  }
}

export function depthFromLuminance(r: number, g: number, b: number, near: number, far: number) {
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return near + (1 - y) * (far - near)
}
