import { localDb } from './idb'

const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|gif|tif|tiff|jfif|ico)$/i

export function isImagePath(name: string) {
  return IMAGE_EXT.test(name)
}

export function supportsDirectoryPicker() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: 'read' })
}

export async function pickZipFile(): Promise<FileSystemFileHandle> {
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
  })
  return handle
}

export async function ensurePermission(handle: FileSystemHandle): Promise<boolean> {
  const h = handle as FileSystemHandle & { queryPermission?: Function; requestPermission?: Function }
  if (!h.queryPermission) return true
  const state = await h.queryPermission({ mode: 'read' })
  if (state === 'granted') return true
  const next = await h.requestPermission?.({ mode: 'read' })
  return next === 'granted'
}

export interface WalkedFile {
  relativePath: string
  name: string
  size: number
  lastModified: number
  type: string
}

export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length || 1) }, () => worker()))
  return results
}

export async function walkDirectory(root: FileSystemDirectoryHandle, prefix = ''): Promise<WalkedFile[]> {
  const fileJobs: { name: string; handle: FileSystemFileHandle }[] = []
  const dirJobs: { name: string; handle: FileSystemDirectoryHandle }[] = []
  for await (const [name, handle] of root.entries()) {
    if (handle.kind === 'directory') {
      if (name === '__MACOSX' || name.startsWith('.')) continue
      dirJobs.push({ name, handle: handle as FileSystemDirectoryHandle })
    } else {
      if (!isImagePath(name) || name.startsWith('.') || name.startsWith('._')) continue
      fileJobs.push({ name, handle: handle as FileSystemFileHandle })
    }
  }

  const [fileRows, nested] = await Promise.all([
    mapPool(fileJobs, 24, async ({ name, handle }) => {
      const file = await handle.getFile()
      return {
        relativePath: prefix ? `${prefix}/${name}` : name,
        name,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || 'application/octet-stream',
      } satisfies WalkedFile
    }),
    mapPool(dirJobs, 10, ({ name, handle }) => walkDirectory(handle, prefix ? `${prefix}/${name}` : name)),
  ])
  return fileRows.concat(nested.flat())
}

export async function fileFromDirectory(root: FileSystemDirectoryHandle, relativePath: string): Promise<File> {
  const parts = relativePath.split('/').filter(Boolean)
  let dir: FileSystemDirectoryHandle = root
  for (const part of parts.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(part)
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
  return fileHandle.getFile()
}

const memoryFiles = new Map<string, Map<string, File>>()
const memoryZips = new Map<string, File>()

export function rememberSessionFiles(datasetId: string, files: File[]) {
  const map = new Map<string, File>()
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const clean = rel.replace(/\\/g, '/').replace(/^\.\//, '')
    if (!isImagePath(clean)) continue
    map.set(clean, file)
  }
  memoryFiles.set(datasetId, map)
}

export function rememberSessionZip(datasetId: string, file: File) {
  memoryZips.set(datasetId, file)
}

export function sessionZip(datasetId: string) {
  return memoryZips.get(datasetId) || null
}

export function sessionHasFiles(datasetId: string) {
  return (memoryFiles.get(datasetId)?.size || 0) > 0 || memoryZips.has(datasetId)
}

export function sessionFile(datasetId: string, relativePath: string) {
  return memoryFiles.get(datasetId)?.get(relativePath) || null
}

export async function persistDirectoryHandle(datasetId: string, handle: FileSystemDirectoryHandle) {
  await localDb.putHandle({
    datasetId,
    kind: 'directory',
    handle,
    rootName: handle.name,
    grantedAt: Date.now(),
  })
  await localDb.putMeta({ datasetId, rootName: handle.name, kind: 'directory', fileCount: 0 })
}

export async function persistZipHandle(datasetId: string, handle: FileSystemFileHandle) {
  await localDb.putHandle({
    datasetId,
    kind: 'zip',
    handle,
    rootName: handle.name.replace(/\.zip$/i, ''),
    grantedAt: Date.now(),
  })
  await localDb.putMeta({ datasetId, rootName: handle.name.replace(/\.zip$/i, ''), kind: 'zip', fileCount: 0 })
}
