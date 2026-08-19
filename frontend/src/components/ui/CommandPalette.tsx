import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BoxSelect,
  BrainCircuit,
  CheckSquare,
  Database,
  FolderOpen,
  Layers,
  Pencil,
  Search,
  Send,
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface CommandItem {
  id: string
  label: string
  group: string
  icon?: React.ReactNode
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  extraCommands?: CommandItem[]
}

const BASE_COMMANDS: Omit<CommandItem, 'action'>[] = [
  { id: 'projects', label: 'Open Projects', group: 'Navigation', icon: <FolderOpen className="w-4 h-4" /> },
  { id: 'datasets', label: 'Open Datasets', group: 'Navigation', icon: <Database className="w-4 h-4" /> },
  { id: 'tasks', label: 'Open Tasks', group: 'Navigation', icon: <Pencil className="w-4 h-4" /> },
  { id: 'qa', label: 'Open QA Panel', group: 'Navigation', icon: <CheckSquare className="w-4 h-4" /> },
  { id: 'models', label: 'Open Models', group: 'Navigation', icon: <BrainCircuit className="w-4 h-4" /> },
  { id: 'bbox', label: 'Create Bounding Box', group: 'Annotation', icon: <BoxSelect className="w-4 h-4" /> },
  { id: 'objects', label: 'Show Objects Panel', group: 'Annotation', icon: <Layers className="w-4 h-4" /> },
  { id: 'export', label: 'Export Dataset', group: 'Actions', icon: <Send className="w-4 h-4" /> },
]

export function CommandPalette({ open, onClose, extraCommands = [] }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  const commands = useMemo<CommandItem[]>(() => {
    const navActions: Record<string, () => void> = {
      projects: () => navigate('/projects'),
      datasets: () => navigate('/datasets'),
      tasks: () => navigate('/tasks'),
      qa: () => navigate('/qa'),
      models: () => navigate('/models'),
      bbox: () => {},
      objects: () => {},
      export: () => {},
    }
    const base = BASE_COMMANDS.map((c) => ({
      ...c,
      action: navActions[c.id] ?? (() => {}),
    }))
    return [...base, ...extraCommands]
  }, [navigate, extraCommands])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    )
  }, [commands, query])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIdx(0)
    }
  }, [open])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && filtered[activeIdx]) {
        e.preventDefault()
        filtered[activeIdx].action()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, activeIdx, onClose])

  if (!open) return null

  const groups = [...new Set(filtered.map((c) => c.group))]

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white border border-border rounded-lg shadow-lg overflow-hidden fade-enter">
        <div className="flex items-center gap-2 px-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands…"
            className="flex-1 h-11 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-2xs px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">No commands found</p>
          ) : (
            groups.map((group) => (
              <div key={group}>
                <p className="px-3 py-1.5 mira-section-label">{group}</p>
                {filtered
                  .filter((c) => c.group === group)
                  .map((cmd) => {
                    const idx = filtered.indexOf(cmd)
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action()
                          onClose()
                        }}
                        onMouseEnter={() => setActiveIdx(idx)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors duration-150',
                          idx === activeIdx ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                        )}
                      >
                        <span className="text-muted-foreground">{cmd.icon}</span>
                        <span className="flex-1">{cmd.label}</span>
                        <span className="text-muted-foreground">→</span>
                      </button>
                    )
                  })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { open, setOpen, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }
}
