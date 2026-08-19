import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  emptyActionDefinition,
  type ActionDefinition,
  type VideoActionSchema,
} from '@/modules/video/schema/actionStore'
import { cn } from '@/utils/cn'

interface Props {
  schema: VideoActionSchema
  onChange: (schema: VideoActionSchema) => void
  onClose: () => void
}

export function ActionDefinitionManager({ schema, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(schema.actions[0]?.id ?? null)
  const selected = schema.actions.find((a) => a.id === selectedId) ?? null

  const update = (id: string, patch: Partial<ActionDefinition>) => {
    onChange({ ...schema, actions: schema.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg border shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 className="text-sm font-semibold">Action classes</h2>
          <button type="button" className="text-xs text-muted-foreground" onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-1 min-h-0">
          <ul className="w-44 border-r overflow-y-auto p-2 space-y-0.5">
            {schema.actions.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={cn('w-full text-left px-2 py-1.5 rounded text-xs truncate flex gap-1.5 items-center', selectedId === a.id && 'bg-accent')}
                  onClick={() => setSelectedId(a.id)}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                  {a.name}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="text-2xs text-primary flex items-center gap-1 px-2 py-1"
                onClick={() => {
                  const def = emptyActionDefinition()
                  onChange({ ...schema, actions: [...schema.actions, def] })
                  setSelectedId(def.id)
                }}
              >
                <Plus className="w-3 h-3" /> Add custom
              </button>
            </li>
          </ul>
          {selected && (
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <label className="block text-2xs text-muted-foreground">Name
                <input className="mira-input h-8 text-xs mt-1 w-full" value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} />
              </label>
              <label className="block text-2xs text-muted-foreground">Color
                <input type="color" className="mt-1 h-8 w-full" value={selected.color} onChange={(e) => update(selected.id, { color: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={selected.enabled} onChange={(e) => update(selected.id, { enabled: e.target.checked })} />
                Enabled
              </label>
              <button type="button" className="text-xs text-destructive flex items-center gap-1" onClick={() => {
                onChange({ ...schema, actions: schema.actions.filter((a) => a.id !== selected.id) })
                setSelectedId(null)
              }}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
