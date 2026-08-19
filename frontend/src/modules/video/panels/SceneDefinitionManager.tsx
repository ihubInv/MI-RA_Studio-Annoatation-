import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  emptySceneDefinition,
  type SceneDefinition,
  type SceneDefKind,
  type VideoSceneSchema,
} from '@/modules/video/schema/sceneStore'
import { cn } from '@/utils/cn'

interface Props {
  schema: VideoSceneSchema
  onChange: (schema: VideoSceneSchema) => void
  onClose: () => void
}

export function SceneDefinitionManager({ schema, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(schema.scenes[0]?.id ?? null)
  const selected = schema.scenes.find((s) => s.id === selectedId) ?? null

  const update = (id: string, patch: Partial<SceneDefinition>) => {
    onChange({ ...schema, scenes: schema.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) })
  }

  const add = (kind: SceneDefKind) => {
    const def = emptySceneDefinition(kind)
    onChange({ ...schema, scenes: [...schema.scenes, def] })
    setSelectedId(def.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg border shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 className="text-sm font-semibold">Scene types & markers</h2>
          <button type="button" className="text-xs text-muted-foreground" onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-40 border-r overflow-y-auto p-2 space-y-1">
            {schema.scenes.map((s) => (
              <button
                key={s.id}
                type="button"
                className={cn(
                  'w-full text-left px-2 py-1 rounded text-xs truncate',
                  selectedId === s.id ? 'bg-accent' : 'hover:bg-accent/50',
                )}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: s.color }} />
                {s.name}
              </button>
            ))}
            <div className="pt-2 space-y-1 border-t">
              <button type="button" className="w-full mira-btn-ghost h-7 text-2xs" onClick={() => add('scene')}>
                <Plus className="w-3 h-3 inline" /> Scene type
              </button>
            </div>
          </div>
          {selected && (
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              <label className="block text-xs">
                Name
                <input
                  className="mira-input h-8 text-sm mt-1 w-full"
                  value={selected.name}
                  onChange={(e) => update(selected.id, { name: e.target.value })}
                />
              </label>
              <label className="block text-xs">
                Color
                <input
                  type="color"
                  className="mt-1 h-8 w-full"
                  value={selected.color}
                  onChange={(e) => update(selected.id, { color: e.target.value })}
                />
              </label>
              <p className="text-2xs text-muted-foreground capitalize">Kind: {selected.kind.replace('_', ' ')}</p>
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
                className="mira-btn-ghost h-8 text-xs text-destructive"
                onClick={() => {
                  onChange({ ...schema, scenes: schema.scenes.filter((s) => s.id !== selected.id) })
                  setSelectedId(schema.scenes.find((s) => s.id !== selected.id)?.id ?? null)
                }}
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
