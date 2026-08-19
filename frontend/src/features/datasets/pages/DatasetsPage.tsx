import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Box, Cloud, Combine, Database, FileAudio, Film, Filter, FolderOpen, HardDrive, Image, Layers, Plus, Search, Server, Trash2, Type, Upload } from 'lucide-react'
import { Field } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
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
        <div className="mira-panel rounded-md divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : datasets.length === 0 ? (
        <div className="mira-panel rounded-md">
          <EmptyState
            title="No datasets yet"
            description="Create a dataset to store images, video, audio, LiDAR, or multimodal data."
            action={{ label: 'Create Dataset', onClick: () => setShowCreateModal(true) }}
          />
        </div>
      ) : (
        <div className="mira-panel rounded-md overflow-hidden">
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
        <Modal
          title="Create Dataset"
          subtitle="Add a dataset to start annotating."
          onClose={() => setShowCreateModal(false)}
        >
            <form onSubmit={handleCreate} className="space-y-3.5">
              {!routeProjectId && (
                <Field label="Project">
                  <Select
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="Select a project"
                    options={(projectsData?.items ?? []).map((p) => ({
                      value: p.id,
                      label: p.name,
                      icon: FolderOpen,
                    }))}
                  />
                </Field>
              )}
              <Field label="Dataset Name" icon={Database}>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Street cameras"
                  className="mira-input"
                />
              </Field>
              <Field label="Modality">
                <Select
                  value={modality}
                  onChange={(v) => setModality(v as DatasetModality)}
                  options={[
                    { value: 'image', label: 'Image', icon: Image },
                    { value: 'video', label: 'Video', icon: Film },
                    { value: 'audio', label: 'Audio', icon: FileAudio },
                    { value: 'text', label: 'Text', icon: Type },
                    { value: 'lidar', label: 'LiDAR', icon: Box },
                    { value: 'point_cloud', label: 'Point cloud', icon: Layers },
                    { value: 'depth', label: 'Depth', icon: Layers },
                    { value: 'multimodal', label: 'Multimodal', icon: Combine },
                  ]}
                />
              </Field>
              <div>
                <label className="text-xs font-medium block mb-1.5">Storage</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'local', label: 'Local', hint: 'Stay on this computer', icon: HardDrive },
                      { id: 'cloud', label: 'Cloud', hint: 'S3 / MinIO / GCS', icon: Cloud },
                      { id: 'server', label: 'Server', hint: 'Stored on MI-RA', icon: Server },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStorageMode(opt.id)}
                      className={`mira-choice ${storageMode === opt.id ? 'mira-choice-active' : ''}`}
                    >
                      <opt.icon className="w-4 h-4 text-primary mb-1" />
                      <p className="text-xs font-semibold">{opt.label}</p>
                      <p className="text-2xs text-muted-foreground leading-tight">{opt.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              {storageMode === 'cloud' && (
                <Field label="Cloud URI" icon={Cloud}>
                  <input
                    type="text"
                    value={cloudUri}
                    onChange={(e) => setCloudUri(e.target.value)}
                    placeholder="s3://bucket/prefix"
                    className="mira-input"
                  />
                </Field>
              )}
              <div>
                <label className="text-xs font-medium block mb-1.5">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes…"
                  className="mira-textarea"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowCreateModal(false)} className="mira-btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="mira-btn-primary h-9 px-4">
                  {createMutation.isPending ? 'Creating…' : 'Create Dataset'}
                </button>
              </div>
            </form>
        </Modal>
      )}

      {showUploadModal && selectedDatasetId && (
        <DatasetUploadModal
          datasetId={selectedDatasetId}
          storageMode={datasets.find((d: Dataset) => d.id === selectedDatasetId)?.storage_mode || 'server'}
          modality={datasets.find((d: Dataset) => d.id === selectedDatasetId)?.modality || 'image'}
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
