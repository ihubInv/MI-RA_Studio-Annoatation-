import { OCCLUSION_STATES, type OcclusionState } from '@/modules/video/schema/occlusion'

interface Props {
  value: OcclusionState
  onChange: (value: OcclusionState) => void
  disabled?: boolean
  label?: string
}

export function OcclusionSelect({ value, onChange, disabled, label = 'Occlusion' }: Props) {
  return (
    <label className="block space-y-0.5">
      <span className="text-2xs text-muted-foreground uppercase">{label}</span>
      <select
        className="mira-input h-8 w-full text-xs"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as OcclusionState)}
      >
        {OCCLUSION_STATES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}
