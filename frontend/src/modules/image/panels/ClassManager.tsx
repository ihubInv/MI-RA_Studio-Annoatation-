import { Fragment, useRef, useState } from 'react'
import { Plus, Trash2, Upload } from 'lucide-react'
import { exportSchema, importSchema, type LabelAttribute, type LabelClass, type LabelSchema } from '../schema/labelStore'
import { cn } from '@/utils/cn'

interface Props {
  schema: LabelSchema
  onChange: (next: LabelSchema) => void
  onClose: () => void
}

export function ClassManager({ schema, onChange, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [openAttrs, setOpenAttrs] = useState<string | null>(null)

  const updateClass = (id: string, patch: Partial<LabelClass>) => {
    onChange({
      ...schema,
      classes: schema.classes.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })
  }

  const addClass = () => {
    const name = prompt('Class name')?.trim()
    if (!name) return
    const cls: LabelClass = {
      id: crypto.randomUUID(),
      name,
      color: '#0d559e',
      category: 'Custom',
      enabled: true,
      attributes: [],
    }
    onChange({ ...schema, classes: [...schema.classes, cls] })
  }

  const download = (format: 'json' | 'yaml' | 'csv') => {
    const blob = new Blob([exportSchema(schema, format)], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mira-labels.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white border border-border rounded-md shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col fade-enter">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Label / Class Manager</p>
            <p className="text-2xs text-muted-foreground">Project-specific schema · import/export JSON, YAML, CSV</p>
          </div>
          <button onClick={onClose} className="mira-btn-ghost h-7 text-xs">
            Done
          </button>
        </div>
        <div className="px-4 py-2 border-b border-border flex flex-wrap gap-2">
          <button onClick={addClass} className="mira-btn-primary h-7 text-xs">
            <Plus className="w-3.5 h-3.5" /> Add Class
          </button>
          <button onClick={() => download('json')} className="mira-btn-ghost h-7 text-xs">
            Export JSON
          </button>
          <button onClick={() => download('yaml')} className="mira-btn-ghost h-7 text-xs">
            Export YAML
          </button>
          <button onClick={() => download('csv')} className="mira-btn-ghost h-7 text-xs">
            Export CSV
          </button>
          <button onClick={() => fileRef.current?.click()} className="mira-btn-ghost h-7 text-xs">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.yaml,.yml,.csv,.txt"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                onChange(importSchema(schema.projectKey, await file.text()))
              } catch {
                alert('Could not parse schema file')
              }
              e.target.value = ''
            }}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Color</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Hotkey</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Attrs</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {schema.classes.map((cls) => (
                <Fragment key={cls.id}>
                <tr className={cn('border-t border-border', !cls.enabled && 'opacity-50')}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={cls.enabled}
                      onChange={(e) => updateClass(cls.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="color"
                      value={cls.color}
                      onChange={(e) => updateClass(cls.id, { color: e.target.value })}
                      className="w-7 h-6 border border-border rounded"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={cls.name}
                      onChange={(e) => updateClass(cls.id, { name: e.target.value })}
                      className="mira-input h-7"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={cls.category}
                      onChange={(e) => updateClass(cls.id, { category: e.target.value })}
                      className="mira-input h-7"
                    />
                  </td>
                  <td className="px-3 py-1.5 w-16">
                    <input
                      value={cls.hotkey ?? ''}
                      onChange={(e) => updateClass(cls.id, { hotkey: e.target.value })}
                      className="mira-input h-7"
                    />
                  </td>
                  <td className="px-3 py-1.5 w-28">
                    <select
                      value={cls.annotation_type ?? 'bbox'}
                      onChange={(e) => updateClass(cls.id, { annotation_type: e.target.value })}
                      className="mira-input h-7"
                    >
                      {['bbox', 'polygon', 'polyline', 'point', 'keypoint', 'mask', 'circle'].map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => setOpenAttrs(openAttrs === cls.id ? null : cls.id)}
                      className="text-2xs text-primary"
                    >
                      {cls.attributes.length} attr
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() =>
                        onChange({ ...schema, classes: schema.classes.filter((c) => c.id !== cls.id) })
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
                {openAttrs === cls.id && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-3 py-2 space-y-2">
                      {cls.attributes.map((attr, i) => (
                        <div key={`${cls.id}-${attr.name}-${i}`} className="flex flex-wrap gap-2 items-center">
                          <input
                            value={attr.name}
                            onChange={(e) => {
                              const attributes = cls.attributes.map((a, j) =>
                                j === i ? { ...a, name: e.target.value } : a,
                              )
                              updateClass(cls.id, { attributes })
                            }}
                            className="mira-input h-7 w-32"
                            placeholder="Name"
                          />
                          <select
                            value={attr.input_type}
                            onChange={(e) => {
                              const attributes = cls.attributes.map((a, j) =>
                                j === i ? { ...a, input_type: e.target.value as LabelAttribute['input_type'] } : a,
                              )
                              updateClass(cls.id, { attributes })
                            }}
                            className="mira-input h-7 w-28"
                          >
                            {['boolean', 'text', 'number', 'select', 'multiselect'].map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          {(attr.input_type === 'select' || attr.input_type === 'multiselect') && (
                            <input
                              value={(attr.values || []).join(', ')}
                              onChange={(e) => {
                                const attributes = cls.attributes.map((a, j) =>
                                  j === i
                                    ? { ...a, values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) }
                                    : a,
                                )
                                updateClass(cls.id, { attributes })
                              }}
                              className="mira-input h-7 flex-1 min-w-[140px]"
                              placeholder="Options, comma separated"
                            />
                          )}
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              updateClass(cls.id, { attributes: cls.attributes.filter((_, j) => j !== i) })
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="mira-btn-ghost h-7 text-xs"
                        onClick={() =>
                          updateClass(cls.id, {
                            attributes: [...cls.attributes, { name: 'New', input_type: 'text' }],
                          })
                        }
                      >
                        <Plus className="w-3 h-3" /> Add attribute
                      </button>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
