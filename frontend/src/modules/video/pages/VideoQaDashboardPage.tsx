import { useEffect, useMemo, useState } from 'react'
import { loadAnnotationStore } from '@/modules/video/canvas/annotationStorage'
import { qaSummary, runAllQa } from '@/modules/video/qa/validateAnnotations'
import { qaService } from '@/services/studioOps.service'

export function VideoQaDashboardPage() {
  const rows = useMemo(() => {
    const out: { itemId: string; errors: number; warnings: number; total: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith('mira.video.annotations.')) continue
      const itemId = k.slice('mira.video.annotations.'.length)
      const store = loadAnnotationStore(itemId)
      const issues = runAllQa(store, 30)
      const s = qaSummary(issues)
      out.push({ itemId, errors: s.errors, warnings: s.warnings, total: s.total })
    }
    return out.sort((a, b) => b.errors - a.errors)
  }, [])
  const [server, setServer] = useState<{ total: number; items: Array<{ id: string; score: number; issues: unknown[]; created_at?: string }> } | null>(null)

  useEffect(() => {
    qaService.list().then(setServer).catch(() => setServer(null))
  }, [])

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-lg font-semibold mb-1">Quality assurance</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Server QA runs plus local checks (labels, geometry, tracks, masks, jumps, confidence).
      </p>
      {server && (
        <div className="mb-6 rounded-lg border p-3 text-sm">
          <p className="font-medium">{server.total} server QA result(s)</p>
          <ul className="mt-2 space-y-1 text-xs">
            {server.items.slice(0, 12).map((r) => (
              <li key={r.id} className="font-mono">
                score {Math.round((r.score ?? 0) * 100)}% · {Array.isArray(r.issues) ? r.issues.length : 0} issues
              </li>
            ))}
          </ul>
        </div>
      )}
      <table className="w-full text-sm border rounded overflow-hidden">
        <thead className="bg-muted/40">
          <tr>
            <th className="text-left p-2">Item</th>
            <th className="text-right p-2">Errors</th>
            <th className="text-right p-2">Warnings</th>
            <th className="text-right p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.itemId} className="border-t">
              <td className="p-2 font-mono text-xs">{r.itemId}</td>
              <td className="p-2 text-right text-destructive">{r.errors}</td>
              <td className="p-2 text-right">{r.warnings}</td>
              <td className="p-2 text-right">{r.total}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="p-4 text-muted-foreground text-sm">No local video annotations yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
