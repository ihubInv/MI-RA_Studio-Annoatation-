import { NavLink } from 'react-router-dom'
import {
  BarChart2,
  BrainCircuit,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Database,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Pencil,
  UserCircle,
} from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/utils/cn'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Workspace', end: true },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/datasets', icon: Database, label: 'Datasets' },
  { to: '/tasks', icon: Pencil, label: 'Tasks' },
  { to: '/qa', icon: CheckSquare, label: 'QA' },
  { to: '/models', icon: BrainCircuit, label: 'Models' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/profile', icon: UserCircle, label: 'Profile' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const logout = useAuthStore((s) => s.logout)

  return (
    <aside
      className={cn(
        'mira-sidebar h-full flex flex-col shrink-0 transition-[width] duration-200 ease-out',
        collapsed ? 'w-[72px]' : 'w-[240px]',
      )}
    >
      <div
        className={cn(
          'border-b border-primary/10 flex items-center gap-2',
          collapsed ? 'flex-col justify-center px-2 py-3' : 'px-3 py-3',
        )}
      >
        {collapsed ? (
          <NavLink
            to="/dashboard"
            className="w-9 h-9 rounded-md bg-primary text-white text-sm font-semibold flex items-center justify-center"
            title="MI-RA Studio"
          >
            M
          </NavLink>
        ) : (
          <BrandLogo className="h-9 max-w-[160px] flex-1 min-w-0" />
        )}
        <button
          type="button"
          onClick={onToggle}
          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-white/70 hover:text-primary transition-colors"
          title={collapsed ? 'Maximize sidebar' : 'Minimize sidebar'}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-auto">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-md text-sm transition-colors',
                collapsed ? 'justify-center h-10' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-primary text-white font-medium shadow-sm'
                  : 'text-foreground/80 hover:bg-white/70 hover:text-primary',
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={cn('p-2 border-t border-primary/10', collapsed && 'flex justify-center')}>
        <button
          type="button"
          onClick={logout}
          className={cn(
            'h-9 rounded-md text-muted-foreground hover:bg-red-50 hover:text-destructive transition-colors flex items-center gap-2',
            collapsed ? 'w-10 justify-center' : 'w-full px-3 text-sm',
          )}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
