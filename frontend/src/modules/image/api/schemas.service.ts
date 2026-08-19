import { api } from '@/services/api'
import type { LabelSchema } from '../schema/labelStore'

export interface RemoteSchema {
  id: string
  name: string
  dataset_id?: string
  schema_definition: LabelSchema
}

export const schemasService = {
  getForDataset: async (datasetId: string): Promise<LabelSchema | null> => {
    try {
      const { data } = await api.get(`/api/v1/schemas/dataset/${datasetId}`)
      const def = data?.schema_definition
      if (def?.classes?.length) return { ...def, projectKey: datasetId, version: 1 }
      return null
    } catch (err: any) {
      if (err?.response?.status === 404) return null
      throw err
    }
  },

  saveForDataset: async (datasetId: string, schema: LabelSchema): Promise<RemoteSchema> => {
    const { data } = await api.put(`/api/v1/schemas/dataset/${datasetId}`, {
      ...schema,
      projectKey: datasetId,
      version: 1,
    })
    return data
  },
}
