import { ChevronDown, ChevronRight, Pin, PinOff } from 'lucide-react'
import { toolsByCategory, TOOL_BY_ID, TOOL_CATEGORIES, type ToolDef } from '../tools/registry'
import { cn } from '@/utils/cn'

const ICONS: Record<string, string> = {
  select: '✦',
  pointer: '➤',
  pan: '✋',
  zoom: '⌕',
  bbox: '□',
  rotated_bbox: '◇',
  polygon: '⬠',
  polyline: '╱',
  line: '─',
  freehand: '∿',
  point: '●',
  circle: '◎',
  ellipse: '⬭',
  arc: '⌒',
  brush: '▦',
  eraser: '⌫',
  polygon_mask: '▣',
  freehand_mask: '▨',
  semantic_seg: '▤',
  instance_seg: '▥',
  magic_wand: '✧',
  mask_refine: '✎',
  mask_merge: '⊕',
  mask_split: '⊖',
  keypoint: '✚',
  skeleton: '⚹',
  pose_edit: '✎',
  classify: 'T',
  multilabel: '☰',
  attributes: '☰',
  tags: '#',
  relation: '↔',
  hierarchy: '↳',
  track_id: '#',
  measure: '↗',
  angle: '∠',
  area: '▭',
  roi: '▢',
  grid: '▦',
  cuboid: '▢',
  bbox3d: '▣',
  ai_segment: '✦',
  ai_detect: '◉',
  ai_pose: '✚',
}

interface Props {
  tool: string
  collapsed: Record<string, boolean>
  favorites: string[]
  onToggleCategory: (id: string) => void
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
}

function ToolRow({
  def,
  active,
  favorited,
  onSelect,
  onToggleFavorite,
}: {
  def: ToolDef
  active: boolean
  favorited: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div className="group flex items-center">
      <button
        title={`${def.label}${def.shortcut ? ` (${def.shortcut})` : ''}\n${def.description}`}
        onClick={onSelect}
        className={cn(
          'flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-xs text-left transition-colors duration-150',
          active && def.ai && 'bg-brand-orange text-white',
          active && !def.ai && 'bg-primary text-white',
          !active && def.ai && 'text-brand-orange hover:bg-orange-50',
          !active && !def.ai && 'text-foreground hover:bg-accent',
          !active && !def.implemented && 'opacity-40',
        )}
      >
        <span className="w-4 text-center font-mono">{ICONS[def.id] || '·'}</span>
        <span className="flex-1 truncate">{def.label}</span>
        {def.shortcut && <span className="text-2xs opacity-60 font-mono">{def.shortcut}</span>}
      </button>
      <button
        onClick={onToggleFavorite}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 text-muted-foreground hover:text-primary"
        title={favorited ? 'Unpin' : 'Pin to favorites'}
      >
        {favorited ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
      </button>
    </div>
  )
}

export function ToolPanel({ tool, collapsed, favorites, onToggleCategory, onSelect, onToggleFavorite }: Props) {
  const cats = TOOL_CATEGORIES.filter((c) => c.id !== 'favorites' || favorites.length > 0)

  return (
    <aside className="w-[220px] shrink-0 bg-white border-r border-border flex flex-col overflow-hidden">
      <p className="mira-section-label px-3 py-2 border-b border-border">Tools</p>
      <div className="flex-1 overflow-auto py-1">
        {cats.map((cat) => {
          const items: ToolDef[] =
            cat.id === 'favorites'
              ? favorites.map((id) => TOOL_BY_ID[id]).filter(Boolean)
              : toolsByCategory(cat.id)
          const isCollapsed = collapsed[cat.id]
          return (
            <div key={cat.id} className="px-1 mb-1">
              <button
                onClick={() => onToggleCategory(cat.id)}
                className="w-full flex items-center gap-1 px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent rounded"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {cat.label}
              </button>
              {!isCollapsed &&
                items.map((def) => (
                  <ToolRow
                    key={def.id}
                    def={def}
                    active={tool === def.id}
                    favorited={favorites.includes(def.id)}
                    onSelect={() => onSelect(def.id)}
                    onToggleFavorite={() => onToggleFavorite(def.id)}
                  />
                ))}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
