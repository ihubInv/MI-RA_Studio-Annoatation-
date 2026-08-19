import { api } from '@/services/api'

export const qaService = {
  list: async (itemId?: string) => {
    const { data } = await api.get('/api/v1/qa/', { params: itemId ? { item_id: itemId } : undefined })
    return data as { total: number; items: Array<{ id: string; score: number; issues: unknown[]; created_at?: string }> }
  },
  run: async (itemId: string, fps = 30) => {
    const { data } = await api.post('/api/v1/qa/run', { item_id: itemId, fps })
    return data as { id: string; score: number; errors: number; warnings: number; issues: unknown[] }
  },
  markGold: async (itemId: string, annotationId: string) => {
    const { data } = await api.post('/api/v1/qa/gold', { item_id: itemId, annotation_id: annotationId })
    return data
  },
  listGold: async (itemId?: string) => {
    const { data } = await api.get('/api/v1/qa/gold', { params: itemId ? { item_id: itemId } : undefined })
    return data as { items: Array<{ id: string; item_id: string; annotation_id: string }> }
  },
  consensus: async (itemId: string) => {
    const { data } = await api.post(`/api/v1/qa/consensus/${itemId}`)
    return data as { annotation_id: string; merged_objects: number; annotators: number }
  },
}

export const reviewsService = {
  list: async (params?: { item_id?: string; annotation_id?: string }) => {
    const { data } = await api.get('/api/v1/reviews/', { params })
    return data as { items: Array<{ id: string; status: string; comment?: string }> }
  },
  create: async (annotationId: string, comment?: string) => {
    const { data } = await api.post('/api/v1/reviews/', { annotation_id: annotationId, status: 'in_review', comment })
    return data as { id: string; status: string }
  },
  approve: async (reviewId: string) => {
    const { data } = await api.post(`/api/v1/reviews/${reviewId}/approve`)
    return data
  },
  reject: async (reviewId: string) => {
    const { data } = await api.post(`/api/v1/reviews/${reviewId}/reject`)
    return data
  },
}

export const assignmentsService = {
  list: async () => {
    const { data } = await api.get('/api/v1/assignments/')
    return data as { items: Array<{ id: string; task_id: string; assignee_id: string; status: string }> }
  },
  create: async (payload: { assignee_id: string; project_id?: string; dataset_id?: string; item_ids?: string[]; name?: string }) => {
    const { data } = await api.post('/api/v1/assignments/', payload)
    return data
  },
}

export const analyticsService = {
  overview: async () => {
    const { data } = await api.get('/api/v1/analytics/overview')
    return data as {
      videos: number
      items: number
      datasets: number
      annotations: number
      objects: number
      total_frames: number
      qa_results: number
      reviews: number
      tasks: number
    }
  },
}
