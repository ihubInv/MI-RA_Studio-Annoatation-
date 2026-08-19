import { Outlet } from 'react-router-dom'
import { Topbar } from './Topbar'
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette'

export function AppShell() {
  const palette = useCommandPalette()

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Topbar onOpenCommandPalette={palette.toggle} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-[1600px] mx-auto w-full fade-enter">
          <Outlet />
        </div>
      </main>
      <CommandPalette open={palette.open} onClose={palette.close} />
    </div>
  )
}
