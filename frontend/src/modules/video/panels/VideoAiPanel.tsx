import { ChevronLeft, ChevronRight, RefreshCw, ScanSearch, Sparkles } from 'lucide-react'
import type { DetectOutput } from '@/modules/image/api/inference.service'
import type { AiSuggestion } from '@/modules/video/ai/mapAiResults'
import type { AiSettings, UseAiSuggestionsReturn } from '@/modules/video/hooks/useAiSuggestions'
import { cn } from '@/utils/cn'

interface Props {
  ai: UseAiSuggestionsReturn
  currentFrame: number
  maxFrame: number
  fps: number
  videoReady: boolean
  selectedObjectId?: string | null
  onClose: () => void
  onDetect: () => void
  onSegmentMode: () => void
  onPoseMode: () => void
  onTrackForward: () => void
  onTrackBackward: () => void
  onSmartAnalysis: () => void
  onReTrack: () => void
  onAccept: (s: AiSuggestion) => void
  onAcceptAll: () => void
  onReject: (id: string) => void
}

const DEFAULT_DETECT_MODELS = [
  { id: 'yolov8n', label: 'YOLOv8 Nano' },
  { id: 'yolov8s', label: 'YOLOv8 Small' },
  { id: 'yolov8m', label: 'YOLOv8 Medium' },
]

