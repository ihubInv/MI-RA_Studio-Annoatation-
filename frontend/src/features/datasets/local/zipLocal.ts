import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js'
import { isImagePath } from './fsAccess'

export interface ZipEntryMeta {
  relativePath: string
  name: string
  size: number
  lastModified: number
  type: string
}

function normalizeZipPath(name: string) {
  return name.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
}

export async function listZipImages(file: File): Promise<ZipEntryMeta[]> {
  const reader = new ZipReader(new BlobReader(file))
  const out: ZipEntryMeta[] = []
  for await (const entry of reader.getEntriesGenerator()) {
    if (entry.directory) continue
    const rel = normalizeZipPath(entry.filename)
    const base = rel.split('/').pop() || rel
    if (!rel || rel.startsWith('__MACOSX') || base.startsWith('.') || base.startsWith('._')) continue
    if (!isImagePath(rel)) continue
    out.push({
      relativePath: rel,
      name: base,
      size: Number(entry.uncompressedSize || 0),
      lastModified: entry.lastModDate?.getTime?.() || Date.now(),
      type: 'application/octet-stream',
    })
  }
  await reader.close()
  return out
}

export async function readZipEntry(file: File, relativePath: string): Promise<Blob> {
  const reader = new ZipReader(new BlobReader(file))
  for await (const entry of reader.getEntriesGenerator()) {
    if (entry.directory) continue
    if (normalizeZipPath(entry.filename) !== relativePath || !entry.getData) continue
    const blob = await entry.getData(new BlobWriter())
    await reader.close()
    return blob
  }
  await reader.close()
  throw new Error('File not found in ZIP')
}

export function zipFolderCount(entries: ZipEntryMeta[]) {
  const folders = new Set<string>()
  for (const e of entries) {
    const parts = e.relativePath.split('/').slice(0, -1)
    let acc = ''
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      folders.add(acc)
    }
  }
  return folders.size
}
