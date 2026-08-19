export type ItemNavStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'annotating'
  | 'annotated'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'error'

export interface FolderNode {
  path: string
  name: string
  image_count: number
  not_annotated: number
  in_progress: number
  completed: number
  needs_review: number
  approved: number
  error: number
  progress: number
  children: FolderNode[]
}

export interface DatasetSummary {
  image_count: number
  not_annotated: number
  in_progress: number
  completed: number
  needs_review: number
  approved: number
  error: number
  folders: number
  progress: number
  classes: number
  annotations: number
  remaining: number
}

export interface DatasetTreeResponse {
  tree: FolderNode
  summary: DatasetSummary
  dataset: { id: string; name: string; modality: string; status: string }
}

export interface DatasetIndexItem {
  id: string
  filename: string
  relative_path: string
  parent_folder: string
  status: ItemNavStatus
}

export interface ZipInspectReport {
  job_id: string
  valid_images: number
  folder_count: number
  folders: string[]
  duplicate_files: string[]
  duplicate_count: number
  unsupported_files: string[]
  unsupported_count: number
  large_files: string[]
  invalid_paths: string[]
  empty_folders: string[]
  corrupted_images: string[]
}

export const STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: 'Not annotated', dot: 'bg-slate-400', text: 'text-slate-600' },
  processing: { label: 'Processing', dot: 'bg-slate-400', text: 'text-slate-600' },
  ready: { label: 'Not annotated', dot: 'bg-slate-400', text: 'text-slate-600' },
  annotating: { label: 'In progress', dot: 'bg-amber-500', text: 'text-amber-700' },
  annotated: { label: 'Completed', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  in_review: { label: 'Needs review', dot: 'bg-red-500', text: 'text-red-600' },
  rejected: { label: 'Needs review', dot: 'bg-red-500', text: 'text-red-600' },
  approved: { label: 'Approved', dot: 'bg-sky-500', text: 'text-sky-700' },
  error: { label: 'Error', dot: 'bg-red-600', text: 'text-red-700' },
}
