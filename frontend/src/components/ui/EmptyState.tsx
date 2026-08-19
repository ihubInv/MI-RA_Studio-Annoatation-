import { Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

interface EmptyStateProps {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <h3 className="text-sm font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-5 leading-relaxed">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="mira-btn-primary">
          {action.label}
        </button>
      )}
    </div>
  )
}

interface ProgressBarProps {
  value: number
  variant?: 'default' | 'attention'
  className?: string
}

export function ProgressBar({ value, variant = 'default', className }: ProgressBarProps) {
  return (
    <div className={cn('mira-progress-track', className)}>
      <div
        className={cn('mira-progress-fill', variant === 'attention' && 'bg-brand-orange')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
