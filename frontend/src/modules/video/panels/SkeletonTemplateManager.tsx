import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { SkeletonTemplate, SkeletonTemplateSchema } from '@/modules/video/schema/skeletonTemplateStore'
import { SkeletonBuilder } from '@/modules/video/panels/SkeletonBuilder'

interface Props {
  schema: SkeletonTemplateSchema
  onChange: (schema: SkeletonTemplateSchema) => void
  onClose: () => void
}

function newJointId(name: string, existing: string[]) {
  let base = name.toLowerCase().replace(/\s+/g, '_') || 'joint'
  let id = base
  let n = 1
  while (existing.includes(id)) {
    id = `${base}_${n++}`
  }
  return id
}

export function SkeletonTemplateManager({ schema, onChange, onClose }: Props) {
  const [editId, setEditId] = useState(schema.activeTemplateId)
  const template = schema.templates.find((t) => t.id === editId) ?? schema.templates[0]

  const updateTemplate = (patch: Partial<SkeletonTemplate>) => {
    onChange({
      ...schema,
      templates: schema.templates.map((t) => (t.id === template.id ? { ...t, ...patch } : t)),
    })
  }

  const addTemplate = () => {
    const id = `custom-${Date.now()}`
    const next: SkeletonTemplate = {
      id,
      name: 'Custom template',
      joints: [{ id: 'joint_1', name: 'joint_1', layout_x: 0, layout_y: 0 }],
      edges: [],
    }
    onChange({
      ...schema,
      templates: [...schema.templates, next],
      activeTemplateId: id,
    })
    setEditId(id)
  }

  const deleteTemplate = (id: string) => {
    if (schema.templates.length <= 1) return
    const next = schema.templates.filter((t) => t.id !== id)
    const activeTemplateId = schema.activeTemplateId === id ? next[0].id : schema.activeTemplateId
    onChange({ ...schema, templates: next, activeTemplateId })
    setEditId(activeTemplateId)
  }

  const setActive = (id: string) => {
    onChange({ ...schema, activeTemplateId: id })
  }

  const addJoint = () => {
    const ids = template.joints.map((j) => j.id)
    const name = `joint_${ids.length + 1}`
    const id = newJointId(name, ids)
    updateTemplate({
      joints: [...template.joints, { id, name, layout_x: 0, layout_y: ids.length * 0.1 }],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Skeleton templates</h2>
            <p className="text-2xs text-muted-foreground">Customize keypoint layouts and bone connections</p>
          </div>
          <button type="button" onClick={onClose} className="mira-btn-ghost h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <aside className="w-44 shrink-0 border-r border-border p-2 space-y-1 overflow-auto">
            {schema.templates.map((t) => (
              <div key={t.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`flex-1 text-left text-xs px-2 py-1.5 rounded truncate ${
                    editId === t.id ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => setEditId(t.id)}
                >
                  {t.name}
                </button>
                {schema.templates.length > 1 && !t.id.startsWith('coco') && (
                  <button
                    type="button"
                    className="mira-btn-ghost h-6 w-6 p-0 text-destructive"
                    onClick={() => deleteTemplate(t.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTemplate} className="mira-btn-ghost h-8 text-xs w-full mt-2">
              <Plus className="w-3.5 h-3.5 mr-1" /> New template
            </button>
          </aside>
          <div className="flex-1 p-4 overflow-auto space-y-4">
            <label className="block space-y-0.5">
              <span className="text-2xs text-muted-foreground uppercase">Name</span>
              <input
                className="mira-input h-8 w-full text-xs"
                value={template.name}
                onChange={(e) => updateTemplate({ name: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="activeTemplate"
                checked={schema.activeTemplateId === template.id}
                onChange={() => setActive(template.id)}
              />
              Active template for annotation
            </label>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xs text-muted-foreground uppercase">Joints</p>
                <button type="button" onClick={addJoint} className="mira-btn-ghost h-7 text-2xs">
                  <Plus className="w-3 h-3 mr-1" /> Add joint
                </button>
              </div>
              <div className="space-y-2">
                {template.joints.map((j, idx) => (
                  <div key={j.id} className="grid grid-cols-[1fr_1fr_80px_80px_32px] gap-2 items-center">
                    <input
                      className="mira-input h-7 text-xs"
                      value={j.name}
                      onChange={(e) => {
                        const joints = template.joints.map((x, i) =>
                          i === idx ? { ...x, name: e.target.value } : x,
                        )
                        updateTemplate({ joints })
                      }}
                    />
                    <span className="text-2xs font-mono text-muted-foreground truncate">{j.id}</span>
                    <input
                      type="number"
                      step={0.05}
                      className="mira-input h-7 text-2xs font-mono"
                      title="layout_x"
                      value={j.layout_x ?? 0}
                      onChange={(e) => {
                        const joints = template.joints.map((x, i) =>
                          i === idx ? { ...x, layout_x: Number(e.target.value) } : x,
                        )
                        updateTemplate({ joints })
                      }}
                    />
                    <input
                      type="number"
                      step={0.05}
                      className="mira-input h-7 text-2xs font-mono"
                      title="layout_y"
                      value={j.layout_y ?? 0}
                      onChange={(e) => {
                        const joints = template.joints.map((x, i) =>
                          i === idx ? { ...x, layout_y: Number(e.target.value) } : x,
                        )
                        updateTemplate({ joints })
                      }}
                    />
                    <button
                      type="button"
                      className="mira-btn-ghost h-7 w-7 p-0 text-destructive disabled:opacity-30"
                      disabled={template.joints.length <= 1}
                      onClick={() => {
                        const joints = template.joints.filter((_, i) => i !== idx)
                        const edges = template.edges.filter(([a, b]) => a !== j.id && b !== j.id)
                        updateTemplate({ joints, edges })
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <SkeletonBuilder template={template} onChange={(edges) => updateTemplate({ edges })} />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button type="button" onClick={onClose} className="mira-btn-primary h-8 text-xs px-4">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
