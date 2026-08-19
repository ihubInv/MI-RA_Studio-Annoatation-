import { Mail, Shield, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const fields = [
    { label: 'Full name', value: user?.full_name || '—' },
    { label: 'Username', value: user?.username || '—' },
    { label: 'Email', value: user?.email || '—' },
    { label: 'Role', value: user?.role?.replace('_', ' ') || '—' },
  ]

  return (
    <div className="space-y-6 fade-enter w-full">
      <div>
        <p className="mira-section-label mb-1">Account</p>
        <h1 className="text-xl font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your MI-RA Studio account details.</p>
      </div>

      <div className="mira-panel p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold">{user?.full_name || user?.email || 'User'}</p>
            <p className="text-sm text-muted-foreground capitalize flex items-center gap-1.5 mt-0.5">
              <Shield className="w-3.5 h-3.5" />
              {user?.role?.replace('_', ' ') || 'annotator'}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(({ label, value }) => (
            <div key={label} className="rounded-md border border-primary/25 bg-white/80 px-3.5 py-3 min-h-[4.25rem]">
              <dt className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</dt>
              <dd className="text-sm break-all">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Mail className="w-3.5 h-3.5" />
          Signed in as {user?.email || 'unknown'}
        </div>
      </div>

      <button type="button" onClick={logout} className="mira-btn-ghost text-destructive hover:text-destructive">
        Sign out
      </button>
    </div>
  )
}
