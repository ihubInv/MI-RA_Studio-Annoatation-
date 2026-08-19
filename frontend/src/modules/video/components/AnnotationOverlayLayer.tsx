/** SVG annotation overlay — shapes render above video, below interaction layer. */
interface Props {
  width: number
  height: number
  /** Future: per-frame annotation shapes */
  shapes?: unknown[]
}

export function AnnotationOverlayLayer({ width, height }: Props) {
  if (!width || !height) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-10"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      {/* Phase 5+ per-frame shapes render here */}
    </svg>
  )
}
