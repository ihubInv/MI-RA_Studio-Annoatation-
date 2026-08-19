import { api } from './api'
import type { Project, PaginatedResponse } from '@/types/annotation.types'

export interface CreateProjectPayload {
  name: string
  description?: string
  organization_id?: string
}

export const projectsService = {
  list: async (page = 1, pageSize = 20): Promise<PaginatedResponse<Project>> => {
    const { data } = await api.get('/api/v1/projects/', { params: { page, page_size: pageSize } })
    return data
  },

  get: async (id: string): Promise<Project> => {
    const { data } = await api.get(`/api/v1/projects/${id}`)
    return data
  },

  create: async (payload: CreateProjectPayload): Promise<Project> => {
    const { data } = await api.post('/api/v1/projects/', payload)
    return data
  },

  update: async (id: string, payload: Partial<Project>): Promise<Project> => {
    const { data } = await api.patch(`/api/v1/projects/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/projects/${id}`)
  },
}
