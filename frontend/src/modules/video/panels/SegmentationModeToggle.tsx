import type { SegmentationMode } from '@/modules/video/canvas/maskTypes'

interface Props {
  mode: SegmentationMode
  onChange: (mode: SegmentationMode) => void
}

export function SegmentationModeToggle({ mode, onChange }: Props) {
  return (
    <div className="px-3 py-2 border-b border-border space-y-1 shrink-0">
      <p className="text-2xs text-muted-foreground uppercase">Segmentation mode</p>
      <div className="flex gap-1">
        <button
          type="button"
          className={`flex-1 h-7 text-xs rounded border ${mode === 'instance' ? 'bg-primary/10 border-primary text-primary' : 'border-border'}`}
          onClick={() => onChange('instance')}
        >
          Instance
        </button>
        <button
          type="button"
          className={`flex-1 h-7 text-xs rounded border ${mode === 'semantic' ? 'bg-primary/10 border-primary text-primary' : 'border-border'}`}
          onClick={() => onChange('semantic')}
        >
          Semantic
        </button>
      </div>
      <p className="text-2xs text-muted-foreground">
        {mode === 'instance' ? 'One mask per object ID' : 'One mask per class on each frame'}
      </p>
    </div>
  )
}
