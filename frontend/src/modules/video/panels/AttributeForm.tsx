import type { LabelAttribute } from '@/modules/video/schema/labelStore'
import { cn } from '@/utils/cn'

export type AttributeValues = Record<string, unknown>

interface Props {
  attributes: LabelAttribute[]
  values: AttributeValues
  onChange: (next: AttributeValues) => void
  disabled?: boolean
}

export function AttributeForm({ attributes, values, onChange, disabled }: Props) {
  if (!attributes.length) {
    return <p className="text-2xs text-muted-foreground">No attributes on this label.</p>
  }

  const set = (id: string, value: unknown) => onChange({ ...values, [id]: value })

  return (
    <div className="space-y-3">
      {attributes.map((attr) => (
        <div key={attr.id}>
          <p className="text-xs font-medium mb-1.5">
            {attr.name}
            {attr.required ? <span className="text-destructive"> *</span> : null}
          </p>
          {attr.input_type === 'boolean' && (
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                disabled={disabled}
                checked={Boolean(values[attr.id])}
                onChange={(e) => set(attr.id, e.target.checked)}
              />
              Yes
            </label>
          )}
          {attr.input_type === 'number' && (
            <input
              type="number"
              disabled={disabled}
              value={values[attr.id] == null ? '' : String(values[attr.id])}
              onChange={(e) => set(attr.id, e.target.value === '' ? null : Number(e.target.value))}
              className="mira-input h-8 w-full"
            />
          )}
          {attr.input_type === 'text' && (
            <input
              type="text"
              disabled={disabled}
              value={String(values[attr.id] ?? '')}
              onChange={(e) => set(attr.id, e.target.value)}
              className="mira-input h-8 w-full"
              placeholder={attr.name}
            />
          )}
          {attr.input_type === 'select' && (
            <div className="space-y-1">
              {(attr.values || []).map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name={`attr-${attr.id}`}
                    disabled={disabled}
                    checked={values[attr.id] === opt}
                    onChange={() => set(attr.id, opt)}
                  />
                  {opt}
                </label>
              ))}
              {!(attr.values || []).length && (
                <p className="text-2xs text-muted-foreground">Add dropdown options in Label Manager.</p>
              )}
            </div>
          )}
          {attr.input_type === 'multiselect' && (
            <div className="space-y-1">
              {(attr.values || []).map((opt) => {
                const selected = Array.isArray(values[attr.id]) ? (values[attr.id] as string[]) : []
                return (
                  <label key={opt} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={selected.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, opt]
                          : selected.filter((v) => v !== opt)
                        set(attr.id, next)
                      }}
                    />
                    {opt}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function AttributeTypeBadge({ type }: { type: LabelAttribute['input_type'] }) {
  const labels: Record<LabelAttribute['input_type'], string> = {
    boolean: 'Boolean',
    number: 'Number',
    text: 'Text',
    select: 'Dropdown',
    multiselect: 'Multi-select',
  }
  return (
    <span className={cn('text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground')}>{labels[type]}</span>
  )
}
