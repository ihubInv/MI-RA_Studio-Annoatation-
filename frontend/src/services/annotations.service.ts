import { api } from './api'
import type { Annotation, AnnotationObject, PaginatedResponse } from '@/types/annotation.types'

export interface AnnotationObjectPayload {
  id?: string
  class_name: string
  tool_type: string
  geometry: Record<string, unknown>
  attributes?: Record<string, unknown>
  comment?: string
  is_locked?: boolean
  is_hidden?: boolean
  frame_index?: number
  is_keyframe?: boolean
  linked_object_id?: string
  link_relation?: string
  hierarchical_labels?: string[]
}

export interface SaveAnnotationPayload {
  item_id: string
  task_id?: string
  notes?: string
  objects: AnnotationObjectPayload[]
  metadata?: Record<string, unknown>
}

export interface AnnotationPreview {
  annotation_id: string
  status?: string
  object_count: number
  objects: AnnotationObjectPayload[]
}

export const annotationsService = {
  listForItem: async (itemId: string): Promise<PaginatedResponse<Annotation>> => {
    const { data } = await api.get('/api/v1/annotations/', { params: { item_id: itemId } })
    return data
  },

  latest: async (itemId: string): Promise<Annotation | null> => {
    try {
      const { data } = await api.get('/api/v1/annotations/latest', { params: { item_id: itemId } })
      return data
    } catch (err: any) {
      if (err?.response?.status === 404) return null
      throw err
    }
  },

  previewsForDataset: async (datasetId: string): Promise<Record<string, AnnotationPreview>> => {
    const { data } = await api.get('/api/v1/annotations/previews', { params: { dataset_id: datasetId } })
    return data.items || {}
  },

  create: async (payload: SaveAnnotationPayload): Promise<Annotation> => {
    const { data } = await api.post('/api/v1/annotations/', payload)
    return data
  },

  update: async (
    id: string,
    payload: { objects: AnnotationObjectPayload[]; notes?: string; metadata?: Record<string, unknown> },
  ): Promise<Annotation> => {
    const { data } = await api.patch(`/api/v1/annotations/${id}`, payload)
    return data
  },

  submit: async (id: string): Promise<Annotation> => {
    const { data } = await api.post(`/api/v1/annotations/${id}/submit`)
    return data
  },

  save: async (existingId: string | null, payload: SaveAnnotationPayload): Promise<Annotation> => {
    if (existingId) {
      return annotationsService.update(existingId, {
        objects: payload.objects,
        notes: payload.notes,
        metadata: payload.metadata,
      })
    }
    return annotationsService.create(payload)
  },
}

export type { AnnotationObject }
