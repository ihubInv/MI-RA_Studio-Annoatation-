import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface FieldProps {
  label: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}

export function Field({ label, icon: Icon, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="text-xs font-medium block mb-1.5">{label}</label>
      <div className={cn(Icon && 'mira-field')}>
        {Icon && <Icon className="mira-field-icon" />}
        {children}
      </div>
    </div>
  )
}
