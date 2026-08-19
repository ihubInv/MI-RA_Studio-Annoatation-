import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, Database, Pencil,
  Search, CheckSquare, BarChart2, Settings
} from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { cn } from '@/utils/cn'

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/projects',   icon: FolderOpen,      label: 'Projects'    },
  { to: '/datasets',   icon: Database,        label: 'Datasets'    },
  { to: '/tasks',      icon: Pencil,          label: 'Tasks'       },
  { to: '/explore',    icon: Search,          label: 'Explorer'    },
  { to: '/qa',         icon: CheckSquare,     label: 'QA & Review' },
  { to: '/analytics',  icon: BarChart2,       label: 'Analytics'   },
  { to: '/admin',      icon: Settings,        label: 'Admin'       },
]

export function Sidebar() {
  return (
    <aside className="w-60 flex-shrink-0 bg-card border-r border-border flex flex-col">
      {/* Brand */}
      <div className="px-4 py-3 border-b border-border">
        <BrandLogo className="h-9 max-w-full" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">v1.0.0</p>
      </div>
    </aside>
  )
}
