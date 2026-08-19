import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { AppHeader } from './AppHeader'
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette'

const SIDEBAR_KEY = 'mira-sidebar-collapsed'

export function AppShell() {
  const palette = useCommandPalette()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })

  const toggleSidebar = useCallback(() => {
    setCollapsed((value) => {
      const next = !value
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return (
    <div className="flex h-screen mira-app-bg overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          onOpenCommandPalette={palette.toggle}
          sidebarCollapsed={collapsed}
          onToggleSidebar={toggleSidebar}
        />
        <main className="flex-1 min-h-0 overflow-auto">
          <div className="p-6 w-full fade-enter">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  )
}
