import { datasetsService } from '@/services/datasets.service'
import { isVideoPath } from '@/modules/video/constants'
import { localDb } from './idb'
import {
  ensurePermission,
  fileFromDirectory,
  isMediaPath,
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
import { listZipMedia, readZipEntry, zipFolderCount } from './zipLocal'

export type LocalAccessState = 'ready' | 'permission' | 'missing' | 'unsupported'

function guessMime(name: string, modality: string = 'image') {
  const ext = name.split('.').pop()?.toLowerCase()
  if (modality === 'video' || modality === 'multimodal') {
    const videoMap: Record<string, string> = {
      mp4: 'video/mp4',
      m4v: 'video/x-m4v',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      mpeg: 'video/mpeg',
      mpg: 'video/mpeg',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      ts: 'video/mp2t',
      mts: 'video/mp2t',
      m2ts: 'video/mp2t',
      '3gp': 'video/3gpp',
    }
    return videoMap[ext || ''] || 'video/mp4'
  }
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
  modality: string = 'image',
  onProgress?: (pct: number, phase: string) => void,
) {
  const handle = await pickDirectory()
  const ok = await ensurePermission(handle)
  if (!ok) throw new Error('Folder permission was not granted')
  await persistDirectoryHandle(datasetId, handle)
  onProgress?.(12, 'Scanning folders in parallel…')
  const files = await walkDirectory(handle, '', modality)
  await localDb.putMeta({ datasetId, rootName: handle.name, kind: 'directory', fileCount: files.length })
  onProgress?.(28, `Indexing ${files.length.toLocaleString()} files…`)
  const created = await registerBatch(datasetId, files, handle.name, (done, total) => {
    onProgress?.(28 + Math.round((done / Math.max(total, 1)) * 70), `Indexing ${done}/${total}`)
  })
  onProgress?.(100, 'Ready')
  return { created, total: files.length, folders: new Set(files.map((f) => f.relativePath.split('/').slice(0, -1).join('/')).filter(Boolean)).size, rootName: handle.name }
}

export async function importLocalZip(datasetId: string, modality: string = 'image', file?: File) {
  let zipFile = file
  let handle: FileSystemFileHandle | null = null
  if (!zipFile && 'showOpenFilePicker' in window) {
    handle = await pickZipFile()
    zipFile = await handle.getFile()
    await persistZipHandle(datasetId, handle)
  }
  if (!zipFile) throw new Error('No ZIP selected')
  rememberSessionZip(datasetId, zipFile)
  const entries = await listZipMedia(zipFile, modality)
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
      type: guessMime(e.name, modality),
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

export async function importLocalFiles(datasetId: string, files: File[], modality: string = 'image') {
  rememberSessionFiles(datasetId, files, modality)
  const walked: WalkedFile[] = files
    .map((file) => {
      const rel = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/')
      return {
        relativePath: rel,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || guessMime(file.name, modality),
      }
    })
    .filter((f) => isMediaPath(f.name, modality))
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

async function thumbFromVideoBlob(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Video thumbnail timeout')), 10000)
      const fail = () => {
        window.clearTimeout(timer)
        reject(new Error('Video thumbnail failed'))
      }
      video.addEventListener('loadeddata', () => {
        window.clearTimeout(timer)
        resolve()
      }, { once: true })
      video.addEventListener('error', fail, { once: true })
    })
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const seekTo = duration > 0.4 ? Math.min(1, duration * 0.08) : 0
    if (seekTo > 0) {
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        video.addEventListener('seeked', done, { once: true })
        video.currentTime = seekTo
        window.setTimeout(done, 1500)
      })
    }
    const w = video.videoWidth || 320
    const h = video.videoHeight || 180
    const scale = Math.min(1, 320 / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode thumbnail'))), 'image/jpeg', 0.82)
    })
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

async function thumbFromImageBlob(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, 320 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.82))
}

export async function getOrCreateThumb(datasetId: string, relativePath: string): Promise<string | null> {
  const key = await thumbKey(datasetId, relativePath)
  const cached = await localDb.getThumb(key)
  if (cached) return URL.createObjectURL(cached)
  try {
    const blob = await getLocalBlob(datasetId, relativePath)
    const thumb = isVideoPath(relativePath) ? await thumbFromVideoBlob(blob) : await thumbFromImageBlob(blob)
    await localDb.putThumb(key, thumb)
    return URL.createObjectURL(thumb)
  } catch {
    return null
  }
}
