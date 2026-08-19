import { Plus, Trash2 } from 'lucide-react'
import type { SkeletonTemplate } from '@/modules/video/schema/skeletonTemplateStore'

interface Props {
  template: SkeletonTemplate
  onChange: (edges: [string, string][]) => void
}

export function SkeletonBuilder({ template, onChange }: Props) {
  const jointOptions = template.joints

  const addEdge = () => {
    if (jointOptions.length < 2) return
    onChange([...template.edges, [jointOptions[0].id, jointOptions[1].id]])
  }

  const updateEdge = (index: number, side: 0 | 1, jointId: string) => {
    const edges = template.edges.map((e, i) => {
      if (i !== index) return e
      const next: [string, string] = [...e]
      next[side] = jointId
      return next
    })
    onChange(edges)
  }

  const removeEdge = (index: number) => {
    onChange(template.edges.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-2xs text-muted-foreground uppercase">Bone connections</p>
        <button type="button" onClick={addEdge} className="mira-btn-ghost h-7 text-2xs" disabled={jointOptions.length < 2}>
          <Plus className="w-3 h-3 mr-1" /> Joint → Joint
        </button>
      </div>
      {template.edges.length === 0 ? (
        <p className="text-xs text-muted-foreground">No connections yet. Add joint → joint links.</p>
      ) : (
        <div className="space-y-2">
          {template.edges.map(([a, b], idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                className="mira-input h-7 text-xs flex-1"
                value={a}
                onChange={(e) => updateEdge(idx, 0, e.target.value)}
              >
                {jointOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">→</span>
              <select
                className="mira-input h-7 text-xs flex-1"
                value={b}
                onChange={(e) => updateEdge(idx, 1, e.target.value)}
              >
                {jointOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <button type="button" className="mira-btn-ghost h-7 w-7 p-0 text-destructive" onClick={() => removeEdge(idx)}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
