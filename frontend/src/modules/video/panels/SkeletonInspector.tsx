import { Copy, Trash2 } from 'lucide-react'
import type { VideoDisplaySkeleton } from '@/modules/video/canvas/skeletonInterpolation'
import type { VideoSkeletonObject } from '@/modules/video/canvas/skeletonTypes'
import type { VideoLabelSchema } from '@/modules/video/schema/labelStore'
import { OcclusionSelect } from '@/modules/video/panels/OcclusionSelect'
import { AttributeForm, type AttributeValues } from '@/modules/video/panels/AttributeForm'

interface Props {
  object: VideoDisplaySkeleton
  schema: VideoLabelSchema
  onChange: (patch: Partial<VideoSkeletonObject>) => void
  onDelete: () => void
  onCopy: () => void
  onPromoteKeyframe?: () => void
}

function num(v: number) {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0
}

export function SkeletonInspector({ object, schema, onChange, onDelete, onCopy, onPromoteKeyframe }: Props) {
  const labelDef = schema.labels.find((l) => l.name === object.label || l.id === object.label)
  const attributes = labelDef?.attributes ?? []

  const onLabelChange = (labelId: string) => {
    const label = schema.labels.find((l) => l.id === labelId)
    if (!label) return
    onChange({ label: label.name, color: label.color, attributes: {} })
  }

  const updateJoint = (jointId: string, patch: Partial<VideoSkeletonObject['joints'][0]>) => {
    onChange({
      joints: object.joints.map((j) => (j.joint_id === jointId ? { ...j, ...patch } : j)),
    })
  }

  return (
    <section className="border-b border-border bg-slate-50/80 max-h-[50vh] overflow-auto">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border/60 sticky top-0 bg-slate-50/95 z-10">
        <p className="mira-section-label">Skeleton</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onCopy} className="mira-btn-ghost h-7 px-2 text-xs" title="Copy">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={object.interpolated}
            className="mira-btn-ghost h-7 px-2 text-xs text-destructive disabled:opacity-30"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        <p className="text-2xs text-muted-foreground uppercase tracking-wide">
          tool · <span className="font-mono text-foreground">skeleton</span>
          {object.interpolated && <span className="ml-2 text-primary normal-case">· interpolated</span>}
        </p>
        {object.interpolated && onPromoteKeyframe && (
          <button type="button" className="mira-btn-ghost h-7 text-xs w-full" onClick={onPromoteKeyframe}>
            Create keyframe here (K)
          </button>
        )}
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
        <div className="pt-1 border-t border-border/60 space-y-2">
          <p className="text-2xs text-muted-foreground uppercase">Joints</p>
          {object.joints.map((j) => (
            <div key={j.joint_id} className="rounded border border-border/60 p-2 space-y-1.5 bg-white/80">
              <p className="text-xs font-medium">{j.name}</p>
              <div className="grid grid-cols-2 gap-1">
                <label className="space-y-0.5">
                  <span className="text-2xs text-muted-foreground">x</span>
                  <input
                    type="number"
                    className="mira-input h-7 w-full font-mono text-2xs"
                    value={num(j.x)}
                    disabled={Boolean(object.locked)}
                    onChange={(e) => updateJoint(j.joint_id, { x: Number(e.target.value) })}
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="text-2xs text-muted-foreground">y</span>
                  <input
                    type="number"
                    className="mira-input h-7 w-full font-mono text-2xs"
                    value={num(j.y)}
                    disabled={Boolean(object.locked)}
                    onChange={(e) => updateJoint(j.joint_id, { y: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-2xs">
                <input
                  type="checkbox"
                  checked={j.visible}
                  disabled={Boolean(object.locked)}
                  onChange={(e) => updateJoint(j.joint_id, { visible: e.target.checked })}
                />
                Visible
              </label>
              <OcclusionSelect
                label="Joint occlusion"
                value={j.occlusion}
                disabled={Boolean(object.locked)}
                onChange={(occlusion) => updateJoint(j.joint_id, { occlusion })}
              />
            </div>
          ))}
        </div>
        {attributes.length > 0 && (
          <div className="pt-1 border-t border-border/60">
            <AttributeForm
              attributes={attributes}
              values={(object.attributes as AttributeValues) ?? {}}
              onChange={(values) => onChange({ attributes: values })}
            />
          </div>
        )}
      </div>
    </section>
  )
}
