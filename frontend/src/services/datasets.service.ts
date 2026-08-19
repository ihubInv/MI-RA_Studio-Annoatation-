import { api } from './api'
import type { Dataset, DatasetItem, PaginatedResponse } from '@/types/annotation.types'

const UPLOAD_BATCH_SIZE = 16
const UPLOAD_CONCURRENCY = 6

function chunkFiles<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

export const datasetsService = {
  list: async (projectId?: string, page = 1, pageSize = 20): Promise<PaginatedResponse<Dataset>> => {
    const { data } = await api.get('/api/v1/datasets/', {
      params: { page, page_size: pageSize, ...(projectId ? { project_id: projectId } : {}) },
    })
    return data
  },

  get: async (id: string): Promise<Dataset> => {
    const { data } = await api.get(`/api/v1/datasets/${id}`)
    return data
  },

  create: async (payload: {
    name: string
    modality: string
    project_id: string
    description?: string
    storage_mode?: 'local' | 'cloud' | 'server'
    cloud_uri?: string
  }): Promise<Dataset> => {
    const { data } = await api.post('/api/v1/datasets/', payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/datasets/${id}`)
  },

  stats: async (id: string) => {
    const { data } = await api.get(`/api/v1/datasets/${id}/stats`)
    return data
  },

  registerLocalFiles: async (
    datasetId: string,
    payload: {
      root_name?: string
      files: Array<{
        relative_path: string
        filename: string
        mime_type?: string
        file_size_bytes?: number
        last_modified_ms?: number
        width?: number
        height?: number
      }>
    },
  ) => {
    const { data } = await api.post(`/api/v1/datasets/${datasetId}/local/files`, payload)
    return data as { created: number; skipped: number; item_count: number; items: { id: string; relative_path: string }[] }
  },

  listItems: async (
    datasetId: string,
    page = 1,
    pageSize = 50,
    extra?: { folder?: string; recursive?: boolean; search?: string; status?: string; sort?: string },
  ): Promise<PaginatedResponse<DatasetItem>> => {
    const { data } = await api.get('/api/v1/dataset-items/', {
      params: {
        dataset_id: datasetId,
        page,
        page_size: pageSize,
        ...(extra?.folder != null ? { folder: extra.folder } : {}),
        ...(extra?.recursive === false ? { recursive: false } : {}),
        ...(extra?.search ? { search: extra.search } : {}),
        ...(extra?.status ? { status: extra.status } : {}),
        ...(extra?.sort ? { sort: extra.sort } : {}),
      },
    })
    return data
  },

  getItem: async (itemId: string): Promise<DatasetItem> => {
    const { data } = await api.get(`/api/v1/dataset-items/${itemId}`)
    return data
  },

  deleteItem: async (itemId: string): Promise<void> => {
    await api.delete(`/api/v1/dataset-items/${itemId}`)
  },

  tree: async (datasetId: string) => {
    const { data } = await api.get(`/api/v1/datasets/${datasetId}/tree`)
    return data
  },

  itemIndex: async (
    datasetId: string,
    extra?: { folder?: string; recursive?: boolean; status?: string; search?: string },
  ) => {
    const { data } = await api.get('/api/v1/dataset-items/index', {
      params: {
        dataset_id: datasetId,
        ...(extra?.folder != null ? { folder: extra.folder } : {}),
        ...(extra?.recursive === false ? { recursive: false } : {}),
        ...(extra?.status ? { status: extra.status } : {}),
        ...(extra?.search ? { search: extra.search } : {}),
      },
    })
    return data as {
      items: {
        id: string
        filename: string
        relative_path: string
        parent_folder: string
        status: string
        file_size_bytes?: number
      }[]
    }
  },

  bulk: async (payload: {
    dataset_id: string
    action: 'set_status' | 'delete_annotations' | 'delete_items'
    folder?: string | null
    recursive?: boolean
    item_ids?: string[]
    status?: string
  }) => {
    const { data } = await api.post('/api/v1/dataset-items/bulk', payload)
    return data as { updated: number }
  },

  inspectZip: async (datasetId: string, file: File) => {
    const form = new FormData()
    form.append('dataset_id', datasetId)
    form.append('file', file)
    const { data } = await api.post('/api/v1/uploads/zip/inspect', form, { timeout: 300_000 })
    return data
  },

  importZip: async (datasetId: string, jobId: string) => {
    const form = new FormData()
    form.append('dataset_id', datasetId)
    form.append('job_id', jobId)
    const { data } = await api.post('/api/v1/uploads/zip/import', form, { timeout: 30 * 60_000 })
    return data as {
      imported: number
      skipped_duplicates: number
      corrupted: number
      rejected?: number
      rejections?: { path: string; reason: string }[]
      item_count: number
      folder_count: number
    }
  },

  exportDataset: async (payload: {
    dataset_id: string
    format: string
    folder?: string | null
    include_images?: boolean
    item_ids?: string[]
  }) => {
    const { data } = await api.post('/api/v1/exports/', payload, { responseType: 'blob', timeout: 300_000 })
    const blob = data as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dataset-${payload.format}.zip`
    a.click()
    URL.revokeObjectURL(url)
  },

  uploadFiles: async (
    datasetId: string,
    files: File[],
    onProgress?: (pct: number, completed: number, total: number, phase?: string) => void,
  ) => {
    const batches = chunkFiles(files, UPLOAD_BATCH_SIZE)
    const total = files.length
    let completed = 0

    const results = await mapPool(batches, UPLOAD_CONCURRENCY, async (batch) => {
      const form = new FormData()
      form.append('dataset_id', datasetId)
      batch.forEach((file) => form.append('files', file))
      form.append(
        'relative_paths',
        JSON.stringify(
          batch.map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name),
        ),
      )

      const { data } = await api.post('/api/v1/uploads/', form, {
        timeout: 180_000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        transformRequest: [
          (body, headers) => {
            if (headers && typeof headers === 'object') {
              delete (headers as Record<string, unknown>)['Content-Type']
            }
            return body
          },
        ],
        onUploadProgress: (event) => {
          if (!onProgress || !event.total) return
          const batchRatio = event.loaded / event.total
          const live = Math.min(total, completed + Math.round(batch.length * batchRatio))
          onProgress(Math.round((live / total) * 100), Math.max(completed, Math.floor(live)), total, 'Uploading in parallel')
        },
      })

      completed += batch.length
      onProgress?.(Math.round((completed / total) * 100), completed, total, 'Indexing')
      return data as { uploaded: number; items: unknown[] }
    })

    return {
      uploaded: results.reduce((sum, r) => sum + (r?.uploaded ?? 0), 0),
      rejected: results.flatMap((r) => (r as { rejected?: { path: string; reason: string }[] })?.rejected ?? []),
      items: results.flatMap((r) => r?.items ?? []),
    }
  },
}
