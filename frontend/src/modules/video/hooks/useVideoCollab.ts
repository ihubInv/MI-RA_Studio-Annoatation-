import { useCallback, useEffect, useState } from 'react'
import {
  emptyCollab,
  loadCollab,
  parseMentions,
  saveCollab,
  type CollabState,
} from '@/modules/video/collab/collabStore'

export function useVideoCollab(itemId: string | undefined, username: string) {
  const [state, setState] = useState<CollabState>(emptyCollab)

  useEffect(() => {
    if (itemId) setState(loadCollab(itemId))
    const onHydrate = (e: Event) => {
      if ((e as CustomEvent).detail?.itemId !== itemId) return
      setState(loadCollab(itemId!))
    }
    window.addEventListener('mira-studio-hydrate', onHydrate)
    return () => window.removeEventListener('mira-studio-hydrate', onHydrate)
  }, [itemId])

  useEffect(() => {
    if (itemId) saveCollab(itemId, state)
  }, [itemId, state])

  const addComment = useCallback(
    (text: string, frame?: number) => {
      const mentions = parseMentions(text)
      setState((s) => ({
        ...s,
        comments: [
          ...s.comments,
          { id: crypto.randomUUID(), author: username, text, mentions, frame, created_at: new Date().toISOString() },
        ],
        activity: [
          ...s.activity,
          { id: crypto.randomUUID(), at: new Date().toISOString(), actor: username, action: `commented${mentions.length ? ` mentioned ${mentions.join(', ')}` : ''}` },
        ],
      }))
    },
    [username],
  )

  const toggleLock = useCallback(() => {
    setState((s) => ({
      ...s,
      lock: s.lock.locked
        ? { locked: false }
        : { locked: true, locked_by: username, locked_at: new Date().toISOString() },
      activity: [
        ...s.activity,
        {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          actor: username,
          action: s.lock.locked ? 'unlocked item' : 'locked item',
        },
      ],
    }))
  }, [username])

  const assign = useCallback(
    (user: string) => {
      setState((s) => ({
        ...s,
        assignees: s.assignees.includes(user) ? s.assignees : [...s.assignees, user],
        activity: [...s.activity, { id: crypto.randomUUID(), at: new Date().toISOString(), actor: username, action: `assigned ${user}` }],
      }))
    },
    [username],
  )

  return { state, setState, addComment, toggleLock, assign }
}
