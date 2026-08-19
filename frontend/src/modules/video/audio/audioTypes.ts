/** Video audio annotations — Phase 22. */

export interface WaveformData {
  duration_sec: number
  sample_rate: number
  buckets: number
  /** Normalized peak amplitudes 0–1 per bucket. */
  peaks: number[]
}

export interface SpeakerLabel {
  id: string
  name: string
  color: string
}

export interface AudioSegment {
  id: string
  label: string
  color: string
  start_frame: number
  end_frame: number
  start_sec: number
  end_sec: number
  speaker_id?: string
}

export interface TranscriptionSpan {
  id: string
  text: string
  start_frame: number
  end_frame: number
  start_sec: number
  end_sec: number
  speaker_id?: string
}

export function newAudioSegmentId() {
  return crypto.randomUUID()
}

export function newSpeakerId() {
  return crypto.randomUUID()
}

export function newTranscriptionId() {
  return crypto.randomUUID()
}

export function normalizeSpeaker(raw: Record<string, unknown>): SpeakerLabel | null {
  const name = String(raw.name || '').trim()
  if (!name) return null
  return {
    id: String(raw.id || newSpeakerId()),
    name,
    color: String(raw.color || '#6366f1'),
  }
}

export function normalizeAudioSegment(raw: Record<string, unknown>): AudioSegment | null {
  const start = Number(raw.start_frame)
  const end = Number(raw.end_frame ?? raw.start_frame)
  if (!Number.isFinite(start) || start < 0) return null
  return {
    id: String(raw.id || newAudioSegmentId()),
    label: String(raw.label || 'Segment'),
    color: String(raw.color || '#6366f1'),
    start_frame: start,
    end_frame: Math.max(start, end),
    start_sec: Number(raw.start_sec ?? 0),
    end_sec: Number(raw.end_sec ?? 0),
    speaker_id: raw.speaker_id != null ? String(raw.speaker_id) : undefined,
  }
}

export function normalizeTranscription(raw: Record<string, unknown>): TranscriptionSpan | null {
  const text = String(raw.text || '').trim()
  const start = Number(raw.start_frame)
  const end = Number(raw.end_frame ?? raw.start_frame)
  if (!text || !Number.isFinite(start) || start < 0) return null
  return {
    id: String(raw.id || newTranscriptionId()),
    text,
    start_frame: start,
    end_frame: Math.max(start, end),
    start_sec: Number(raw.start_sec ?? 0),
    end_sec: Number(raw.end_sec ?? 0),
    speaker_id: raw.speaker_id != null ? String(raw.speaker_id) : undefined,
  }
}
