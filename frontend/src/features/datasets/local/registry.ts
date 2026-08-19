import { datasetsService } from '@/services/datasets.service'
import { localDb } from './idb'
import {
  ensurePermission,
  fileFromDirectory,
  mapPool,
  persistDirectoryHandle,
  persistZipHandle,
  pickDirectory,
  pickZipFile,
  rememberSessionFiles,
  rememberSessionZip,
  sessionFile,
  sessionHasFiles,
  sessionZip,
  walkDirectory,
  type WalkedFile,
} from './fsAccess'
import { listZipImages, readZipEntry, zipFolderCount } from './zipLocal'

export type LocalAccessState = 'ready' | 'permission' | 'missing' | 'unsupported'

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    bmp: 'image/bmp',
    gif: 'image/gif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
  }
  return map[ext || ''] || 'application/octet-stream'
}

async function registerBatch(
  datasetId: string,
  files: WalkedFile[],
  rootName: string,
  onProgress?: (done: number, total: number) => void,
) {
  const chunk = 400
  const slices: WalkedFile[][] = []
  for (let i = 0; i < files.length; i += chunk) slices.push(files.slice(i, i + chunk))
  let created = 0
  let done = 0
  await mapPool(slices, 4, async (slice) => {
    const res = await datasetsService.registerLocalFiles(datasetId, {
      root_name: rootName,
      files: slice.map((f) => ({
        relative_path: f.relativePath,
        filename: f.name,
        mime_type: f.type || guessMime(f.name),
        file_size_bytes: f.size,
        last_modified_ms: f.lastModified,
      })),
    })
    created += res.created
    done += slice.length
    onProgress?.(done, files.length)
  })
  return created
}

export async function importLocalDirectory(
  datasetId: string,
  onProgress?: (pct: number, phase: string) => void,
) {
  const handle = await pickDirectory()
  const ok = await ensurePermission(handle)
  if (!ok) throw new Error('Folder permission was not granted')
  await persistDirectoryHandle(datasetId, handle)
  onProgress?.(12, 'Scanning folders in parallel…')
  const files = await walkDirectory(handle)
  await localDb.putMeta({ datasetId, rootName: handle.name, kind: 'directory', fileCount: files.length })
  onProgress?.(28, `Indexing ${files.length.toLocaleString()} files…`)
  const created = await registerBatch(datasetId, files, handle.name, (done, total) => {
    onProgress?.(28 + Math.round((done / Math.max(total, 1)) * 70), `Indexing ${done}/${total}`)
  })
  onProgress?.(100, 'Ready')
  return { created, total: files.length, folders: new Set(files.map((f) => f.relativePath.split('/').slice(0, -1).join('/')).filter(Boolean)).size, rootName: handle.name }
}

export async function importLocalZip(datasetId: string, file?: File) {
  let zipFile = file
  let handle: FileSystemFileHandle | null = null
  if (!zipFile && 'showOpenFilePicker' in window) {
    handle = await pickZipFile()
    zipFile = await handle.getFile()
    await persistZipHandle(datasetId, handle)
  }
  if (!zipFile) throw new Error('No ZIP selected')
  rememberSessionZip(datasetId, zipFile)
  const entries = await listZipImages(zipFile)
  await localDb.putMeta({
    datasetId,
    rootName: zipFile.name.replace(/\.zip$/i, ''),
    kind: 'zip',
    fileCount: entries.length,
  })
  const created = await registerBatch(
    datasetId,
    entries.map((e) => ({
      relativePath: e.relativePath,
      name: e.name,
      size: e.size,
      lastModified: e.lastModified,
      type: guessMime(e.name),
    })),
    zipFile.name.replace(/\.zip$/i, ''),
  )
  return {
    created,
    total: entries.length,
    folders: zipFolderCount(entries),
    rootName: zipFile.name.replace(/\.zip$/i, ''),
    duplicates: 0,
  }
}

export async function importLocalFiles(datasetId: string, files: File[]) {
  rememberSessionFiles(datasetId, files)
  const walked: WalkedFile[] = files
    .map((file) => {
      const rel = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/')
      return {
        relativePath: rel,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || guessMime(file.name),
      }
    })
    .filter((f) => /\.(jpe?g|png|webp|bmp|gif|tif|tiff)$/i.test(f.name))
  await localDb.putMeta({ datasetId, rootName: 'files', kind: 'files', fileCount: walked.length })
  const created = await registerBatch(datasetId, walked, 'files')
  return { created, total: walked.length, folders: new Set(walked.map((f) => f.relativePath.split('/').slice(0, -1).join('/')).filter(Boolean)).size }
}

export async function getLocalAccessState(datasetId: string): Promise<LocalAccessState> {
  if (sessionHasFiles(datasetId)) return 'ready'
  const rec = await localDb.getHandle(datasetId)
  if (!rec) return 'missing'
  try {
    const ok = await ensurePermission(rec.handle)
    return ok ? 'ready' : 'permission'
  } catch {
    return 'missing'
  }
}

export async function getLocalBlob(datasetId: string, relativePath: string): Promise<Blob> {
  const session = sessionFile(datasetId, relativePath)
  if (session) return session
  const zipFromSession = sessionZip(datasetId)
  if (zipFromSession) return readZipEntry(zipFromSession, relativePath)
  const rec = await localDb.getHandle(datasetId)
  if (!rec) throw new Error('LOCAL_DATASET_MISSING')
  const ok = await ensurePermission(rec.handle)
  if (!ok) throw new Error('LOCAL_DATASET_PERMISSION')
  if (rec.kind === 'directory') {
    return fileFromDirectory(rec.handle as FileSystemDirectoryHandle, relativePath)
  }
  const zipFile = await (rec.handle as FileSystemFileHandle).getFile()
  rememberSessionZip(datasetId, zipFile)
  return readZipEntry(zipFile, relativePath)
}

export async function reconnectDirectory(datasetId: string) {
  const handle = await pickDirectory()
  const ok = await ensurePermission(handle)
  if (!ok) throw new Error('Folder permission was not granted')
  await persistDirectoryHandle(datasetId, handle)
  const files = await walkDirectory(handle)
  const index = await datasetsService.itemIndex(datasetId, { recursive: true })
  const byPath = new Map(files.map((f) => [f.relativePath, f]))
  let matched = 0
  let changed = 0
  let missing = 0
  for (const item of index.items) {
    const found = byPath.get(item.relative_path)
    if (!found) missing += 1
    else if (item.file_size_bytes && found.size && found.size !== item.file_size_bytes) changed += 1
    else matched += 1
  }
  return { matched, changed, missing, rootName: handle.name, total: files.length }
}

export async function thumbKey(datasetId: string, relativePath: string) {
  return `${datasetId}:${relativePath}`
}

export async function getOrCreateThumb(datasetId: string, relativePath: string): Promise<string | null> {
  const key = await thumbKey(datasetId, relativePath)
  const cached = await localDb.getThumb(key)
  if (cached) return URL.createObjectURL(cached)
  try {
    const blob = await getLocalBlob(datasetId, relativePath)
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return URL.createObjectURL(blob)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const thumb: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.82))
    await localDb.putThumb(key, thumb)
    return URL.createObjectURL(thumb)
  } catch {
    return null
  }
}
