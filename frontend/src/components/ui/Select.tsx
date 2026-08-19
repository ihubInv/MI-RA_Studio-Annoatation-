import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
  icon?: LucideIcon
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  icon?: LucideIcon
  required?: boolean
  className?: string
  size?: 'md' | 'sm'
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  icon: TriggerIcon,
  className,
  size = 'md',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)
  const SelectedIcon = selected?.icon || TriggerIcon

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('mira-select-root', className)}>
      <button
        type="button"
        className={cn('mira-select-trigger', size === 'sm' && 'mira-select-trigger-sm', open && 'mira-select-open')}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {SelectedIcon && <SelectedIcon className="mira-select-trigger-icon" />}
        <span className={cn('mira-select-value', !selected && 'mira-select-placeholder')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn('mira-select-chevron', open && 'rotate-180')} />
      </button>

      {open && (
        <ul className="mira-select-menu" role="listbox">
          {options.map((opt) => {
            const Icon = opt.icon
            const active = opt.value === value
            return (
              <li key={opt.value || 'empty'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn('mira-select-option', active && 'mira-select-option-active')}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  {Icon ? <Icon className="mira-select-option-icon" /> : <span className="w-4" />}
                  <span className="flex-1 text-left truncate">{opt.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
