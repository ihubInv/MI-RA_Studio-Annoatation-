import { useCallback, useMemo, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Film, FolderUp, FileArchive, Images, Lock, Upload } from 'lucide-react'
import { datasetsService } from '@/services/datasets.service'
import { Modal } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/EmptyState'
import { importLocalDirectory, importLocalFiles, importLocalZip } from '@/features/datasets/local/registry'
import { supportsDirectoryPicker } from '@/features/datasets/local/fsAccess'
import type { UploadReject, ZipInspectReport } from '@/features/datasets/datasetTree.types'
import { VIDEO_ACCEPT, formatBytes } from '@/modules/video'
import type { DatasetModality } from '@/types/annotation.types'
import { cn } from '@/utils/cn'

interface Props {
  datasetId: string
  storageMode?: string
  modality?: DatasetModality | string
  onDone: () => void
  onClose: () => void
}

const IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'image/tiff': ['.tif', '.tiff'],
  'image/gif': ['.gif'],
  'application/zip': ['.zip'],
}

type FileRowStatus = 'pending' | 'uploading' | 'done' | 'error'

interface FileRow {
  name: string
  size: number
  status: FileRowStatus
  progress: number
  error?: string
}

export function DatasetUploadModal({
  datasetId,
  storageMode = 'local',
  modality = 'image',
  onDone,
  onClose,
}: Props) {
  const isVideo = modality === 'video' || modality === 'multimodal'
  const mediaLabel = isVideo ? 'videos' : 'images'
  const mediaLabelSingular = isVideo ? 'video' : 'image'
  const local = storageMode === 'local'
  const accept = useMemo(() => (isVideo ? VIDEO_ACCEPT : IMAGE_ACCEPT), [isVideo])

  const [tab, setTab] = useState<'files' | 'folder' | 'zip'>('folder')
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [report, setReport] = useState<ZipInspectReport | null>(null)
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [fileRows, setFileRows] = useState<FileRow[]>([])
  const [rejections, setRejections] = useState<UploadReject[]>([])
  const folderRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const zip = accepted.find((f) => f.name.toLowerCase().endsWith('.zip'))
    if (zip) {
      setTab('zip')
      setZipFile(zip)
      setFiles([])
      setReport(null)
      setFileRows([])
      return
    }
    setZipFile(null)
    setFiles(accepted)
    setReport(null)
    setFileRows(
      accepted.map((f) => ({
        name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        size: f.size,
        status: 'pending',
        progress: 0,
      })),
    )
    setTab(accepted.some((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath) ? 'folder' : 'files')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: tab === 'folder',
    accept,
    multiple: true,
  })

  const initFileRows = (batch: File[]) => {
    setFileRows(
      batch.map((f) => ({
        name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        size: f.size,
        status: 'pending',
        progress: 0,
      })),
    )
  }

  const runLocalFolder = async () => {
    setBusy(true)
    setError('')
    setPhase('Indexing local folder…')
    setProgress(30)
    try {
      if (supportsDirectoryPicker()) {
        const result = await importLocalDirectory(datasetId, modality, (pct, phaseText) => {
          setProgress(pct)
          setPhase(phaseText)
        })
        setProgress(100)
        setSummary(
          `Indexed ${result.total.toLocaleString()} ${mediaLabel} in ${result.folders} folders. Files stayed on this computer.`,
        )
        onDone()
        return
      }
      if (!files.length) throw new Error('Choose a folder first')
      initFileRows(files)
      const result = await importLocalFiles(datasetId, files, modality)
      setFileRows((rows) => rows.map((r) => ({ ...r, status: 'done', progress: 100 })))
      setProgress(100)
      setSummary(`Indexed ${result.total.toLocaleString()} ${mediaLabel} locally for this session.`)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Local folder import failed')
    } finally {
      setBusy(false)
    }
  }

  const runLocalZip = async () => {
    setBusy(true)
    setError('')
    setPhase('Reading ZIP locally…')
    setProgress(25)
    try {
      const result = await importLocalZip(datasetId, modality, zipFile || undefined)
      setProgress(100)
      setSummary(`Indexed ${result.total.toLocaleString()} ${mediaLabel} from ZIP. Archive was not uploaded.`)
      onDone()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Local ZIP import failed')
    } finally {
      setBusy(false)
    }
  }

  const inspectZip = async () => {
    if (!zipFile) return
    setBusy(true)
    setError('')
    setPhase('Uploading ZIP…')
    setProgress(20)
    try {
      const data = (await datasetsService.inspectZip(datasetId, zipFile)) as ZipInspectReport
      setReport(data)
      setPhase('Validation complete')
      setProgress(100)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'ZIP inspect failed')
    } finally {
      setBusy(false)
    }
  }

  const importZip = async () => {
    if (!report?.job_id) return
    setBusy(true)
    setError('')
    setPhase('Extracting and validating…')
    setProgress(40)
    try {
      const result = await datasetsService.importZip(datasetId, report.job_id)
      setRejections(result.rejections || [])
      setProgress(100)
      setPhase('Dataset ready')
      const rejected = result.rejected || 0
      setSummary(
        `Imported ${result.imported.toLocaleString()} ${mediaLabel}` +
          (rejected ? `. ${rejected} rejected (see errors below).` : '.'),
      )
      if (result.imported > 0) onDone()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'ZIP import failed')
    } finally {
      setBusy(false)
    }
  }

  const uploadPlain = async () => {
    if (!files.length) return
    setBusy(true)
    setError('')
    initFileRows(files)
    setRejections([])
    try {
      if (local) {
        const result = await importLocalFiles(datasetId, files, modality)
        setFileRows((rows) => rows.map((r) => ({ ...r, status: 'done', progress: 100 })))
        setSummary(`Indexed ${result.total.toLocaleString()} ${mediaLabel}.`)
        onDone()
        return
      }
      setFileRows((rows) => rows.map((r) => ({ ...r, status: 'uploading', progress: 10 })))
      const result = await datasetsService.uploadFiles(datasetId, files, (pct, done, total, p) => {
        setProgress(pct)
        setPhase(`${p || 'Uploading'} ${done}/${total}`)
        setFileRows((rows) =>
          rows.map((row, index) => ({
            ...row,
            status: index < done ? 'done' : index === done ? 'uploading' : 'pending',
            progress: index < done ? 100 : index === done ? Math.max(row.progress, pct) : 0,
          })),
        )
      })
      const rejected = result.rejected || []
      setRejections(rejected)
      const rejectedPaths = new Set(rejected.map((r) => r.path))
      setFileRows((rows) =>
        rows.map((row) => {
          const base = row.name.split('/').pop() || row.name
          const match = rejected.find((r) => r.path === row.name || r.path.endsWith(`/${base}`) || r.path === base)
          if (match) return { ...row, status: 'error', progress: 0, error: match.reason }
          if (rejectedPaths.has(row.name)) {
            return { ...row, status: 'error', progress: 0, error: rejected.find((r) => r.path === row.name)?.reason }
          }
          return { ...row, status: 'done', progress: 100 }
        }),
      )
      setProgress(100)
      setSummary(
        `Uploaded ${result.uploaded.toLocaleString()} ${mediaLabel}` +
          (rejected.length ? `. ${rejected.length} rejected.` : '.'),
      )
      if (result.uploaded > 0 || rejected.length === 0) onDone()
    } catch {
      setError(local ? 'Local import failed' : 'Upload failed')
      setFileRows((rows) => rows.map((r) => ({ ...r, status: r.status === 'done' ? 'done' : 'error' })))
    } finally {
      setBusy(false)
    }
  }

  const validZipCount = isVideo ? report?.valid_videos ?? report?.valid_count : report?.valid_images

  return (
    <Modal
      title={local ? 'Attach local dataset' : `Upload ${mediaLabelSingular} dataset`}
      subtitle={
        local
          ? 'Original files stay on this computer.'
          : `Import a ZIP, folder, or ${mediaLabelSingular} files.`
      }
      onClose={onClose}
      wide
    >
      {local && (
        <p className="text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200 rounded-md px-2 py-1.5 flex items-start gap-1.5 mb-3">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Local Dataset Mode: original files stay on this computer. Only folder names, file metadata, and annotations
          are sent to MI-RA Studio.
        </p>
      )}
      <div className="flex gap-1 bg-muted/40 p-0.5 rounded-md">
        {[
          { id: 'folder', label: 'Folder', icon: FolderUp },
          { id: 'zip', label: 'ZIP', icon: FileArchive },
          { id: 'files', label: isVideo ? 'Videos' : 'Images', icon: isVideo ? Film : Images },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={cn(
              'flex-1 h-8 text-xs rounded-md inline-flex items-center justify-center gap-1',
              tab === t.id ? 'bg-white/80 shadow-sm font-medium' : 'text-muted-foreground',
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'border border-dashed rounded-md p-4 text-center text-sm cursor-pointer',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-5 h-5 mx-auto mb-1 text-primary" />
        <p>{local ? 'Drop files here, or use the buttons below' : `Drop a ZIP, folder, or ${mediaLabel} here`}</p>
        <p className="text-2xs text-muted-foreground mt-1">
          {isVideo
            ? 'MP4, AVI, MOV, MKV, WebM, MPEG, WMV, FLV, TS, 3GP · folder structure is kept'
            : 'JPG, PNG, WEBP, BMP, TIFF · folder structure is kept'}
        </p>
      </div>

      {tab === 'folder' && (
        <div className="space-y-2">
          <input
            ref={folderRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is supported in Chromium
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files || [])
              setFiles(picked)
              initFileRows(picked)
            }}
          />
          {supportsDirectoryPicker() ? (
            <p className="text-xs text-muted-foreground">
              Chrome / Edge can keep a permissioned folder handle so you can reopen this dataset later.
            </p>
          ) : (
            <button type="button" className="mira-btn-ghost w-full" onClick={() => folderRef.current?.click()}>
              Choose folder
            </button>
          )}
          {files.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {files.length} {mediaLabel} from folder
            </p>
          )}
        </div>
      )}

      {tab === 'files' && files.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {files.length} {mediaLabel} selected
        </p>
      )}
      {tab === 'zip' && zipFile && <p className="text-xs text-muted-foreground truncate">ZIP: {zipFile.name}</p>}

      {fileRows.length > 0 && (
        <div className="border border-border rounded-md overflow-hidden max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left px-2 py-1.5 font-semibold">Name</th>
                <th className="text-left px-2 py-1.5 font-semibold w-16">Size</th>
                <th className="text-left px-2 py-1.5 font-semibold w-20">Status</th>
                <th className="text-left px-2 py-1.5 font-semibold w-16">Progress</th>
              </tr>
            </thead>
            <tbody>
              {fileRows.slice(0, 100).map((row) => (
                <tr key={row.name} className="border-t border-border/60">
                  <td className="px-2 py-1 truncate max-w-[220px]" title={row.error || row.name}>
                    {row.name.split('/').pop()}
                  </td>
                  <td className="px-2 py-1 tabular-nums">{formatBytes(row.size)}</td>
                  <td className="px-2 py-1 capitalize">
                    <span
                      className={cn(
                        row.status === 'done' && 'text-emerald-700',
                        row.status === 'error' && 'text-destructive',
                        row.status === 'uploading' && 'text-primary',
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2 py-1 tabular-nums">{row.status === 'done' ? '100%' : `${row.progress}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fileRows.length > 100 && (
            <p className="text-2xs text-muted-foreground px-2 py-1">+ {fileRows.length - 100} more files</p>
          )}
        </div>
      )}

      {report && !local && (
        <div className="border border-border rounded-md p-3 text-xs space-y-1 bg-muted/20">
          <p className="font-semibold mb-1">Dataset validation</p>
          <p>
            ✓ {(validZipCount ?? 0).toLocaleString()} valid {mediaLabel}
          </p>
          <p>✓ {report.folder_count} folders detected</p>
          {report.unsupported_count > 0 && (
            <p className="text-amber-700">⚠ {report.unsupported_count} unsupported files will be skipped</p>
          )}
        </div>
      )}

      {rejections.length > 0 && (
        <div className="border border-destructive/30 rounded-md p-3 text-xs space-y-1 bg-destructive/5 max-h-32 overflow-y-auto">
          <p className="font-semibold text-destructive mb-1">Rejected files</p>
          {rejections.slice(0, 20).map((r) => (
            <p key={r.path} className="text-destructive/90">
              <span className="font-medium">{r.path.split('/').pop()}:</span> {r.reason}
            </p>
          ))}
        </div>
      )}

      {busy && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{phase}</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {summary && <p className="text-xs text-emerald-700">{summary}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="mira-btn-ghost" disabled={busy}>
          Cancel
        </button>
        {tab === 'folder' && (
          <button type="button" className="mira-btn-primary" disabled={busy} onClick={local ? runLocalFolder : uploadPlain}>
            {local ? 'Index local folder' : 'Upload folder'}
          </button>
        )}
        {tab === 'zip' && local && (
          <button type="button" className="mira-btn-primary" disabled={busy} onClick={runLocalZip}>
            Index ZIP locally
          </button>
        )}
        {tab === 'zip' && !local && (
          report ? (
            <button type="button" className="mira-btn-primary" disabled={busy} onClick={importZip}>
              Import dataset
            </button>
          ) : (
            <button type="button" className="mira-btn-primary" disabled={busy || !zipFile} onClick={inspectZip}>
              Review ZIP
            </button>
          )
        )}
        {tab === 'files' && (
          <button type="button" className="mira-btn-primary" disabled={busy || files.length === 0} onClick={uploadPlain}>
            {local ? `Index ${files.length}` : `Upload ${files.length}`}
          </button>
        )}
      </div>
    </Modal>
  )
}
