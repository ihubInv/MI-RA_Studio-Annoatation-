import { getImplementedTools, type VideoToolCategory, type VideoToolDef } from '@/modules/video/tools/registry'
import type { VideoTool } from '@/modules/video/canvas/types'
import { cn } from '@/utils/cn'

interface Props {
  tool: VideoTool
  onToolChange: (tool: VideoTool) => void
}

const CATEGORY_ORDER: VideoToolCategory[] = ['navigation', 'geometry', 'segmentation', 'pose']

function groupTools(tools: VideoToolDef[]) {
  return CATEGORY_ORDER.map((category) => ({
    category,
    tools: tools.filter((t) => t.category === category),
  })).filter((g) => g.tools.length > 0)
}

export function VideoToolStrip({ tool, onToolChange }: Props) {
  const groups = groupTools(getImplementedTools())

  return (
    <div className="absolute left-3 top-12 bottom-12 z-30 flex flex-col pointer-events-none">
      <div
        className={cn(
          'pointer-events-auto flex flex-col gap-0.5 bg-white/95 border border-border rounded-lg p-1 shadow-sm',
          'max-h-full overflow-y-auto overflow-x-hidden',
          '[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border',
        )}
      >
        {groups.map((group, gi) => (
          <div key={group.category} className="flex flex-col gap-0.5">
            {gi > 0 && <div className="h-px bg-border mx-1 my-0.5 shrink-0" />}
            {group.tools.map(({ id, icon: Icon, label, hotkey }) => (
              <button
                key={id}
                type="button"
                title={`${label}${hotkey ? ` (${hotkey})` : ''}`}
                onClick={() => onToolChange(id)}
                className={cn(
                  'w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60',
                  tool === id && 'bg-primary/10 text-primary',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
