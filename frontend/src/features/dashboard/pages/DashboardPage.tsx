import { Link } from 'react-router-dom'
import { BRAND } from '@/lib/brand'
import { useAuthStore } from '@/stores/authStore'
import { ProgressBar } from '@/components/ui/EmptyState'

const metrics = [
  { label: 'Datasets', value: '12' },
  { label: 'Samples', value: '84,240' },
  { label: 'Annotations', value: '1.2M' },
  { label: 'Complete', value: '73%' },
  { label: 'QA Score', value: '94%' },
  { label: 'Agreement', value: '82%' },
]

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="space-y-6 fade-enter">
      <div>
        <p className="mira-section-label mb-1">Project Overview</p>
        <h1 className="text-xl font-semibold">
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {BRAND.product} — {BRAND.tagline}
        </p>
      </div>

      {/* Compact metrics row */}
      <div className="mira-panel rounded-md p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {metrics.map(({ label, value }) => (
            <div key={label}>
              <p className="text-lg font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="mira-panel rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Annotation Progress</p>
            <span className="text-sm font-semibold text-primary">73%</span>
          </div>
          <ProgressBar value={73} />
        </div>
        <div className="mira-panel rounded-md p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Quality</p>
            <span className="text-sm font-semibold text-primary">94%</span>
          </div>
          <ProgressBar value={94} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="mira-panel rounded-md p-4">
        <p className="text-sm font-semibold mb-3">Getting Started</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: '1', title: 'Create a Project', desc: 'Configure team and annotation schema.', to: '/projects' },
            { step: '2', title: 'Upload a Dataset', desc: 'Images, video, audio, LiDAR, or multimodal.', to: '/datasets' },
            { step: '3', title: 'Start Annotating', desc: 'Assign tasks and open the studio.', to: '/tasks' },
          ].map(({ step, title, desc, to }) => (
            <Link
              key={step}
              to={to}
              className="p-3 rounded-md border border-border hover:border-primary/30 hover:bg-accent/40 transition-colors duration-150"
            >
              <span className="inline-flex w-6 h-6 rounded bg-primary/10 text-primary text-xs font-semibold items-center justify-center mb-2">
                {step}
              </span>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Modalities */}
      <div className="mira-panel rounded-md p-4">
        <p className="text-sm font-semibold mb-3">Supported Modalities</p>
        <div className="flex flex-wrap gap-1.5">
          {['Image', 'Video', 'Audio', 'Text', 'LiDAR', 'Point Cloud', 'Depth', 'Medical', 'Multimodal'].map((m) => (
            <span
              key={m}
              className="px-2 py-0.5 rounded border border-border text-2xs font-medium text-muted-foreground"
            >
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
