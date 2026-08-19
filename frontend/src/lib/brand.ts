/** MI-RA Studio brand tokens — CSS vars + Konva + logo paths */
export const BRAND = {
  name: 'MIRA',
  product: 'MI-RA Studio',
  tagline: 'A symphony of senses in the digital realm',
  logo: '/brand/mira-logo.png',
  favicon: '/favicon.png',
  blue: '#0d559e',
  orange: '#fc6900',
  canvas: '#ffffff',
  text: '#000000',
  border: '#e5e7eb',
  surface: '#f4f7fb',
  surfaceAlt: '#eef3f9',
  muted: '#6b7280',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
} as const

export const ANNOTATION = {
  normal: BRAND.blue,
  selected: BRAND.orange,
  hover: 'rgba(13, 85, 158, 0.15)',
  fill: 'rgba(13, 85, 158, 0.08)',
  selectedFill: 'rgba(252, 105, 0, 0.1)',
  ai: BRAND.orange,
  locked: '#9ca3af',
} as const
