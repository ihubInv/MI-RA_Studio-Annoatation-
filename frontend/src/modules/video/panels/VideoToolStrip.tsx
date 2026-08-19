import { getImplementedTools } from '@/modules/video/tools/registry'
import type { VideoTool } from '@/modules/video/canvas/types'
import { cn } from '@/utils/cn'

interface Props {
  tool: VideoTool
  onToolChange: (tool: VideoTool) => void
}

export function VideoToolStrip({ tool, onToolChange }: Props) {
  const tools = getImplementedTools()

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 bg-white/95 border border-border rounded-lg p-1 shadow-sm">
      {tools.map(({ id, icon: Icon, label, hotkey }) => (
        <button
          key={id}
          type="button"
          title={`${label}${hotkey ? ` (${hotkey})` : ''}`}
          onClick={() => onToolChange(id)}
          className={cn(
            'w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60',
            tool === id && 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  )
}
