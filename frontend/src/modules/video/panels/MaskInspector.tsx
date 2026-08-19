import { Copy, Trash2 } from 'lucide-react'
import type { VideoDisplayMask } from '@/modules/video/canvas/maskInterpolation'
import type { VideoMaskObject, SegmentationMode } from '@/modules/video/canvas/maskTypes'
import type { VideoLabelSchema } from '@/modules/video/schema/labelStore'
import { OcclusionSelect } from '@/modules/video/panels/OcclusionSelect'
import { AttributeForm, type AttributeValues } from '@/modules/video/panels/AttributeForm'

interface Props {
  object: VideoDisplayMask
  schema: VideoLabelSchema
  onChange: (patch: Partial<VideoMaskObject>) => void
  onDelete: () => void
  onCopy: () => void
  onPromoteKeyframe?: () => void
}

export function MaskInspector({ object, schema, onChange, onDelete, onCopy, onPromoteKeyframe }: Props) {
  const labelDef = schema.labels.find((l) => l.name === object.label || l.id === object.label)
  const attributes = labelDef?.attributes ?? []

  const onLabelChange = (labelId: string) => {
    const label = schema.labels.find((l) => l.id === labelId)
    if (!label) return
    onChange({ label: label.name, color: label.color, attributes: {} })
  }

  return (
    <section className="border-b border-border bg-slate-50/80">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/60">
        <p className="mira-section-label">Mask</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onCopy} className="mira-btn-ghost h-7 px-2 text-xs" title="Copy">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={object.interpolated}
            className="mira-btn-ghost h-7 px-2 text-xs text-destructive disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-2xs text-muted-foreground uppercase">
          {object.segmentation_mode} · {object.tool_type}
          {object.interpolated && <span className="ml-2 text-primary normal-case">· interpolated</span>}
        </p>
        {object.interpolated && onPromoteKeyframe && (
          <button type="button" className="mira-btn-ghost h-7 text-xs w-full" onClick={onPromoteKeyframe}>
            Create keyframe here (K)
          </button>
        )}
        <label className="block space-y-0.5">
          <span className="text-2xs text-muted-foreground uppercase">Segmentation</span>
          <select
            className="mira-input h-8 w-full text-xs"
            value={object.segmentation_mode}
            disabled={Boolean(object.locked)}
            onChange={(e) => onChange({ segmentation_mode: e.target.value as SegmentationMode })}
          >
            <option value="instance">Instance</option>
            <option value="semantic">Semantic (class)</option>
          </select>
        </label>
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
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-0.5">
            <span className="text-2xs text-muted-foreground uppercase">object_id</span>
            <input
              type="text"
              className="mira-input h-8 w-full font-mono text-xs"
              value={object.object_id}
              disabled={Boolean(object.locked) || object.segmentation_mode === 'semantic'}
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
              onChange={(e) => onChange({ frame: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            />
          </label>
        </div>
        <OcclusionSelect
          value={object.occlusion ?? 'visible'}
          onChange={(occlusion) => onChange({ occlusion })}
          disabled={Boolean(object.locked)}
        />
        <div className="flex items-center gap-2 text-2xs">
          <button type="button" className="mira-btn-ghost h-7 px-2" onClick={() => onChange({ visible: object.visible === false })}>
            {object.visible === false ? 'Show' : 'Hide'}
          </button>
          <button type="button" className="mira-btn-ghost h-7 px-2" onClick={() => onChange({ locked: !object.locked })}>
            {object.locked ? 'Unlock' : 'Lock'}
          </button>
        </div>
        {attributes.length > 0 && (
          <AttributeForm
            attributes={attributes}
            values={(object.attributes as AttributeValues) ?? {}}
            onChange={(values) => onChange({ attributes: values })}
          />
        )}
      </div>
    </section>
  )
}
