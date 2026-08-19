import { Mic, Minus, Plus, Volume2 } from 'lucide-react'
import type { VideoAudioApi } from '@/modules/video/hooks/useVideoAudio'
import type { FrameIndex } from '@/modules/video/api/video.service'
import { frameToTimeSec } from '@/modules/video/frameIndex'

interface Props {
  audio: VideoAudioApi
  currentFrame: number
  maxFrame: number
  frameIndex: FrameIndex | null
  hasAudio?: boolean
  onExtract: () => void
}

export function AudioPanel({
  audio,
  currentFrame,
  maxFrame,
  frameIndex,
  hasAudio,
  onExtract,
}: Props) {
  const draft = audio.intervalDraft
  const idx = frameIndex ?? { version: '1', frame_count: maxFrame + 1, fps: 30, duration_sec: 0 }

  return (
    <div className="border-t border-border shrink-0 max-h-64 overflow-y-auto">
      <div className="px-2 py-1.5 flex items-center justify-between bg-indigo-50/50">
        <p className="mira-section-label mb-0 text-indigo-900">Audio</p>
        <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
      </div>

      <div className="px-2 py-2 space-y-2">
        {!audio.waveform && (
          <button
            type="button"
            className="w-full mira-btn-ghost h-8 text-xs"
            disabled={audio.waveformLoading || !hasAudio}
            onClick={onExtract}
          >
            {audio.waveformLoading ? 'Extracting…' : 'Extract audio / waveform'}
          </button>
        )}
        {audio.waveformError && (
          <p className="text-2xs text-destructive">{audio.waveformError}</p>
        )}
        {audio.waveform && (
          <p className="text-2xs text-muted-foreground">
            Waveform · {audio.waveform.buckets} buckets · {audio.waveform.duration_sec.toFixed(1)}s
          </p>
        )}

        <div>
          <p className="text-2xs font-medium text-muted-foreground mb-1">Segments</p>
          {!draft ? (
            <button
              type="button"
              className="w-full mira-btn-ghost h-7 text-2xs flex items-center justify-center gap-1"
              onClick={() =>
                audio.beginSegment(currentFrame, frameToTimeSec(currentFrame, idx))
              }
            >
              <Minus className="w-3 h-3" /> Start segment · f{currentFrame + 1}
            </button>
          ) : (
            <div className="space-y-1">
              <button
                type="button"
                className="w-full mira-btn-primary h-7 text-2xs"
                onClick={() => audio.addSegment(draft.startFrame, currentFrame, idx)}
              >
                <Plus className="w-3 h-3 inline mr-1" /> End at f{currentFrame + 1}
              </button>
              <button type="button" className="w-full mira-btn-ghost h-6 text-2xs" onClick={audio.cancelSegmentDraft}>
                Cancel
              </button>
            </div>
          )}
          {audio.segments.length > 0 && (
            <ul className="mt-1 space-y-0.5 max-h-16 overflow-y-auto">
              {audio.segments.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full text-left text-2xs px-1 py-0.5 rounded hover:bg-accent truncate"
                    onClick={() => audio.selectSegment(s.id)}
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: s.color }} />
                    {s.label} f{s.start_frame + 1}–{s.end_frame + 1}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-2xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Speakers
          </p>
          <div className="flex flex-wrap gap-1">
            {audio.speakers.map((sp) => (
              <span
                key={sp.id}
                className="text-2xs px-1.5 py-0.5 rounded-full border"
                style={{ borderColor: sp.color, color: sp.color }}
              >
                {sp.name}
              </span>
            ))}
            <button
              type="button"
              className="text-2xs text-muted-foreground hover:text-foreground"
              onClick={() => audio.addSpeaker(`Speaker ${String.fromCharCode(65 + audio.speakers.length)}`)}
            >
              + Add
            </button>
          </div>
        </div>

        <div>
          <p className="text-2xs font-medium text-muted-foreground mb-1">Transcription</p>
          <TranscriptionForm
            audio={audio}
            currentFrame={currentFrame}
            frameIndex={idx}
          />
          {audio.transcriptions.length > 0 && (
            <ul className="mt-1 space-y-1 max-h-20 overflow-y-auto">
              {audio.transcriptions.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="w-full text-left text-2xs px-1 py-0.5 rounded hover:bg-accent"
                    onClick={() => audio.selectTranscription(t.id)}
                  >
                    <span className="text-muted-foreground font-mono">
                      f{t.start_frame + 1}–{t.end_frame + 1}
                    </span>{' '}
                    {t.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function TranscriptionForm({
  audio,
  currentFrame,
  frameIndex,
}: {
  audio: VideoAudioApi
  currentFrame: number
  frameIndex: FrameIndex
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const text = String(fd.get('text') || '').trim()
    const speakerId = String(fd.get('speaker') || '') || undefined
    const start = Number(fd.get('start') || currentFrame)
    const end = Number(fd.get('end') || currentFrame)
    if (!text) return
    audio.addTranscription(text, start, end, frameIndex, speakerId)
    e.currentTarget.reset()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <textarea
        name="text"
        rows={2}
        placeholder="Transcription text…"
        className="mira-input text-2xs w-full min-h-[48px] resize-y"
      />
      <div className="grid grid-cols-2 gap-1">
        <input
          name="start"
          type="number"
          min={0}
          defaultValue={currentFrame}
          className="mira-input h-7 text-2xs font-mono"
          placeholder="Start frame"
        />
        <input
          name="end"
          type="number"
          min={0}
          defaultValue={currentFrame}
          className="mira-input h-7 text-2xs font-mono"
          placeholder="End frame"
        />
      </div>
      <select name="speaker" className="mira-input h-7 text-2xs w-full">
        <option value="">No speaker</option>
        {audio.speakers.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <button type="submit" className="w-full mira-btn-ghost h-7 text-2xs">
        Add transcription span
      </button>
    </form>
  )
}
