import { Film, LayoutTemplate } from 'lucide-react'
import type { VideoAnnotationMode } from '@/modules/video/templates/types'

const OPTIONS: Array<{
  id: VideoAnnotationMode
  label: string
  hint: string
  icon: typeof Film
}> = [
  {
    id: 'classic',
    label: 'Standard Video Annotation',
    hint: 'Existing studio, unchanged',
    icon: Film,
  },
  {
    id: 'custom',
    label: 'Custom Template',
    hint: 'Optional. Select or configure a template',
    icon: LayoutTemplate,
  },
]

interface AnnotationModePickerProps {
  value: VideoAnnotationMode
  onChange: (mode: VideoAnnotationMode) => void
  compact?: boolean
}

export function AnnotationModePicker({ value, onChange, compact }: AnnotationModePickerProps) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">Annotation Mode</label>
      {!compact && (
        <p className="text-2xs text-muted-foreground mb-1.5">
          Custom Template is optional. Datasets without a template use Standard Video Annotation.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={active}
              className={`mira-choice ${active ? 'mira-choice-active' : ''}`}
            >
              <Icon className="w-4 h-4 text-primary mb-1" />
              <p className="text-xs font-semibold">{opt.label}</p>
              <p className="text-2xs text-muted-foreground leading-tight">{opt.hint}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
