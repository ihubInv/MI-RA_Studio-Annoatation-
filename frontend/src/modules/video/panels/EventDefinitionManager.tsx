import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  emptyEventDefinition,
  type EventDefinition,
  type VideoEventSchema,
} from '@/modules/video/schema/eventStore'
import { cn } from '@/utils/cn'

interface Props {
  schema: VideoEventSchema
  onChange: (schema: VideoEventSchema) => void
  onClose: () => void
}

export function EventDefinitionManager({ schema, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(schema.events[0]?.id ?? null)
  const selected = schema.events.find((e) => e.id === selectedId) ?? null

  const update = (id: string, patch: Partial<EventDefinition>) => {
    onChange({
      ...schema,
      events: schema.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })
  }

  const add = () => {
    const def = emptyEventDefinition()
    onChange({ ...schema, events: [...schema.events, def] })
    setSelectedId(def.id)
  }

  const remove = (id: string) => {
    onChange({ ...schema, events: schema.events.filter((e) => e.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg border border-border shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Event definitions</h2>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <ul className="w-40 border-r border-border overflow-y-auto p-2 space-y-0.5">
            {schema.events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded text-xs truncate flex items-center gap-1.5',
                    selectedId === e.id ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                  onClick={() => setSelectedId(e.id)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color }} />
                  {e.name}
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="w-full text-left px-2 py-1 text-2xs text-primary flex items-center gap-1" onClick={add}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </li>
          </ul>
          {selected && (
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <label className="block text-2xs text-muted-foreground">
                Name
                <input
                  className="mira-input h-8 text-xs mt-1 w-full"
                  value={selected.name}
                  onChange={(e) => update(selected.id, { name: e.target.value })}
                />
              </label>
              <label className="block text-2xs text-muted-foreground">
                Color
                <input
                  type="color"
                  className="mt-1 h-8 w-full"
                  value={selected.color}
                  onChange={(e) => update(selected.id, { color: e.target.value })}
                />
              </label>
              <label className="block text-2xs text-muted-foreground">
                Kind
                <select
                  className="mira-input h-8 text-xs mt-1 w-full"
                  value={selected.kind}
                  onChange={(e) => update(selected.id, { kind: e.target.value as EventDefinition['kind'] })}
                >
                  <option value="instant">Instant only</option>
                  <option value="interval">Interval only</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.enabled}
                  onChange={(e) => update(selected.id, { enabled: e.target.checked })}
                />
                Enabled
              </label>
              <button
                type="button"
                className="mira-btn-ghost text-xs text-destructive flex items-center gap-1"
                onClick={() => remove(selected.id)}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
