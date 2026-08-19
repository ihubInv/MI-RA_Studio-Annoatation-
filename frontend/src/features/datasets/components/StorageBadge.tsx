import { Cloud, HardDrive, Lock } from 'lucide-react'
import { cn } from '@/utils/cn'

export function StorageBadge({ mode, compact }: { mode?: string; compact?: boolean }) {
  const value = mode || 'server'
  const map = {
    local: {
      label: 'LOCAL',
      hint: 'Files remain on your computer',
      icon: Lock,
      cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    cloud: {
      label: 'CLOUD',
      hint: 'Dataset stored in cloud storage',
      icon: Cloud,
      cls: 'bg-sky-50 text-sky-800 border-sky-200',
    },
    server: {
      label: 'SERVER',
      hint: 'Dataset stored centrally',
      icon: HardDrive,
      cls: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  } as const
  const spec = map[value as keyof typeof map] || map.server
  const Icon = spec.icon
  return (
    <span className={cn('inline-flex items-center gap-1 border rounded-md px-1.5 py-0.5 text-2xs font-semibold', spec.cls)} title={spec.hint}>
      <Icon className="w-3 h-3" />
      {spec.label}
      {!compact && <span className="font-normal hidden md:inline">· {spec.hint}</span>}
    </span>
  )
}
