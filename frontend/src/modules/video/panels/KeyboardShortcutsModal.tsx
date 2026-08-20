import { VIDEO_TOOLS } from '@/modules/video/tools/registry'

interface Props {
  onClose: () => void
}

export function KeyboardShortcutsModal({ onClose }: Props) {
  const extras = [
    ['H or Hand tool', 'Pan canvas (click-drag)'],
    ['Alt + drag', 'Pan without switching tools'],
    ['Right-drag / middle-drag', 'Pan canvas'],
    ['Space + drag', 'Pan (tap Space to play/pause)'],
    ['← / →', 'Step frame'],
    ['Shift+← / →', 'Jump 10 frames'],
    ['K', 'Keyframe'],
    ['F', 'Fullscreen annotation'],
    ['Ctrl+Z / Y', 'Undo / redo'],
    ['Delete', 'Delete selection'],
    ['[ / ]', 'Prev / next item'],
    ['Ctrl+K', 'Command palette'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-lg border shadow-xl w-full max-w-md max-h-[80vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <button type="button" className="text-xs text-muted-foreground" onClick={onClose}>Close</button>
        </div>
        <table className="w-full text-xs">
          <tbody>
            {VIDEO_TOOLS.filter((t) => t.implemented && t.hotkey).map((t) => (
              <tr key={t.id} className="border-b border-border/40">
                <td className="py-1 font-mono w-20">{t.hotkey}</td>
                <td>{t.label}</td>
              </tr>
            ))}
            {extras.map(([k, v]) => (
              <tr key={k} className="border-b border-border/40">
                <td className="py-1 font-mono">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
