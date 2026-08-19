import { Copy, Trash2 } from 'lucide-react'
import type { VideoDisplayObject } from '@/modules/video/canvas/interpolation'
import type { VideoRectObject } from '@/modules/video/canvas/types'
import type { VideoLabelSchema } from '@/modules/video/schema/labelStore'
import { OcclusionSelect } from '@/modules/video/panels/OcclusionSelect'
import { AttributeForm, type AttributeValues } from '@/modules/video/panels/AttributeForm'

interface Props {
  object: VideoDisplayObject
  schema: VideoLabelSchema
  onChange: (patch: Partial<VideoRectObject>) => void
  onDelete: () => void
  onCopy: () => void
  onPromoteKeyframe?: () => void
}
function num(v: number) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
}

export function ObjectInspector({ object, schema, onChange, onDelete, onCopy, onPromoteKeyframe }: Props) {
  const labelDef = schema.labels.find((l) => l.name === object.label || l.id === object.label)
  const attributes = labelDef?.attributes ?? []

  const setField = (key: keyof VideoRectObject, raw: string) => {
    const n = Number(raw)
    if (key === 'x' || key === 'y' || key === 'width' || key === 'height') {
      if (!Number.isFinite(n)) return
      onChange({ [key]: n })
    } else if (key === 'frame') {
      const f = Math.max(0, Math.floor(n))
      onChange({ frame: f })
    } else {
      onChange({ [key]: raw })
    }
  }

  const onLabelChange = (labelId: string) => {
    const label = schema.labels.find((l) => l.id === labelId)
    if (!label) return
    onChange({ label: label.name, color: label.color, attributes: {} })
  }

  const onAttributesChange = (values: AttributeValues) => {
    onChange({ attributes: values })
  }

  return (
    <section className="border-b border-border bg-slate-50/80">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/60">
        <p className="mira-section-label">Object</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onCopy} className="mira-btn-ghost h-7 px-2 text-xs" title="Copy (Ctrl+C)">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} disabled={object.interpolated} className="mira-btn-ghost h-7 px-2 text-xs text-destructive disabled:opacity-30" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-2xs text-muted-foreground uppercase tracking-wide">
          tool · <span className="font-mono text-foreground">{object.tool_type}</span>
          {object.interpolated && (
            <span className="ml-2 text-primary normal-case">· interpolated</span>
          )}
        </p>
        {object.interpolated && onPromoteKeyframe && (
          <button type="button" className="mira-btn-ghost h-7 text-xs w-full" onClick={onPromoteKeyframe}>
            Create keyframe here (K)
          </button>
        )}        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key} className="space-y-0.5">
              <span className="text-2xs text-muted-foreground uppercase">{key}</span>
              <input
                type="number"
                className="mira-input h-8 w-full font-mono text-xs"
                value={num(object[key])}
                step={1}
                disabled={Boolean(object.locked)}
                onChange={(e) => setField(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="block space-y-0.5">
          <span className="text-2xs text-muted-foreground uppercase">Label</span>
          <select
            className="mira-input h-8 w-full text-xs"
            value={labelDef?.id ?? ''}
            disabled={Boolean(object.locked)}
            onChange={(e) => onLabelChange(e.target.value)}
          >
            {schema.labels.filter((l) => l.enabled).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <OcclusionSelect
          value={object.occlusion ?? 'visible'}
          onChange={(occlusion) => onChange({ occlusion })}
          disabled={Boolean(object.locked)}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-2xs text-muted-foreground uppercase">object_id</span>
            <input
              type="text"
              className="mira-input h-8 w-full font-mono text-xs"
              value={object.object_id}
              disabled={Boolean(object.locked)}
              onChange={(e) => onChange({ object_id: e.target.value })}
            />
          </label>
          <label className="space-y-0.5">
            <span className="text-2xs text-muted-foreground uppercase">frame</span>
            <input
              type="number"
              className="mira-input h-8 w-full font-mono text-xs"
              value={object.frame}
              min={0}
              step={1}
              onChange={(e) => setField('frame', e.target.value)}
            />
          </label>
        </div>
        <div className="flex items-center gap-2 text-2xs">
          <button
            type="button"
            className="mira-btn-ghost h-7 px-2"
            onClick={() => onChange({ visible: object.visible === false })}
          >
            {object.visible === false ? 'Show' : 'Hide'}
          </button>
          <button
            type="button"
            className="mira-btn-ghost h-7 px-2"
            onClick={() => onChange({ locked: !object.locked })}
          >
            {object.locked ? 'Unlock' : 'Lock'}
          </button>
        </div>
        {attributes.length > 0 && (
          <div className="pt-1 border-t border-border/60">
            <AttributeForm
              attributes={attributes}
              values={(object.attributes as AttributeValues) ?? {}}
              onChange={onAttributesChange}
            />
          </div>
        )}
      </div>
    </section>
  )
}
