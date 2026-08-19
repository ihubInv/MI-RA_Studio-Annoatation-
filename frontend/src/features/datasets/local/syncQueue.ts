import { annotationsService, type SaveAnnotationPayload } from '@/services/annotations.service'
import { localDb } from './idb'

export type SyncState = 'saved' | 'synced' | 'syncing' | 'pending'

export async function saveAnnotationLocalFirst(
  existingId: string | null,
  payload: SaveAnnotationPayload,
): Promise<{ annotation: Awaited<ReturnType<typeof annotationsService.save>> | null; state: SyncState }> {
  await localDb.putDraft(payload.item_id, { existingId, payload })
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await localDb.enqueue({ id: crypto.randomUUID(), type: 'save', payload: { existingId, payload } })
    return { annotation: null, state: 'pending' }
  }
  try {
    const annotation = await annotationsService.save(existingId, payload)
    await localDb.deleteDraft(payload.item_id)
    return { annotation, state: 'synced' }
  } catch {
    await localDb.enqueue({ id: crypto.randomUUID(), type: 'save', payload: { existingId, payload } })
    return { annotation: null, state: 'pending' }
  }
}

export async function flushSyncQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  const rows = await localDb.allQueue()
  for (const row of rows) {
    try {
      if (row.type === 'save') {
        const { existingId, payload } = row.payload
        await annotationsService.save(existingId, payload)
        await localDb.deleteDraft(payload.item_id)
      }
      await localDb.deleteQueue(row.id)
    } catch {
      break
    }
  }
}

export function listenOnlineFlush() {
  const onOnline = () => {
    flushSyncQueue().catch(() => undefined)
  }
  window.addEventListener('online', onOnline)
  return () => window.removeEventListener('online', onOnline)
}
