export type ReviewStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected'

export interface ReviewRecord {
  status: ReviewStatus
  submitted_at?: string
  submitted_by?: string
  reviewed_at?: string
  reviewed_by?: string
  decision?: 'approve' | 'reject'
  note?: string
}

function key(itemId: string) {
  return `mira.video.review.${itemId}`
}

export function loadReview(itemId: string): ReviewRecord {
  try {
    const raw = localStorage.getItem(key(itemId))
    if (raw) return JSON.parse(raw) as ReviewRecord
  } catch {
    /* ignore */
  }
  return { status: 'draft' }
}

export function saveReview(itemId: string, rec: ReviewRecord) {
  localStorage.setItem(key(itemId), JSON.stringify(rec))
}

export function canReview(role: string) {
  return ['reviewer', 'qa', 'org_admin', 'super_admin', 'project_manager'].includes(role)
}

export function canAnnotate(role: string) {
  return !['viewer'].includes(role)
}