export function VideoAiPanel({
  ai,
  currentFrame,
  maxFrame,
  fps,
  videoReady,
  selectedObjectId,
  onClose,
  onDetect,
  onSegmentMode,
  onPoseMode,
  onTrackForward,
  onTrackBackward,
  onSmartAnalysis,
  onReTrack,
  onAccept,
  onAcceptAll,
  onReject,
}: Props) {
  const { settings, setSettings, pendingFiltered, needsReviewCount, showReviewOnly, setShowReviewOnly, busy, status, modelsAvailable, segPrompts } = ai

  const pending = pendingFiltered

  const patchSettings = (patch: Partial<AiSettings>) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <aside className="w-[320px] shrink-0 bg-white border-l border-border flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between bg-brand-orange/5">
        <span className="text-sm font-semibold text-brand-orange flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> AI Assist
        </span>
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>

      <div className="p-3 border-b border-border space-y-2 overflow-y-auto max-h-[45%]">
        <p className="mira-section-label">Detect settings</p>
        {modelsAvailable === false && (
          <p className="text-2xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            YOLO not available on server. Run{' '}
            <code className="font-mono">pip install -r requirements-ml.txt</code> in backend/.venv
          </p>
        )}
        {modelsAvailable && <p className="text-2xs text-emerald-700">Inference models ready on server.</p>}

        <label className="block text-2xs text-muted-foreground">
          Output shape
          <select
            className="mira-input h-8 text-xs mt-1 w-full"
            value={settings.detectOutput}
            onChange={(e) => patchSettings({ detectOutput: e.target.value as DetectOutput })}
          >
            <option value="bbox">Bounding boxes</option>
            <option value="polygon">Instance polygons</option>
            <option value="mask">Mask polygons</option>
          </select>
        </label>

        <label className="block text-2xs text-muted-foreground">
          Model
          <select
            className="mira-input h-8 text-xs mt-1 w-full"
            value={settings.detectModel}
            onChange={(e) => patchSettings({ detectModel: e.target.value })}
          >
            {DEFAULT_DETECT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-2xs text-muted-foreground">
          Confidence ({Math.round(settings.detectConfidence * 100)}%)
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={settings.detectConfidence}
            onChange={(e) => patchSettings({ detectConfidence: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </label>

        <label className="block text-2xs text-muted-foreground">
          Class filter (optional)
          <input
            className="mira-input h-8 text-xs mt-1 w-full"
            placeholder="person, car, dog"
            value={settings.detectClasses}
            onChange={(e) => patchSettings({ detectClasses: e.target.value })}
          />
        </label>

        <label className="block text-2xs text-muted-foreground">
          SAM model
          <select
            className="mira-input h-8 text-xs mt-1 w-full"
            value={settings.segModel}
            onChange={(e) => patchSettings({ segModel: e.target.value })}
          >
            <option value="mobile_sam">Mobile SAM (fast)</option>
            <option value="sam_b">SAM Base (accurate)</option>
          </select>
        </label>

        <label className="block text-2xs text-muted-foreground">
          Pose model
          <select
            className="mira-input h-8 text-xs mt-1 w-full"
            value={settings.poseModel}
            onChange={(e) => patchSettings({ poseModel: e.target.value })}
          >
            <option value="yolov8n-pose">YOLOv8 Nano Pose</option>
            <option value="yolov8s-pose">YOLOv8 Small Pose</option>
          </select>
        </label>

        <label className="block text-2xs text-muted-foreground">
          Track confidence ({Math.round(settings.minTrackConfidence * 100)}%)
          <input
            type="range"
            min={0.05}
            max={0.9}
            step={0.05}
            value={settings.minTrackConfidence}
            onChange={(e) => patchSettings({ minTrackConfidence: Number(e.target.value) })}
            className="w-full mt-1"
          />
        </label>
        <label className="block text-2xs text-muted-foreground">
          Gap threshold (frames)
          <input
            type="number"
            min={3}
            max={60}
            className="mira-input h-8 text-xs mt-1 w-full"
            value={settings.gapThreshold}
            onChange={(e) => patchSettings({ gapThreshold: Number(e.target.value) || 8 })}
          />
        </label>

        <label className="flex items-center gap-2 text-2xs text-muted-foreground pt-1">
          <input
            type="checkbox"
            checked={settings.retainLowConfidence}
            onChange={(e) => patchSettings({ retainLowConfidence: e.target.checked })}
          />
          Retain low-confidence matches
        </label>
      </div>

      <div className="p-3 border-b border-border space-y-1 text-sm">
        <p className="mira-section-label mb-1">Smart tracking (Phase 17)</p>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50 text-xs flex items-center gap-2"
          disabled={busy}
          onClick={onSmartAnalysis}
        >
          <ScanSearch className="w-3.5 h-3.5" /> Analyze tracks
        </button>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50 text-xs flex items-center gap-2"
          disabled={busy || !videoReady || !selectedObjectId}
          onClick={onReTrack}
          title={selectedObjectId ? `Re-track ${selectedObjectId}` : 'Select an object first'}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-track selected
        </button>
        {needsReviewCount > 0 && (
          <label className="flex items-center gap-2 text-2xs text-amber-700 px-1 pt-1">
            <input type="checkbox" checked={showReviewOnly} onChange={(e) => setShowReviewOnly(e.target.checked)} />
            Review only ({needsReviewCount} flagged)
          </label>
        )}
      </div>

      <div className="p-3 border-b border-border space-y-1 text-sm">
        <p className="mira-section-label mb-1">AI actions</p>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
          disabled={busy || !videoReady}
          onClick={onSegmentMode}
        >
          Segment Object (SAM)
        </button>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
          disabled={busy || !videoReady}
          onClick={onDetect}
        >
          Detect Objects (YOLO)
        </button>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded-md hover:bg-accent disabled:opacity-50"
          disabled={busy || !videoReady}
          onClick={onPoseMode}
        >
          Generate Pose
        </button>
        <div className="flex gap-1 pt-1">
          <button
            type="button"
            className="flex-1 text-left px-2 py-1.5 rounded-md hover:bg-accent disabled:opacity-50 text-xs flex items-center gap-1"
            disabled={busy || !videoReady || !pending.some((s) => s.kind === 'detect')}
            onClick={onTrackForward}
            title="Track forward from current frame"
          >
            <ChevronRight className="w-3 h-3" /> Track →
          </button>
          <button
            type="button"
            className="flex-1 text-left px-2 py-1.5 rounded-md hover:bg-accent disabled:opacity-50 text-xs flex items-center gap-1"
            disabled={busy || !videoReady || !pending.some((s) => s.kind === 'detect')}
            onClick={onTrackBackward}
            title="Track backward from current frame"
          >
            <ChevronLeft className="w-3 h-3" /> ← Track
          </button>
        </div>
        {segPrompts.positive.length > 0 && (
          <p className="text-2xs text-muted-foreground px-1 pt-1">
            {segPrompts.positive.length} include · {segPrompts.negative.length} exclude — Enter to finish
          </p>
        )}
      </div>

      {status && (
        <div className="px-3 py-2 text-2xs text-muted-foreground border-b border-border bg-muted/30">{status}</div>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <p className="mira-section-label mb-0">
            Review ({pending.length}) · frame {currentFrame + 1}
          </p>
          {pending.length > 0 && (
            <button type="button" className="text-2xs text-brand-orange hover:underline" onClick={onAcceptAll}>
              Accept all
            </button>
          )}
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {pending.length === 0 && (
            <li className="text-xs text-muted-foreground px-2 py-4 text-center">No pending suggestions</li>
          )}
          {pending.map((s) => (
            <li
              key={s.id}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs',
                s.frame === currentFrame ? 'border-brand-orange/40 bg-brand-orange/5' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {s.kind === 'smart_hint' ? s.message.slice(0, 32) : s.class_name}
                </span>
                <span className="text-2xs text-muted-foreground shrink-0">
                  f{s.frame + 1}
                  {s.kind === 'detect' && (
                    <>
                      {' '}
                      · det {Math.round(s.confidence * 100)}%
                      {s.track_confidence != null && <> · trk {Math.round(s.track_confidence * 100)}%</>}
                    </>
                  )}
                  {s.kind === 'smart_hint' && <> · {Math.round(s.confidence * 100)}%</>}
                </span>
              </div>
              <p
                className={cn(
                  'text-2xs capitalize',
                  s.kind === 'detect' && s.needs_review && 'text-amber-700',
                  s.kind === 'smart_hint' && s.hint_type === 'id_switch' && 'text-red-600',
                  s.kind === 'smart_hint' && s.hint_type === 'reid' && 'text-violet-600',
                  !(s.kind === 'detect' && s.needs_review) &&
                    !(s.kind === 'smart_hint' && (s.hint_type === 'id_switch' || s.hint_type === 'reid')) &&
                    'text-muted-foreground',
                )}
              >
                {s.kind === 'smart_hint' ? s.hint_type.replace('_', ' ') : s.kind}
                {s.kind === 'detect' && s.suggestion_type === 'id_switch_suspect' && ' · ID switch?'}
                {s.kind === 'detect' && s.suggestion_type === 'low_confidence' && ' · low confidence'}
              </p>
              {s.kind === 'smart_hint' && (
                <p className="text-2xs text-muted-foreground truncate">{s.message}</p>
              )}
              <div className="flex gap-1 mt-1">
                <button
                  type="button"
                  className="flex-1 mira-btn-ghost h-6 text-2xs"
                  onClick={() => onAccept(s)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="flex-1 mira-btn-ghost h-6 text-2xs text-destructive"
                  onClick={() => onReject(s.id)}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-3 py-2 border-t border-border text-2xs text-muted-foreground">
          {fps.toFixed(1)} fps · max frame {maxFrame + 1}
        </div>
      </div>
    </aside>
  )
}
