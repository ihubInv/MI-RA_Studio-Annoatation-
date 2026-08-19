import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FolderInput,
  Image as ImageIcon,
  Pencil,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { datasetsService } from '@/services/datasets.service'
import { annotationsService } from '@/services/annotations.service'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnnotationOverlay, loadLabelSchema } from '@/modules/image'
import { DatasetExplorer, findFolder } from '@/features/datasets/components/DatasetExplorer'
import { DatasetUploadModal } from '@/features/datasets/components/DatasetUploadModal'
import { LocalThumb } from '@/features/datasets/components/LocalThumb'
import { StorageBadge } from '@/features/datasets/components/StorageBadge'
import { getLocalAccessState, reconnectDirectory } from '@/features/datasets/local/registry'
import { STATUS_META, type FolderNode } from '@/features/datasets/datasetTree.types'
import type { DatasetItem } from '@/types/annotation.types'
import { cn } from '@/utils/cn'

export function DatasetItemsPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [showOverlays, setShowOverlays] = useState(true)
  const [folder, setFolder] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState('path')
  const [recursive, setRecursive] = useState(true)
  const [page, setPage] = useState(1)
  const [exportFormat, setExportFormat] = useState('json')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [access, setAccess] = useState<'ready' | 'permission' | 'missing' | 'unsupported'>('ready')
  const [reconnectMsg, setReconnectMsg] = useState('')

  const { data: dataset } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => datasetsService.get(datasetId!),
    enabled: Boolean(datasetId),
  })
  const isLocal = (dataset?.storage_mode || 'server') === 'local'

  useEffect(() => {
    if (!datasetId || dataset?.storage_mode !== 'local') return
    getLocalAccessState(datasetId).then(setAccess)
  }, [datasetId, dataset?.storage_mode])

  const { data: treeData } = useQuery({
    queryKey: ['dataset-tree', datasetId],
    queryFn: () => datasetsService.tree(datasetId!),
    enabled: Boolean(datasetId),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['dataset-items', datasetId, folder, page, search, statusFilter, sort, recursive],
    queryFn: () =>
      datasetsService.listItems(datasetId!, page, 48, {
        folder: folder ?? undefined,
        recursive,
        search: search || undefined,
        status: statusFilter || undefined,
        sort,
      }),
    enabled: Boolean(datasetId),
  })

  const { data: previews } = useQuery({
    queryKey: ['annotation-previews', datasetId],
    queryFn: () => annotationsService.previewsForDataset(datasetId!),
    enabled: Boolean(datasetId),
  })

  const classColors = Object.fromEntries(
    loadLabelSchema(datasetId || 'default').classes.map((c) => [c.name, c.color]),
  )

  const deleteMutation = useMutation({
    mutationFn: datasetsService.deleteItem,
    onSuccess: () => refresh(),
  })

  const deleteDatasetMutation = useMutation({
    mutationFn: datasetsService.delete,
    onSuccess: () => navigate('/datasets'),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dataset-items', datasetId] })
    queryClient.invalidateQueries({ queryKey: ['dataset-tree', datasetId] })
    queryClient.invalidateQueries({ queryKey: ['annotation-previews', datasetId] })
    queryClient.invalidateQueries({ queryKey: ['datasets'] })
  }

  const items = data?.items ?? []
  const tree: FolderNode | undefined = treeData?.tree
  const summary = treeData?.summary
  const folderStats = tree ? findFolder(tree, folder) : null
  const pages = data?.pages ?? 1

  const bulk = async (action: 'set_status' | 'delete_annotations' | 'delete_items', status?: string) => {
    if (!datasetId) return
    await datasetsService.bulk({
      dataset_id: datasetId,
      action,
      folder,
      recursive,
      item_ids: selectedIds.length ? selectedIds : undefined,
      status,
    })
    setSelectedIds([])
    refresh()
  }

  const stats = useMemo(
    () => [
      { label: 'Storage', value: (dataset?.storage_mode || 'server').toUpperCase() },
      { label: 'Images', value: summary?.image_count ?? dataset?.item_count ?? 0 },
      { label: 'Folders', value: summary?.folders ?? 0 },
      { label: 'Annotated', value: summary?.completed ?? 0 },
      { label: 'Remaining', value: summary?.remaining ?? 0 },
      { label: 'Progress', value: `${summary?.progress ?? 0}%` },
      { label: 'Classes', value: summary?.classes ?? 0 },
      { label: 'Annotations', value: summary?.annotations ?? 0 },
    ],
    [summary, dataset],
  )

  return (
    <div className="space-y-4 fade-enter">
      <div className="flex items-center justify-between gap-3">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Datasets
          </button>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            {dataset?.name ?? 'Dataset'}
            <StorageBadge mode={dataset?.storage_mode} />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {folder || 'All folders'} · structured dataset explorer
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLocal && (
            <button
              className="mira-btn-ghost"
              onClick={async () => {
                if (!datasetId) return
                try {
                  const result = await reconnectDirectory(datasetId)
                  setReconnectMsg(`Matched ${result.matched} · changed ${result.changed} · missing ${result.missing}`)
                  setAccess('ready')
                } catch (err: any) {
                  setReconnectMsg(err?.message || 'Reconnect failed')
                }
              }}
            >
              <FolderInput className="w-4 h-4" /> Reconnect
            </button>
          )}
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="mira-input h-8 text-xs w-28"
          >
            {['json', 'coco', 'yolo', 'voc', 'labelme', 'csv'].map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            className="mira-btn-ghost"
            onClick={() => datasetId && datasetsService.exportDataset({ dataset_id: datasetId, format: exportFormat, folder })}
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setShowOverlays((v) => !v)}
            className={cn('mira-btn-ghost', showOverlays && 'text-primary')}
          >
            {showOverlays ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Labels
          </button>
          <button onClick={() => setShowUpload(true)} className="mira-btn-primary">
            <Upload className="w-4 h-4" />
            {isLocal ? 'Attach local dataset' : 'Upload ZIP / folder'}
          </button>
          <button
            className="mira-btn-ghost text-destructive"
            onClick={() => {
              if (
                confirm(
                  `Delete dataset “${dataset?.name}”? Metadata and annotations are removed. Local original files stay on your computer.`,
                )
              ) {
                datasetId && deleteDatasetMutation.mutate(datasetId)
              }
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete dataset
          </button>
        </div>
      </div>

      {isLocal && (dataset?.item_count ?? 0) > 0 && access !== 'ready' && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm">
          <p className="font-medium">Local dataset access required</p>
          <p className="text-xs text-muted-foreground mt-1">
            MI-RA Studio cannot currently read the original files. Select the original dataset folder to continue. Files are not uploaded.
          </p>
          <button
            className="mira-btn-primary mt-2 text-xs h-8"
            onClick={async () => {
              if (!datasetId) return
              try {
                const result = await reconnectDirectory(datasetId)
                setReconnectMsg(`Matched ${result.matched} · changed ${result.changed} · missing ${result.missing}`)
                setAccess('ready')
              } catch (err: unknown) {
                setReconnectMsg(err instanceof Error ? err.message : 'Reconnect failed')
              }
            }}
          >
            Select dataset folder
          </button>
        </div>
      )}
      {reconnectMsg && <p className="text-xs text-muted-foreground">{reconnectMsg}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-md px-3 py-2">
            <p className="text-2xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-semibold tabular-nums">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
          </div>
        ))}
      </div>

      {folderStats && folder && (
        <div className="bg-white border border-border rounded-md px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1">
          <span className="font-medium">{folderStats.path}</span>
          <span>Total {folderStats.image_count}</span>
          <span className="text-emerald-700">Completed {folderStats.completed + folderStats.approved}</span>
          <span className="text-amber-700">In progress {folderStats.in_progress}</span>
          <span className="text-slate-600">Not annotated {folderStats.not_annotated}</span>
          <span>Progress {folderStats.progress}%</span>
        </div>
      )}

      <div className="flex min-h-[560px] border border-border rounded-md overflow-hidden bg-white">
        <aside className="w-64 shrink-0 border-r border-border overflow-auto p-2">
          <p className="mira-section-label px-2 py-1">Dataset explorer</p>
          {tree ? (
            <DatasetExplorer
              node={tree}
              selectedPath={folder}
              onSelect={(path) => {
                setFolder(path)
                setPage(1)
              }}
              expanded={expanded}
              onToggle={(path) => setExpanded((e) => ({ ...e, [path]: e[path] === false }))}
            />
          ) : (
            <p className="text-xs text-muted-foreground px-2">No folders yet</p>
          )}
          <div className="mt-3 px-2 space-y-1 text-2xs text-muted-foreground">
            <p><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" /> Completed</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" /> In progress</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-slate-300 mr-1" /> Not annotated</p>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="p-2 border-b border-border flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Search filename…"
                className="mira-input h-8 pl-7 text-xs"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="mira-input h-8 text-xs w-36"
            >
              <option value="">All statuses</option>
              <option value="ready">Not annotated</option>
              <option value="annotating">In progress</option>
              <option value="annotated">Completed</option>
              <option value="in_review">Needs review</option>
              <option value="approved">Approved</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="mira-input h-8 text-xs w-28">
              <option value="path">Path</option>
              <option value="name">Name</option>
              <option value="date">Date</option>
              <option value="status">Status</option>
            </select>
            <label className="text-2xs flex items-center gap-1">
              <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} />
              Subfolders
            </label>
            <button className="mira-btn-ghost text-2xs h-8" onClick={() => bulk('set_status', 'in_review')}>
              Mark review
            </button>
            <button className="mira-btn-ghost text-2xs h-8" onClick={() => bulk('delete_annotations')}>
              Clear labels
            </button>
            {selectedIds.length > 0 && (
              <button
                className="mira-btn-ghost text-2xs h-8 text-destructive"
                onClick={() => {
                  if (confirm(`Delete ${selectedIds.length} selected image(s) from this dataset? Local original files are not deleted.`)) {
                    bulk('delete_items')
                  }
                }}
              >
                <Trash2 className="w-3 h-3" /> Delete selected ({selectedIds.length})
              </button>
            )}
            {folder && items.length > 0 && (
              <Link
                to={`/annotate/${items[0].id}?folder=${encodeURIComponent(folder)}`}
                className="mira-btn-primary text-2xs h-8"
              >
                Annotate folder
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="aspect-square bg-muted/40 border border-border rounded-md animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="No images in this folder"
                description={
                  isLocal
                    ? 'Attach a local folder, ZIP, or images. Original files stay on this computer.'
                    : 'Upload a ZIP or folder to keep the original dataset structure.'
                }
                action={{
                  label: isLocal ? 'Attach local dataset' : 'Upload ZIP / folder',
                  onClick: () => setShowUpload(true),
                }}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {items.map((item: DatasetItem) => {
                  const overlay = previews?.[item.id]
                  const count = overlay?.object_count ?? 0
                  const preview = count > 0 ? item.media_url || item.thumbnail_url : item.thumbnail_url || item.media_url
                  const isImage = (item.mime_type || '').startsWith('image/')
                  const meta = STATUS_META[item.status] || STATUS_META.ready
                  const checked = selectedIds.includes(item.id)
                  const href = folder
                    ? `/annotate/${item.id}?folder=${encodeURIComponent(folder)}`
                    : `/annotate/${item.id}`
                  return (
                    <div
                      key={item.id}
                      className="group bg-white border border-border rounded-md overflow-hidden hover:border-primary/40"
                    >
                      <div className="relative">
                        <label className="absolute top-1 right-1 z-10">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedIds((ids) =>
                                e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </label>
                        <Link to={href} className="block aspect-square bg-workspace relative">
                          {isLocal || item.is_local ? (
                            <LocalThumb
                              datasetId={item.dataset_id}
                              relativePath={item.relative_path || item.original_filename || item.filename}
                              fallback={item.thumbnail_url || item.media_url}
                              alt={item.original_filename || item.filename}
                            />
                          ) : isImage && preview ? (
                            <img
                              src={preview}
                              alt={item.original_filename || item.filename}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                          )}
                          {showOverlays && overlay && count > 0 && (
                            <AnnotationOverlay
                              objects={overlay.objects}
                              width={item.width || 1}
                              height={item.height || 1}
                              colors={classColors}
                            />
                          )}
                          <span className={cn('absolute top-1 left-1 text-2xs px-1.5 py-0.5 rounded bg-white/90', meta.text)}>
                            <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', meta.dot)} />
                            {meta.label}
                          </span>
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-primary/10">
                            <span className="text-primary text-xs font-medium flex items-center gap-1 bg-white/90 px-2 py-1 rounded-md">
                              <Pencil className="w-3 h-3" /> Annotate
                            </span>
                          </div>
                        </Link>
                      </div>
                      <div className="p-1.5 flex items-start justify-between gap-1">
                        <p
                          className="text-2xs truncate flex-1"
                          title={item.relative_path || item.original_filename || item.filename}
                        >
                          {item.relative_path || item.original_filename || item.filename}
                        </p>
                        <button
                          onClick={() => {
                            if (confirm('Delete this file?')) deleteMutation.mutate(item.id)
                          }}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {pages > 1 && (
            <div className="p-2 border-t border-border flex items-center justify-center gap-2 text-xs">
              <button className="mira-btn-ghost h-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              Page {page} / {pages}
              <button className="mira-btn-ghost h-7" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showUpload && datasetId && (
        <DatasetUploadModal
          datasetId={datasetId}
          storageMode={dataset?.storage_mode || 'local'}
          onClose={() => setShowUpload(false)}
          onDone={() => {
            setShowUpload(false)
            refresh()
          }}
        />
      )}
    </div>
  )
}
