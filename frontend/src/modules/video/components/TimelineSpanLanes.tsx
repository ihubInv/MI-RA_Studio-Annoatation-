/** Reusable timeline span lanes (events, actions, relations). */
import { cn } from '@/utils/cn'

export interface SpanLaneItem {
  id: string
  frame: number
  end_frame?: number
  color: string
  title: string
  subtitle?: string
}

export interface SpanLaneRow {
  id: string
  label: string
  color: string
  items: SpanLaneItem[]
}

interface Viewport {
  xAtFrame: (f: number) => number
}

interface Props {
  rows: SpanLaneRow[]
  viewport: Viewport
  labelWidth: number
  sectionClass: string
  selectedId?: string | null
  disabled?: boolean
  draft?: { rowId: string; startFrame: number; endFrame?: number } | null
  onSelect?: (id: string) => void
  onDragCreate?: (rowId: string, start: number, end: number) => void
}

export function TimelineSpanLanes({
  rows,
  viewport,
  labelWidth,
  sectionClass,
  selectedId,
  disabled,
  draft,
  onSelect,
  onDragCreate,
}: Props) {
  if (!rows.length) return null

  return (
    <div className={cn('relative border-t-2 border-border/80', sectionClass)}>
      {rows.map((row) => (
        <div
          key={row.id}
          className="relative h-8 border-b border-border/40"
          onPointerDown={(e) => {
            if (disabled || !onDragCreate) return
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            const x = e.clientX - rect.left - labelWidth
            const frame = Math.max(0, Math.round(x / (viewport.xAtFrame(1) - viewport.xAtFrame(0))))
            const start = frame
            const dragState = { end: start }
            const onMove = (ev: PointerEvent) => {
              const fx = ev.clientX - rect.left - labelWidth
              dragState.end = Math.max(0, Math.round(fx / (viewport.xAtFrame(1) - viewport.xAtFrame(0))))
            }
            const onUp = () => {
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
              if (Math.abs(dragState.end - start) >= 1) onDragCreate(row.id, start, dragState.end)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
        >
          <span
            className="sticky left-0 z-20 h-full pl-1.5 pr-1 text-2xs truncate bg-white/95 border-r border-border/40 flex items-center pointer-events-none"
            style={{ width: labelWidth, color: row.color }}
            title={row.label}
          >
            {row.label}
          </span>
          {draft?.rowId === row.id && draft.endFrame != null && (
            <div
              className="absolute top-1/2 h-2 -translate-y-1/2 rounded-sm border border-dashed opacity-60 pointer-events-none"
              style={{
                left: viewport.xAtFrame(Math.min(draft.startFrame, draft.endFrame)),
                width: Math.max(
                  4,
                  Math.abs(viewport.xAtFrame(draft.endFrame) - viewport.xAtFrame(draft.startFrame)),
                ),
                borderColor: row.color,
                background: `${row.color}33`,
              }}
            />
          )}
          {row.items.map((item) => {
            const end = item.end_frame ?? item.frame
            const isInstant = end === item.frame
            if (isInstant) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-2 z-10',
                    selectedId === item.id && 'scale-125 ring-2 ring-offset-1',
                  )}
                  style={{ left: viewport.xAtFrame(item.frame), background: item.color, borderColor: item.color }}
                  title={item.title}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect?.(item.id)
                  }}
                />
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'absolute top-1/2 h-3 -translate-y-1/2 rounded-sm z-10 hover:brightness-110 text-left overflow-hidden',
                  selectedId === item.id && 'ring-2 ring-offset-1',
                )}
                style={{
                  left: viewport.xAtFrame(item.frame),
                  width: Math.max(4, viewport.xAtFrame(end) - viewport.xAtFrame(item.frame)),
                  background: item.color,
                  opacity: 0.8,
                }}
                title={item.title}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.(item.id)
                }}
              >
                {item.subtitle && (
                  <span className="block text-[8px] text-white px-0.5 truncate leading-3">{item.subtitle}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
