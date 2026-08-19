import { useMemo, useState } from 'react'
import { Eye, EyeOff, Lock, LockOpen, Search } from 'lucide-react'
import type { ObjectManagerEntry } from '@/modules/video/hooks/useVideoAnnotations'
import { cn } from '@/utils/cn'

interface Props {
  entries: ObjectManagerEntry[]
  selectedObjectId: string | null
  onSelect: (objectId: string) => void
  onToggleVisible: (objectId: string) => void
  onToggleLocked: (objectId: string) => void
}

export function ObjectManager({
  entries,
  selectedObjectId,
  onSelect,
  onToggleVisible,
  onToggleLocked,
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (e) =>
        e.object_id.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q),
    )
  }, [entries, query])

  return (
    <section className="border-b border-border flex flex-col shrink-0">
      <div className="px-3 py-2 border-b border-border/60">
        <p className="mira-section-label">Objects</p>
      </div>
      <div className="px-2 py-1.5 border-b border-border/40">
        <label className="relative block">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: Person_001"
            className="mira-input h-8 w-full pl-7 text-xs font-mono"
            aria-label="Search objects"
          />
        </label>
      </div>
      <div className="overflow-auto p-1.5 space-y-0.5 max-h-36">
        {filtered.map((entry) => {
          const selected = entry.object_id === selectedObjectId
          return (
            <div
              key={entry.object_id}
              className={cn(
                'group flex items-center gap-1 rounded-md px-1.5 py-1',
                selected ? 'bg-primary/10' : 'hover:bg-muted/50',
                !entry.visible && 'opacity-50',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(entry.object_id)}
                className="flex-1 min-w-0 flex items-center gap-2 text-left"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
                <span className={cn('truncate text-xs font-mono', selected && 'text-primary font-semibold')}>
                  {entry.object_id}
                </span>
              </button>
              <button
                type="button"
                title={entry.visible ? 'Hide' : 'Show'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleVisible(entry.object_id)
                }}
                className="mira-btn-ghost h-7 w-7 p-0 text-muted-foreground"
              >
                {entry.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                title={entry.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLocked(entry.object_id)
                }}
                className="mira-btn-ghost h-7 w-7 p-0 text-muted-foreground"
              >
                {entry.locked ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
              </button>
            </div>
          )
        })}
        {!filtered.length && (
          <p className="text-2xs text-muted-foreground px-2 py-3">
            {entries.length ? 'No matches.' : 'No objects yet. Draw a box to create one.'}
          </p>
        )}
      </div>
    </section>
  )
}
