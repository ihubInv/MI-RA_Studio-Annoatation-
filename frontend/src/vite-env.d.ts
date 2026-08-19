/// <reference types="vite/client" />

export {}

declare global {
  interface FileSystemDirectoryHandle {
    entries(): AsyncIterableIterator<[string, FileSystemFileHandle | FileSystemDirectoryHandle]>
  }

  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
    showOpenFilePicker(options?: {
      multiple?: boolean
      types?: Array<{ description?: string; accept: Record<string, string[]> }>
    }): Promise<FileSystemFileHandle[]>
  }
}
