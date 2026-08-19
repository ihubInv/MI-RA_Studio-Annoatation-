import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Plus, Tags, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import {
  emptyAttribute,
  emptyLabel,
  moveLabel,
  type AttributeInputType,
  type LabelAttribute,
  type VideoLabel,
  type VideoLabelSchema,
} from '@/modules/video/schema/labelStore'
import { AttributeForm, AttributeTypeBadge } from '@/modules/video/panels/AttributeForm'
import { cn } from '@/utils/cn'

interface Props {
  schema: VideoLabelSchema
  onChange: (next: VideoLabelSchema) => void
  onClose: () => void
}

const ATTR_TYPES: { value: AttributeInputType; label: string }[] = [
  { value: 'boolean', label: 'Boolean' },
  { value: 'number', label: 'Number' },
  { value: 'text', label: 'Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-select' },
]

export function LabelManager({ schema, onChange, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(schema.labels[0]?.id ?? null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [preview, setPreview] = useState<Record<string, unknown>>({})
  const [renameError, setRenameError] = useState('')

  const selected = schema.labels.find((l) => l.id === selectedId) ?? null

  const setLabels = (labels: VideoLabel[]) => onChange({ ...schema, labels })

  const updateLabel = (id: string, patch: Partial<VideoLabel>) => {
    setLabels(schema.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const addLabel = () => {
    const label = emptyLabel()
    setLabels([...schema.labels, label])
    setSelectedId(label.id)
    setPreview({})
  }

  const deleteLabel = (id: string) => {
    const next = schema.labels.filter((l) => l.id !== id)
    setLabels(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  const rename = (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setRenameError('Name is required')
      return
    }
    const clash = schema.labels.some((l) => l.id !== id && l.name.toLowerCase() === trimmed.toLowerCase())
    if (clash) {
      setRenameError('A label with this name already exists')
      return
    }
    setRenameError('')
    updateLabel(id, { name: trimmed })
  }

  const updateAttr = (labelId: string, attrId: string, patch: Partial<LabelAttribute>) => {
    const label = schema.labels.find((l) => l.id === labelId)
    if (!label) return
    updateLabel(labelId, {
      attributes: label.attributes.map((a) => (a.id === attrId ? { ...a, ...patch } : a)),
    })
  }

  const addAttr = (labelId: string) => {
    const label = schema.labels.find((l) => l.id === labelId)
    if (!label) return
    updateLabel(labelId, { attributes: [...label.attributes, emptyAttribute()] })
  }

  const removeAttr = (labelId: string, attrId: string) => {
    const label = schema.labels.find((l) => l.id === labelId)
    if (!label) return
    updateLabel(labelId, { attributes: label.attributes.filter((a) => a.id !== attrId) })
  }

  return (
    <Modal title="Label Manager" subtitle="Add, edit, reorder labels and define attributes." onClose={onClose} wide>
      <div className="grid grid-cols-[220px_1fr] gap-0 border border-border rounded-md overflow-hidden min-h-[420px] max-h-[70vh]">
        <div className="border-r border-border bg-muted/20 flex flex-col min-h-0">
          <div className="px-2 py-2 border-b border-border flex items-center justify-between">
            <p className="text-2xs font-semibold text-muted-foreground">Labels</p>
            <button type="button" onClick={addLabel} className="mira-btn-ghost h-7 px-2 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {schema.labels.map((label, index) => (
              <div
                key={label.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex == null) return
                  setLabels(moveLabel(schema.labels, dragIndex, index))
                  setDragIndex(null)
                }}
                onClick={() => {
                  setSelectedId(label.id)
                  setPreview({})
                  setRenameError('')
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-2 cursor-pointer border-b border-border/50',
                  selectedId === label.id ? 'bg-white' : 'hover:bg-white/60',
                  !label.enabled && 'opacity-50',
                )}
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: label.color }} />
                <span className="text-xs truncate flex-1">{label.name}</span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLabels(moveLabel(schema.labels, index, index - 1))
                    }}
                    title="Move up"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    disabled={index === schema.labels.length - 1}
                    onClick={(e) => {
                      e.stopPropagation()
                      setLabels(moveLabel(schema.labels, index, index + 1))
                    }}
                    title="Move down"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {!schema.labels.length && (
              <p className="text-2xs text-muted-foreground p-3">No labels yet. Add one to start.</p>
            )}
          </div>
        </div>

        <div className="overflow-auto p-4 bg-white">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Tags className="w-8 h-8 mb-2" />
              <p className="text-sm">Select or add a label</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-2xs font-medium block mb-1">Name</label>
                    <input
                      value={selected.name}
                      onChange={(e) => {
                        setRenameError('')
                        updateLabel(selected.id, { name: e.target.value })
                      }}
                      onBlur={(e) => rename(selected.id, e.target.value)}
                      className="mira-input h-8"
                    />
                    {renameError && <p className="text-2xs text-destructive mt-1">{renameError}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-2xs font-medium block mb-1">Color</label>
                      <input
                        type="color"
                        value={selected.color}
                        onChange={(e) => updateLabel(selected.id, { color: e.target.value })}
                        className="h-8 w-full border border-border rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-2xs font-medium block mb-1">Hotkey</label>
                      <input
                        value={selected.hotkey ?? ''}
                        maxLength={1}
                        onChange={(e) => updateLabel(selected.id, { hotkey: e.target.value })}
                        className="mira-input h-8"
                        placeholder="1"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selected.enabled}
                          onChange={(e) => updateLabel(selected.id, { enabled: e.target.checked })}
                        />
                        Enabled
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-2xs font-medium block mb-1">Description</label>
                    <input
                      value={selected.description ?? ''}
                      onChange={(e) => updateLabel(selected.id, { description: e.target.value })}
                      className="mira-input h-8"
                      placeholder="Optional notes"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mira-btn-ghost h-8 text-xs text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete label “${selected.name}”?`)) deleteLabel(selected.id)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold">Attributes</p>
                  <button type="button" className="mira-btn-ghost h-7 text-xs" onClick={() => addAttr(selected.id)}>
                    <Plus className="w-3 h-3" /> Add attribute
                  </button>
                </div>
                <div className="space-y-2">
                  {selected.attributes.map((attr) => (
                    <div key={attr.id} className="border border-border rounded-md p-2 space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          value={attr.name}
                          onChange={(e) => updateAttr(selected.id, attr.id, { name: e.target.value })}
                          className="mira-input h-7 w-36"
                          placeholder="Attribute name"
                        />
                        <select
                          value={attr.input_type}
                          onChange={(e) =>
                            updateAttr(selected.id, attr.id, {
                              input_type: e.target.value as AttributeInputType,
                            })
                          }
                          className="mira-input h-7 w-32"
                        >
                          {ATTR_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <label className="inline-flex items-center gap-1 text-2xs">
                          <input
                            type="checkbox"
                            checked={Boolean(attr.required)}
                            onChange={(e) => updateAttr(selected.id, attr.id, { required: e.target.checked })}
                          />
                          Required
                        </label>
                        <AttributeTypeBadge type={attr.input_type} />
                        <button
                          type="button"
                          className="ml-auto text-muted-foreground hover:text-destructive"
                          onClick={() => removeAttr(selected.id, attr.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {(attr.input_type === 'select' || attr.input_type === 'multiselect') && (
                        <input
                          value={(attr.values || []).join(', ')}
                          onChange={(e) =>
                            updateAttr(selected.id, attr.id, {
                              values: e.target.value
                                .split(',')
                                .map((v) => v.trim())
                                .filter(Boolean),
                            })
                          }
                          className="mira-input h-7 w-full"
                          placeholder="Options, comma separated — e.g. White, Black, Red"
                        />
                      )}
                    </div>
                  ))}
                  {!selected.attributes.length && (
                    <p className="text-2xs text-muted-foreground">No attributes. Add Boolean, Number, Text, Dropdown, or Multi-select.</p>
                  )}
                </div>
              </div>

              {selected.attributes.length > 0 && (
                <div className="border border-border rounded-md p-3 bg-muted/20">
                  <p className="text-xs font-semibold mb-2">{selected.name}</p>
                  <AttributeForm attributes={selected.attributes} values={preview} onChange={setPreview} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end pt-3">
        <button type="button" onClick={onClose} className="mira-btn-primary h-8 text-xs">
          Done
        </button>
      </div>
    </Modal>
  )
}
