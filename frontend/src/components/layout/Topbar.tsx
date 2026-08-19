import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  Command,
  HelpCircle,
  LogOut,
  Search,
  User,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

const NAV = [
  { to: '/dashboard', label: 'Workspace' },
  { to: '/projects', label: 'Projects' },
  { to: '/datasets', label: 'Datasets' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/models', label: 'Models' },
  { to: '/analytics', label: 'Analytics' },
]

interface TopbarProps {
  onOpenCommandPalette?: () => void
}

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()

  return (
    <header className="h-14 shrink-0 border-b border-border bg-white flex items-center px-4 gap-4 z-20">
      <BrandLogo className="h-9 max-w-[200px]" />

      <div className="w-px h-5 bg-border hidden md:block" />

      {/* Primary nav */}
      <nav className="hidden md:flex items-center gap-0.5">
        {NAV.map(({ to, label }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + '/')
          return (
            <Link
              key={to}
              to={to}
              className={cn('mira-nav-link', active && 'mira-nav-link-active')}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button
          className="hidden lg:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground hover:bg-accent transition-colors duration-150"
          onClick={onOpenCommandPalette}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="text-2xs px-1 py-0.5 rounded border border-border font-mono bg-white">
            Ctrl K
          </kbd>
        </button>

        <button
          className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          onClick={onOpenCommandPalette}
          title="Command palette"
        >
          <Command className="w-4 h-4" />
        </button>

        <button className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title="Notifications">
          <Bell className="w-4 h-4" />
        </button>
        <button className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title="Help">
          <HelpCircle className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block min-w-0">
            <p className="text-xs font-medium truncate max-w-[120px]">
              {user?.full_name || user?.email || 'User'}
            </p>
            <p className="text-2xs text-muted-foreground capitalize">{user?.role || 'annotator'}</p>
          </div>
          <button
            onClick={logout}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
