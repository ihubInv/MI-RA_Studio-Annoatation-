export interface CollabComment {
  id: string
  author: string
  text: string
  mentions: string[]
  frame?: number
  created_at: string
}

export interface CollabLock {
  locked: boolean
  locked_by?: string
  locked_at?: string
}

export interface CollabActivity {
  id: string
  at: string
  actor: string
  action: string
}

export interface CollabState {
  assignees: string[]
  permission: 'owner' | 'editor' | 'reviewer' | 'viewer'
  lock: CollabLock
  comments: CollabComment[]
  activity: CollabActivity[]
}

function key(itemId: string) {
  return `mira.video.collab.${itemId}`
}

export function emptyCollab(): CollabState {
  return {
    assignees: [],
    permission: 'editor',
    lock: { locked: false },
    comments: [],
    activity: [],
  }
}

export function loadCollab(itemId: string): CollabState {
  try {
    const raw = localStorage.getItem(key(itemId))
    if (raw) return { ...emptyCollab(), ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return emptyCollab()
}

export function saveCollab(itemId: string, state: CollabState) {
  localStorage.setItem(key(itemId), JSON.stringify(state))
}

export function parseMentions(text: string): string[] {
  return [...text.matchAll(/@([a-zA-Z0-9._-]+)/g)].map((m) => m[1])
}
