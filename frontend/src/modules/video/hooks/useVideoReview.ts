import { useCallback, useEffect, useState } from 'react'
import { loadReview, saveReview, type ReviewRecord, type ReviewStatus } from '@/modules/video/review/reviewStore'

export function useVideoReview(itemId: string | undefined, username: string) {
  const [review, setReview] = useState<ReviewRecord>({ status: 'draft' })

  useEffect(() => {
    if (itemId) setReview(loadReview(itemId))
    const onHydrate = (e: Event) => {
      if ((e as CustomEvent).detail?.itemId !== itemId) return
      setReview(loadReview(itemId!))
    }
    window.addEventListener('mira-studio-hydrate', onHydrate)
    return () => window.removeEventListener('mira-studio-hydrate', onHydrate)
  }, [itemId])

  useEffect(() => {
    if (itemId) saveReview(itemId, review)
  }, [itemId, review])

  const submit = useCallback(() => {
    setReview({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: username,
      note: review.note,
    })
  }, [username, review.note])

  const decide = useCallback(
    (decision: 'approve' | 'reject', note?: string) => {
      const status: ReviewStatus = decision === 'approve' ? 'approved' : 'rejected'
      setReview((r) => ({
        ...r,
        status,
        decision,
        note: note ?? r.note,
        reviewed_at: new Date().toISOString(),
        reviewed_by: username,
      }))
    },
    [username],
  )

  return { review, setReview, submit, decide }
}
