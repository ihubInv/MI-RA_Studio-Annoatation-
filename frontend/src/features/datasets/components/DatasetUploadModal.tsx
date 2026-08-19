import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FolderUp, FileArchive, Images, Lock, Upload } from 'lucide-react'
import { datasetsService } from '@/services/datasets.service'
import { ProgressBar } from '@/components/ui/EmptyState'
import { importLocalDirectory, importLocalFiles, importLocalZip } from '@/features/datasets/local/registry'
import { supportsDirectoryPicker } from '@/features/datasets/local/fsAccess'
import type { ZipInspectReport } from '@/features/datasets/datasetTree.types'
import { cn } from '@/utils/cn'

interface Props {
  datasetId: string
  storageMode?: string
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

export function DatasetUploadModal({ datasetId, storageMode = 'local', onDone, onClose }: Props) {
  const local = storageMode === 'local'
  const [tab, setTab] = useState<'files' | 'folder' | 'zip'>('folder')
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [report, setReport] = useState<ZipInspectReport | null>(null)
  const [phase, setPhase] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const folderRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback((accepted: File[]) => {
    const zip = accepted.find((f) => f.name.toLowerCase().endsWith('.zip'))
    if (zip) {
      setTab('zip')
      setZipFile(zip)
      setFiles([])
      setReport(null)
      return
    }
    setZipFile(null)
    setFiles(accepted)
    setTab(accepted.some((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath) ? 'folder' : 'files')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: tab === 'folder',
    accept: IMAGE_ACCEPT,
    multiple: true,
  })

  const runLocalFolder = async () => {
    setBusy(true)
    setError('')
    setPhase('Indexing local folder…')
    setProgress(30)
    try {
      if (supportsDirectoryPicker()) {
      const result = await importLocalDirectory(datasetId, (pct, phase) => {
        setProgress(pct)
        setPhase(phase)
      })
        setProgress(100)
        setSummary(`Indexed ${result.total.toLocaleString()} images in ${result.folders} folders. Files stayed on this computer.`)
        onDone()
        return
      }
      if (!files.length) throw new Error('Choose a folder first')
      const result = await importLocalFiles(datasetId, files)
      setProgress(100)
      setSummary(`Indexed ${result.total.toLocaleString()} files locally for this session.`)
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Local folder import failed')
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
      const result = await importLocalZip(datasetId, zipFile || undefined)
      setProgress(100)
      setSummary(`Indexed ${result.total.toLocaleString()} images from ZIP. Archive was not uploaded.`)
      onDone()
    } catch (err: any) {
      setError(err?.message || 'Local ZIP import failed')
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
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ZIP inspect failed')
    } finally {
      setBusy(false)
    }
  }

  const importZip = async () => {
    if (!report?.job_id) return
    setBusy(true)
    setError('')
    setPhase('Extracting and indexing…')
    setProgress(40)
    try {
      await datasetsService.importZip(datasetId, report.job_id)
      setProgress(100)
      setPhase('Dataset ready')
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'ZIP import failed')
    } finally {
      setBusy(false)
    }
  }

  const uploadPlain = async () => {
    if (!files.length) return
    setBusy(true)
    setError('')
    try {
      if (local) {
        await importLocalFiles(datasetId, files)
        onDone()
        return
      }
      await datasetsService.uploadFiles(datasetId, files, (pct, done, total, p) => {
        setProgress(pct)
        setPhase(`${p || 'Uploading in parallel'} ${done}/${total}`)
      })
      onDone()
    } catch {
      setError(local ? 'Local import failed' : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-md max-w-lg w-full p-5 space-y-3 shadow-lg fade-enter max-h-[90vh] overflow-auto">
        <h2 className="text-base font-semibold">{local ? 'Attach local dataset' : 'Upload dataset'}</h2>
        {local && (
          <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5 flex items-start gap-1.5">
            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Local Dataset Mode: original files stay on this computer. Only folder names, file metadata, and annotations are sent to MI-RA Studio.
          </p>
        )}
        <div className="flex gap-1 bg-muted/40 p-0.5 rounded-md">
          {[
            { id: 'folder', label: 'Folder', icon: FolderUp },
            { id: 'zip', label: 'ZIP', icon: FileArchive },
            { id: 'files', label: 'Images', icon: Images },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                'flex-1 h-8 text-xs rounded-md inline-flex items-center justify-center gap-1',
                tab === t.id ? 'bg-white shadow-sm font-medium' : 'text-muted-foreground',
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
          <p>{local ? 'Drop files here, or use the buttons below' : 'Drop a ZIP, folder, or images here'}</p>
          <p className="text-2xs text-muted-foreground mt-1">JPG, PNG, WEBP, BMP, TIFF · folder structure is kept</p>
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
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {supportsDirectoryPicker() ? (
              <p className="text-xs text-muted-foreground">Chrome / Edge can keep a permissioned folder handle so you can reopen this dataset later.</p>
            ) : (
              <button type="button" className="mira-btn-ghost w-full" onClick={() => folderRef.current?.click()}>
                Choose folder
              </button>
            )}
            {files.length > 0 && <p className="text-xs text-muted-foreground">{files.length} files from folder</p>}
          </div>
        )}

        {tab === 'files' && files.length > 0 && (
          <p className="text-xs text-muted-foreground">{files.length} images selected</p>
        )}
        {tab === 'zip' && zipFile && (
          <p className="text-xs text-muted-foreground truncate">ZIP: {zipFile.name}</p>
        )}

        {report && !local && (
          <div className="border border-border rounded-md p-3 text-xs space-y-1 bg-muted/20">
            <p className="font-semibold mb-1">Dataset validation</p>
            <p>✓ {report.valid_images.toLocaleString()} valid images</p>
            <p>✓ {report.folder_count} folders detected</p>
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
      </div>
    </div>
  )
}
