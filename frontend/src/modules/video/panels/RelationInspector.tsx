import { ArrowDown, Trash2 } from 'lucide-react'
import { formatRelationRange, type VideoRelation } from '@/modules/video/relations/relationTypes'
import type { ObjectManagerEntry } from '@/modules/video/hooks/useVideoAnnotations'

interface Props {
  relation: VideoRelation
  maxFrame: number
  objectEntries: ObjectManagerEntry[]
  onChange: (patch: Partial<VideoRelation>) => void
  onDelete: () => void
}

export function RelationInspector({ relation, maxFrame, objectEntries, onChange, onDelete }: Props) {
  const tracks = objectEntries.map((e) => e.object_id)

  return (
    <div className="p-3 space-y-3 border-t border-border bg-teal-50/30">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-teal-900">Relationship</span>
        <button type="button" className="mira-btn-ghost h-7 w-7 p-0 text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-center py-2 px-2 bg-white rounded-md border border-border font-mono text-xs">
        <div>{relation.subject_object_id}</div>
        <ArrowDown className="w-3 h-3 mx-auto text-teal-600 my-1" />
        <div className="text-teal-700 font-semibold">{relation.label}</div>
        <ArrowDown className="w-3 h-3 mx-auto text-teal-600 my-1" />
        <div>{relation.object_object_id}</div>
      </div>
      <p className="text-2xs text-muted-foreground text-center">{formatRelationRange(relation)}</p>
      <label className="block text-2xs text-muted-foreground">
        Subject
        <select
          className="mira-input h-8 text-xs mt-1 w-full font-mono"
          value={relation.subject_object_id}
          onChange={(e) => onChange({ subject_object_id: e.target.value })}
        >
          {tracks.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>
      <label className="block text-2xs text-muted-foreground">
        Object
        <select
          className="mira-input h-8 text-xs mt-1 w-full font-mono"
          value={relation.object_object_id}
          onChange={(e) => onChange({ object_object_id: e.target.value })}
        >
          {tracks.filter((id) => id !== relation.subject_object_id).map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-2xs text-muted-foreground">
          Start
          <input
            type="number"
            min={0}
            max={maxFrame}
            className="mira-input h-8 text-xs mt-1 w-full font-mono"
            value={relation.frame}
            onChange={(e) => onChange({ frame: Math.min(maxFrame, Math.max(0, Number(e.target.value) || 0)) })}
          />
        </label>
        <label className="block text-2xs text-muted-foreground">
          End
          <input
            type="number"
            min={relation.frame}
            max={maxFrame}
            className="mira-input h-8 text-xs mt-1 w-full font-mono"
            value={relation.end_frame}
            onChange={(e) =>
              onChange({ end_frame: Math.min(maxFrame, Math.max(relation.frame, Number(e.target.value) || relation.frame)) })
            }
          />
        </label>
      </div>
    </div>
  )
}
