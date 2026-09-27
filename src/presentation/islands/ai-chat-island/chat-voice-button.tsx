/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { useVoiceRecorder, type VoiceRecorder } from '../hooks/use-voice-recorder'
import type { ChatVoiceInput } from './types'
import type { ReactElement } from 'react'

/**
 * Push-to-talk microphone button for the chat composer (`voiceInput`).
 *
 * Hold it (pointer or Space/Enter) to record; let go to send the recording to
 * `POST /api/ai/transcriptions`, which transcribes and discards it. The
 * transcript is handed to `onTranscript`; what happens next — draft or send —
 * is the composer's decision. `aria-pressed` is true while recording.
 */

const VOICE_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

/** Default and ceiling of `voiceInput.maxDurationSeconds`. */
const DEFAULT_MAX_SECONDS = 300

const formatElapsed = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const seconds = total % 60
  return `${String(Math.floor(total / 60))}:${seconds < 10 ? '0' : ''}${String(seconds)}`
}

/** Post one recording for transcription; the transcript, or an error message. */
async function transcribe(
  file: File,
  voiceInput: ChatVoiceInput
): Promise<{ readonly text: string } | { readonly error: string }> {
  const body = new FormData()
  body.append('file', file, file.name)
  if (voiceInput.language !== undefined) body.append('language', voiceInput.language)
  body.append('quality', voiceInput.quality ?? 'fast')
  const response = await fetch('/api/ai/transcriptions', { method: 'POST', body }).catch(
    () => undefined
  )
  if (response === undefined || !response.ok) {
    return { error: 'The recording could not be transcribed. Please try again.' }
  }
  const json = (await response.json().catch(() => undefined)) as
    { readonly text?: unknown } | undefined
  return typeof json?.text === 'string'
    ? { text: json.text }
    : { error: 'The recording could not be transcribed. Please try again.' }
}

interface ChatVoiceButtonProps {
  readonly voiceInput: ChatVoiceInput
  readonly disabled: boolean
  readonly onTranscript: (text: string) => void
}

/** Transcribe each finished recording and hand the text on; an error message otherwise. */
function useDictation(voiceInput: ChatVoiceInput, onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [transcribing, setTranscribing] = useState(false)
  const handleRecorded = useCallback(
    (file: File): void => {
      setTranscribing(true)
      setStatus(undefined)
      void transcribe(file, voiceInput).then((outcome) => {
        setTranscribing(false)
        if ('error' in outcome) setStatus(outcome.error)
        else if (outcome.text.trim().length > 0) onTranscript(outcome.text.trim())
      })
    },
    [voiceInput, onTranscript]
  )
  return { status, transcribing, handleRecorded }
}

/** Hold-to-talk: press (pointer, Space or Enter) starts, release stops. */
function usePushToTalk(recorder: VoiceRecorder) {
  const { start, stop } = recorder
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault()
        start()
      }
    },
    [start]
  )
  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') stop()
    },
    [stop]
  )
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      start()
    },
    [start]
  )
  return { onKeyDown, onKeyUp, onPointerDown, onPointerUp: stop, onPointerCancel: stop }
}

export function ChatVoiceButton({
  voiceInput,
  disabled,
  onTranscript,
}: ChatVoiceButtonProps): ReactElement {
  const { status, transcribing, handleRecorded } = useDictation(voiceInput, onTranscript)
  const maxMs = (voiceInput.maxDurationSeconds ?? DEFAULT_MAX_SECONDS) * 1000
  const recorder = useVoiceRecorder(maxMs, handleRecorded)
  const handlers = usePushToTalk(recorder)
  const recording = recorder.phase !== 'idle'
  const message = recorder.error ?? status
  return (
    <>
      <button
        type="button"
        data-testid="chat-voice"
        aria-label="Hold to talk"
        aria-pressed={recording}
        disabled={disabled || transcribing}
        {...handlers}
        className={VOICE_BUTTON}
      >
        {recording ? 'Listening…' : 'Talk'}
      </button>
      {recorder.phase === 'recording' && (
        <span
          data-testid="chat-voice-elapsed"
          className="text-sm tabular-nums"
        >
          {formatElapsed(recorder.elapsedMs)}
        </span>
      )}
      {message !== undefined && (
        <span
          role="alert"
          data-testid="chat-voice-error"
          className="text-sm"
        >
          {message}
        </span>
      )}
    </>
  )
}
