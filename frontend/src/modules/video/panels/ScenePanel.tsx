import { Clapperboard, Minus, Plus, Scan, Trash2 } from 'lucide-react'
import type { SceneDefinition } from '@/modules/video/schema/sceneStore'
import type { VideoScenesApi } from '@/modules/video/hooks/useVideoScenes'
import { cn } from '@/utils/cn'

interface Props {
  definitions: SceneDefinition[]
  scenes: VideoScenesApi
  currentFrame: number
  onOpenManager?: () => void
  onAutoDetect?: () => void
}

export function ScenePanel({ definitions, scenes, currentFrame, onOpenManager, onAutoDetect }: Props) {
  const sceneTypes = definitions.filter((d) => d.enabled && d.kind === 'scene')
  const shotDef = definitions.find((d) => d.enabled && d.kind === 'shot_boundary')
  const cutDef = definitions.find((d) => d.enabled && d.kind === 'camera_cut')
  const activeDef =
    sceneTypes.find((d) => d.id === scenes.activeSceneDefId) ?? sceneTypes[0] ?? null
  const draft = scenes.intervalDraft

  return (
    <div className="border-t border-border shrink-0">
      <div className="px-2 py-1.5 flex items-center justify-between bg-slate-50/80">
        <p className="mira-section-label mb-0 text-slate-800">Scenes</p>
        {onOpenManager && (
          <button type="button" className="text-2xs text-muted-foreground hover:text-foreground" onClick={onOpenManager}>
            Manage
          </button>
        )}
      </div>

      <div className="px-2 py-2 space-y-2">
        {onAutoDetect && (
          <button
            type="button"
            className="w-full mira-btn-ghost h-8 text-xs flex items-center justify-center gap-1.5"
            disabled={scenes.detecting}
            onClick={onAutoDetect}
          >
            <Scan className="w-3.5 h-3.5" />
            {scenes.detecting ? 'Detecting…' : 'Auto-detect scenes'}
          </button>
        )}

        <p className="text-2xs font-medium text-muted-foreground">Scene type (interval)</p>
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {sceneTypes.map((def) => (
            <button
              key={def.id}
              type="button"
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-xs border',
                scenes.activeSceneDefId === def.id ? 'border-slate-500 bg-slate-50' : 'border-transparent hover:bg-accent',
              )}
              onClick={() => scenes.setActiveSceneDefId(def.id)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: def.color }} />
              <span className="truncate">{def.name}</span>
            </button>
          ))}
        </div>

        {activeDef && (
          <div className="space-y-1">
            {!draft || draft.sceneDefId !== activeDef.id ? (
              <button
                type="button"
                className="w-full mira-btn-ghost h-7 text-2xs flex items-center justify-center gap-1"
                onClick={() => scenes.beginInterval(activeDef.id, currentFrame)}
              >
                <Minus className="w-3 h-3" /> Scene start · f{currentFrame + 1}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="w-full mira-btn-primary h-7 text-2xs"
                  onClick={() => scenes.addSceneSpan(activeDef, draft.startFrame, currentFrame)}
                >
                  <Plus className="w-3 h-3 inline mr-1" /> Scene end · f{currentFrame + 1}
                </button>
                <button type="button" className="w-full mira-btn-ghost h-6 text-2xs" onClick={scenes.cancelIntervalDraft}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 pt-1">
          {shotDef && (
            <button
              type="button"
              className="mira-btn-ghost h-7 text-2xs"
              onClick={() => scenes.addMarker(shotDef, currentFrame, 'shot_boundary')}
            >
              Shot · f{currentFrame + 1}
            </button>
          )}
          {cutDef && (
            <button
              type="button"
              className="mira-btn-ghost h-7 text-2xs"
              onClick={() => scenes.addMarker(cutDef, currentFrame, 'camera_cut')}
            >
              Cut · f{currentFrame + 1}
            </button>
          )}
        </div>

        {scenes.scenes.some((s) => s.auto_detected) && (
          <button type="button" className="w-full mira-btn-ghost h-6 text-2xs text-destructive" onClick={scenes.clearAutoDetected}>
            <Trash2 className="w-3 h-3 inline mr-1" /> Clear auto-detected
          </button>
        )}

        {scenes.scenes.length > 0 && (
          <p className="text-2xs text-muted-foreground flex items-center gap-1">
            <Clapperboard className="w-3 h-3" /> {scenes.scenes.length} marker(s)
          </p>
        )}
      </div>
    </div>
  )
}
