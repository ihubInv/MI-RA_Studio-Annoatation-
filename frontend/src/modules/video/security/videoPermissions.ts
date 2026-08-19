export type VideoPermission =
  | 'annotate'
  | 'review'
  | 'export'
  | 'assign'
  | 'admin'
  | 'run_ai'
  | 'download'

const ROLE_PERMS: Record<string, VideoPermission[]> = {
  viewer: ['download'],
  annotator: ['annotate', 'export', 'run_ai', 'download'],
  qa: ['annotate', 'review', 'export', 'download'],
  reviewer: ['review', 'export', 'download'],
  project_manager: ['annotate', 'review', 'export', 'assign', 'run_ai', 'download'],
  org_admin: ['annotate', 'review', 'export', 'assign', 'admin', 'run_ai', 'download'],
  super_admin: ['annotate', 'review', 'export', 'assign', 'admin', 'run_ai', 'download'],
}

export function hasPermission(role: string | undefined, perm: VideoPermission) {
  if (!role) return false
  return (ROLE_PERMS[role] ?? ROLE_PERMS.annotator).includes(perm)
}

export function signedUrlHint(path: string) {
  return `${path}?expires=3600&sig=local-dev`
}

export function annotationOwnerId(userId: string | undefined) {
  return userId ?? 'anonymous'
}
