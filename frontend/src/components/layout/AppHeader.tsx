import { useLocation } from 'react-router-dom'
import { Bell, Command, HelpCircle, LogOut, PanelLeft, Search, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const TITLES: { match: (path: string) => boolean; label: string }[] = [
  { match: (p) => p.startsWith('/projects'), label: 'Projects' },
  { match: (p) => p.startsWith('/datasets'), label: 'Datasets' },
  { match: (p) => p.startsWith('/tasks'), label: 'Tasks' },
  { match: (p) => p.startsWith('/models'), label: 'Models' },
  { match: (p) => p.startsWith('/analytics'), label: 'Analytics' },
  { match: (p) => p.startsWith('/qa'), label: 'QA & Review' },
  { match: (p) => p.startsWith('/admin'), label: 'Admin' },
  { match: (p) => p.startsWith('/profile'), label: 'Profile' },
  { match: (p) => p.startsWith('/dashboard'), label: 'Workspace' },
]

interface AppHeaderProps {
  onOpenCommandPalette?: () => void
  sidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export function AppHeader({ onOpenCommandPalette, sidebarCollapsed, onToggleSidebar }: AppHeaderProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const title = TITLES.find((t) => t.match(location.pathname))?.label || 'MI-RA Studio'

  return (
    <header className="mira-header h-14 shrink-0 flex items-center px-5 gap-3 z-20">
      <button
        type="button"
        onClick={onToggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/80 hover:text-primary"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <PanelLeft className="w-4 h-4" />
      </button>

      <div className="min-w-0">
        <p className="mira-section-label">MI-RA Studio</p>
        <h1 className="text-sm font-semibold truncate leading-tight">{title}</h1>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-primary/20 bg-white/80 text-sm text-muted-foreground hover:bg-white hover:text-foreground transition-colors"
        onClick={onOpenCommandPalette}
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search</span>
        <kbd className="text-2xs px-1 py-0.5 rounded border border-border font-mono bg-white">
          Ctrl K
        </kbd>
      </button>

      <button
        type="button"
        className="md:hidden w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/80"
        onClick={onOpenCommandPalette}
        title="Search"
      >
        <Command className="w-4 h-4" />
      </button>

      <button
        type="button"
        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/80"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/80"
        title="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-primary/15 mx-1" />

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="hidden sm:block min-w-0">
          <p className="text-xs font-medium truncate max-w-[140px]">
            {user?.full_name || user?.email || 'User'}
          </p>
          <p className="text-2xs text-muted-foreground capitalize">
            {user?.role?.replace('_', ' ') || 'annotator'}
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/80 hover:text-destructive"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
