import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Pencil, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { api } from '@/services/api'
import type { Task } from '@/types/annotation.types'

const statusBadges: Record<string, { label: string; icon: any; class: string }> = {
  pending: { label: 'Pending', icon: Clock, class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  assigned: { label: 'Assigned', icon: Clock, class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  in_progress: { label: 'In Progress', icon: Clock, class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  submitted: { label: 'Submitted', icon: Clock, class: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  approved: { label: 'Approved', icon: CheckCircle2, class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejected: { label: 'Rejected', icon: AlertCircle, class: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
}

export function TasksPage() {
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/tasks/my-tasks')
      return data
    },
  })

  const tasks: Task[] = data?.items ?? []
  const filteredTasks = tasks.filter((t) => filterStatus === 'all' || t.status === filterStatus)

  return (
    <div className="space-y-6 fade-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Annotation Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tasks assigned to you for annotation and review
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {['all', 'pending', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              filterStatus === s
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 mira-panel">
          <Pencil className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-base font-semibold">No assigned tasks</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            You currently have no tasks assigned in this status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const badge = statusBadges[task.status] || statusBadges.pending
            const StatusIcon = badge.icon
            return (
              <div
                key={task.id}
                className="mira-panel p-4 flex items-center justify-between hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Pencil className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">{task.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Priority: {task.priority} · Assigned {new Date(task.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${badge.class}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {badge.label}
                  </span>
                  {task.item_ids?.[0] ? (
                    <Link
                      to={`/annotate/${task.item_ids[0]}?taskId=${task.id}`}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                    >
                      Open Studio
                    </Link>
                  ) : task.dataset_id ? (
                    <Link
                      to={`/datasets/${task.dataset_id}`}
                      className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
                    >
                      Open Dataset
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">No items</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
