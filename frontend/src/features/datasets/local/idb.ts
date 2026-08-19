/** Lightweight IndexedDB helpers for local-first datasets. */

const DB_NAME = 'mira-local'
const DB_VERSION = 1

type StoreName = 'handles' | 'thumbs' | 'drafts' | 'syncQueue' | 'meta'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles', { keyPath: 'datasetId' })
      if (!db.objectStoreNames.contains('thumbs')) db.createObjectStore('thumbs', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'itemId' })
      if (!db.objectStoreNames.contains('syncQueue')) db.createObjectStore('syncQueue', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'datasetId' })
    }
  })
}

async function withStore<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const s = tx.objectStore(store)
    const req = fn(s)
    tx.onerror = () => reject(tx.error)
    if (req) {
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    } else {
      tx.oncomplete = () => resolve(undefined as T)
    }
  })
}

export interface LocalHandleRecord {
  datasetId: string
  kind: 'directory' | 'zip'
  handle: FileSystemHandle
  rootName: string
  grantedAt: number
}

export interface LocalMetaRecord {
  datasetId: string
  rootName: string
  kind: 'directory' | 'zip' | 'files'
  fileCount: number
}

export const localDb = {
  putHandle: (row: LocalHandleRecord) => withStore('handles', 'readwrite', (s) => s.put(row)),
  getHandle: (datasetId: string) => withStore<LocalHandleRecord | undefined>('handles', 'readonly', (s) => s.get(datasetId)),
  putMeta: (row: LocalMetaRecord) => withStore('meta', 'readwrite', (s) => s.put(row)),
  getMeta: (datasetId: string) => withStore<LocalMetaRecord | undefined>('meta', 'readonly', (s) => s.get(datasetId)),
  putThumb: (key: string, blob: Blob) => withStore('thumbs', 'readwrite', (s) => s.put({ key, blob, at: Date.now() })),
  getThumb: async (key: string) => {
    const row = await withStore<{ key: string; blob: Blob } | undefined>('thumbs', 'readonly', (s) => s.get(key))
    return row?.blob
  },
  putDraft: (itemId: string, payload: unknown) =>
    withStore('drafts', 'readwrite', (s) => s.put({ itemId, payload, updatedAt: Date.now() })),
  getDraft: async (itemId: string) => {
    const row = await withStore<{ payload: unknown } | undefined>('drafts', 'readonly', (s) => s.get(itemId))
    return row?.payload
  },
  deleteDraft: (itemId: string) => withStore('drafts', 'readwrite', (s) => s.delete(itemId)),
  enqueue: (row: { id: string; type: string; payload: unknown }) =>
    withStore('syncQueue', 'readwrite', (s) => s.put({ ...row, createdAt: Date.now() })),
  allQueue: () =>
    withStore<Array<{ id: string; type: string; payload: any }>>('syncQueue', 'readonly', (s) => s.getAll()),
  deleteQueue: (id: string) => withStore('syncQueue', 'readwrite', (s) => s.delete(id)),
}
