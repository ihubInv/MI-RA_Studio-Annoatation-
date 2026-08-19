import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Filter, Plus, Search, Trash2, Upload } from 'lucide-react'
import { datasetsService } from '@/services/datasets.service'
import { projectsService } from '@/services/projects.service'
import { EmptyState } from '@/components/ui/EmptyState'
import { DatasetUploadModal } from '@/features/datasets/components/DatasetUploadModal'
import { StorageBadge } from '@/features/datasets/components/StorageBadge'
import type { Dataset, DatasetModality } from '@/types/annotation.types'

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-emerald-500',
  annotating: 'bg-brand-orange',
  draft: 'bg-muted-foreground',
}

export function DatasetsPage() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [modality, setModality] = useState<DatasetModality>('image')
  const [storageMode, setStorageMode] = useState<'local' | 'cloud' | 'server'>('local')
  const [cloudUri, setCloudUri] = useState('')
  const [projectId, setProjectId] = useState(routeProjectId || '')

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(1, 50),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['datasets', routeProjectId || 'all'],
    queryFn: () => datasetsService.list(routeProjectId, 1, 50),
  })

  const createMutation = useMutation({
    mutationFn: datasetsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] })
      setShowCreateModal(false)
      setName('')
      setDescription('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: datasetsService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['datasets'] }),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const pid = projectId || routeProjectId || projectsData?.items?.[0]?.id
    if (!pid) {
      alert('Create a project first')
      return
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      modality,
      project_id: pid,
      storage_mode: storageMode,
      cloud_uri: storageMode === 'cloud' ? cloudUri.trim() || undefined : undefined,
    })
  }

  const datasets = (data?.items ?? []).filter(
    (d: Dataset) =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.modality.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4 fade-enter">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xs text-muted-foreground mb-0.5">
            MI-RA Studio / Datasets{routeProjectId ? ' / Project' : ''}
          </p>
          <h1 className="text-xl font-semibold">Datasets</h1>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="mira-btn-primary">
          <Plus className="w-4 h-4" />
          Dataset
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search datasets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mira-input pl-8"
          />
        </div>
        <button className="mira-btn-ghost h-8">
          <Filter className="w-3.5 h-3.5" /> Filter
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white border border-border rounded-md divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <div className="bg-white border border-border rounded-md">
          <EmptyState
            title="No datasets yet"
            description="Create a dataset to store images, video, audio, LiDAR, or multimodal data."
            action={{ label: 'Create Dataset', onClick: () => setShowCreateModal(true) }}
          />
        </div>
      ) : (
        <div className="bg-white border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold w-8" />
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold">Dataset Name</th>
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold">Storage</th>
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold">Modality</th>
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold">Samples</th>
                <th className="text-left px-4 py-2.5 mira-section-label font-semibold">Status</th>
                <th className="text-right px-4 py-2.5 mira-section-label font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((dataset: Dataset) => (
                <tr key={dataset.id} className="mira-table-row">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded border-border" />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/datasets/${dataset.id}`} className="font-medium hover:text-primary">
                      {dataset.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StorageBadge mode={dataset.storage_mode} compact />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize text-xs">
                    {dataset.modality.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums">
                    {dataset.item_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[dataset.status] || STATUS_COLORS.draft}`}
                      />
                      {dataset.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link to={`/datasets/${dataset.id}`} className="text-xs text-primary hover:underline">
                        Open
                      </Link>
                      <button
                        onClick={() => {
                          setSelectedDatasetId(dataset.id)
                          setShowUploadModal(true)
                        }}
                        className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> {dataset.storage_mode === 'local' ? 'Attach' : 'Upload'}
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Delete dataset “${dataset.name}”? Metadata and annotations are removed. Local original files on your computer are not deleted.`,
                            )
                          ) {
                            deleteMutation.mutate(dataset.id)
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-md max-w-md w-full p-5 shadow-lg space-y-4 fade-enter">
            <h2 className="text-base font-semibold">Create Dataset</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              {!routeProjectId && (
                <div>
                  <label className="text-xs font-medium block mb-1">Project</label>
                  <select
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="mira-input"
                  >
                    <option value="">Select a project</option>
                    {(projectsData?.items ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium block mb-1">Dataset Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mira-input"
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Modality</label>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as DatasetModality)}
                  className="mira-input capitalize"
                >
                  {['image', 'video', 'audio', 'text', 'lidar', 'point_cloud', 'depth', 'multimodal'].map((m) => (
                    <option key={m} value={m}>
                      {m.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Storage</label>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { id: 'local', label: 'Local', hint: 'Files stay on this computer' },
                      { id: 'cloud', label: 'Cloud', hint: 'S3 / MinIO / GCS / Azure' },
                      { id: 'server', label: 'Server', hint: 'Stored on MI-RA Studio' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStorageMode(opt.id)}
                      className={`text-left border rounded-md px-2 py-1.5 ${
                        storageMode === opt.id ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className="text-2xs text-muted-foreground leading-tight">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              {storageMode === 'cloud' && (
                <div>
                  <label className="text-xs font-medium block mb-1">Cloud URI</label>
                  <input
                    type="text"
                    value={cloudUri}
                    onChange={(e) => setCloudUri(e.target.value)}
                    placeholder="s3://bucket/prefix"
                    className="mira-input"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-2.5 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="mira-btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="mira-btn-primary">
                  {createMutation.isPending ? 'Creating…' : 'Create Dataset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && selectedDatasetId && (
        <DatasetUploadModal
          datasetId={selectedDatasetId}
          storageMode={datasets.find((d: Dataset) => d.id === selectedDatasetId)?.storage_mode || 'server'}
          onClose={() => setShowUploadModal(false)}
          onDone={() => {
            queryClient.invalidateQueries({ queryKey: ['datasets'] })
            queryClient.invalidateQueries({ queryKey: ['dataset-tree', selectedDatasetId] })
            setShowUploadModal(false)
          }}
        />
      )}
    </div>
  )
}
