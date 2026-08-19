import { Tags } from 'lucide-react'
import type { VideoLabel, VideoLabelSchema } from '@/modules/video/schema/labelStore'
import { AttributeForm, type AttributeValues } from '@/modules/video/panels/AttributeForm'
import { cn } from '@/utils/cn'

interface Props {
  schema: VideoLabelSchema
  activeLabelId: string | null
  onSelectLabel: (label: VideoLabel) => void
  attributeValues: AttributeValues
  onAttributeChange: (next: AttributeValues) => void
  onOpenManager: () => void
  className?: string
}

export function LabelPalette({
  schema,
  activeLabelId,
  onSelectLabel,
  attributeValues,
  onAttributeChange,
  onOpenManager,
  className,
}: Props) {
  const active = schema.labels.find((l) => l.id === activeLabelId) ?? null
  const enabled = schema.labels.filter((l) => l.enabled)

  return (
    <aside
      className={cn('w-full shrink-0 bg-white border-l border-border flex flex-col', className)}
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <p className="mira-section-label">Labels</p>
        <button type="button" onClick={onOpenManager} className="mira-btn-ghost h-7 px-2 text-xs">
          <Tags className="w-3.5 h-3.5" /> Manage
        </button>
      </div>
      <div className="overflow-auto p-2 space-y-0.5 max-h-40">
        {enabled.map((label) => (
          <button
            key={label.id}
            type="button"
            onClick={() => onSelectLabel(label)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs',
              activeLabelId === label.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50',
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: label.color }} />
            <span className="truncate flex-1">{label.name}</span>
            {label.hotkey && <span className="text-2xs text-muted-foreground font-mono">{label.hotkey}</span>}
          </button>
        ))}
        {!enabled.length && <p className="text-2xs text-muted-foreground px-1">No enabled labels.</p>}
      </div>
      {active && (
        <div className="border-t border-border p-3 overflow-auto max-h-48">
          <p className="text-xs font-semibold mb-2" style={{ color: active.color }}>
            {active.name}
          </p>
          <AttributeForm attributes={active.attributes} values={attributeValues} onChange={onAttributeChange} />
        </div>
      )}
    </aside>
  )
}
