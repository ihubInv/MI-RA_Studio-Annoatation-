import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { FolderNode } from '@/features/datasets/datasetTree.types'

interface Props {
  node: FolderNode
  selectedPath: string | null
  onSelect: (path: string | null) => void
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
  depth?: number
}

function StatusBar({ node }: { node: FolderNode }) {
  const total = Math.max(1, node.image_count)
  const parts = [
    { n: node.completed + node.approved, cls: 'bg-emerald-500' },
    { n: node.in_progress, cls: 'bg-amber-400' },
    { n: node.needs_review, cls: 'bg-red-400' },
    { n: node.not_annotated, cls: 'bg-slate-300' },
  ]
  return (
    <div className="h-1 rounded-full bg-slate-100 overflow-hidden flex w-16">
      {parts.map((p, i) =>
        p.n ? <span key={i} className={p.cls} style={{ width: `${(p.n / total) * 100}%` }} /> : null,
      )}
    </div>
  )
}

export function DatasetExplorer({ node, selectedPath, onSelect, expanded, onToggle, depth = 0 }: Props) {
  const path = node.path
  const isRoot = path === ''
  const open = isRoot || expanded[path] !== false
  const selected = (selectedPath || '') === path
  const hasChildren = node.children.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(isRoot ? null : path)}
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-left',
          selected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              if (!isRoot) onToggle(path)
            }}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground"
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        ) : (
          <span className="w-4" />
        )}
        <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate flex-1">{isRoot ? 'Dataset' : node.name}</span>
        <span className="tabular-nums text-2xs text-muted-foreground">{node.image_count}</span>
        {node.image_count > 0 && <StatusBar node={node} />}
      </button>
      {open &&
        node.children.map((child) => (
          <DatasetExplorer
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

export function findFolder(node: FolderNode, path: string | null): FolderNode {
  if (!path) return node
  const stack = [node]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur.path === path) return cur
    stack.push(...cur.children)
  }
  return node
}
