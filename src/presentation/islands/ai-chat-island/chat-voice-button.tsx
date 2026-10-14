/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import { computeAiChatComposerButtonClasses } from '@/presentation/design/ai-chat-composition-classes'
import { useVoiceRecorder, type VoiceRecorder } from '../hooks/use-voice-recorder'
import type { ChatVoiceInput, ComposerLabels } from './types'
import type { ReactElement } from 'react'

/**
 * Push-to-talk microphone button for the chat composer (`voiceInput`).
 *
 * Hold it (pointer or Space/Enter) to record; let go to send the recording to
 * `POST /api/ai/transcriptions`, which transcribes and discards it. The
 * transcript is handed to `onTranscript`; what happens next — draft or send —
 * is the composer's decision. `aria-pressed` is true while recording.
 */

const VOICE_BUTTON = computeAiChatComposerButtonClasses('ghost')

/** Default and ceiling of `voiceInput.maxDurationSeconds`. */
const DEFAULT_MAX_SECONDS = 300

const formatElapsed = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const seconds = total % 60
  return `${String(Math.floor(total / 60))}:${seconds < 10 ? '0' : ''}${String(seconds)}`
}

/** Post one recording for transcription; the transcript, or `undefined` when it failed. */
async function transcribe(file: File, voiceInput: ChatVoiceInput): Promise<string | undefined> {
  const body = new FormData()
  body.append('file', file, file.name)
  if (voiceInput.language !== undefined) body.append('language', voiceInput.language)
  body.append('quality', voiceInput.quality ?? 'fast')
  const response = await fetch('/api/ai/transcriptions', { method: 'POST', body }).catch(
    () => undefined
  )
  if (response === undefined || !response.ok) return undefined
  const json = (await response.json().catch(() => undefined)) as
    { readonly text?: unknown } | undefined
  return typeof json?.text === 'string' ? json.text : undefined
}

interface ChatVoiceButtonProps {
  readonly labels: ComposerLabels
  readonly voiceInput: ChatVoiceInput
  readonly disabled: boolean
  readonly onTranscript: (text: string) => void
}

/** Transcribe each finished recording and hand the text on; `failed` otherwise. */
function useDictation(
  voiceInput: ChatVoiceInput,
  onTranscript: (text: string) => void,
  failed: string
) {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const [transcribing, setTranscribing] = useState(false)
  const handleRecorded = useCallback(
    (file: File): void => {
      setTranscribing(true)
      setStatus(undefined)
      void transcribe(file, voiceInput).then((text) => {
        setTranscribing(false)
        if (text === undefined) setStatus(failed)
        else if (text.trim().length > 0) onTranscript(text.trim())
      })
    },
    [voiceInput, onTranscript, failed]
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
  labels,
  voiceInput,
  disabled,
  onTranscript,
}: ChatVoiceButtonProps): ReactElement {
  const { status, transcribing, handleRecorded } = useDictation(
    voiceInput,
    onTranscript,
    labels.voiceError
  )
  const maxMs = (voiceInput.maxDurationSeconds ?? DEFAULT_MAX_SECONDS) * 1000
  const recorder = useVoiceRecorder(maxMs, handleRecorded)
  const handlers = usePushToTalk(recorder)
  const recording = recorder.phase !== 'idle'
  const message = recorder.error ?? status
  return (
    <>
      <button
        type="button"
        data-slot="input-group-button"
        data-testid="chat-voice"
        // English in every language for now: the dictation specs name the button so.
        aria-label="Hold to talk"
        aria-pressed={recording}
        disabled={disabled || transcribing}
        {...handlers}
        className={VOICE_BUTTON}
      >
        {recording ? labels.listening : labels.talk}
      </button>
      {recorder.phase === 'recording' && (
        <span
          data-testid="chat-voice-elapsed"
          className="text-muted-foreground text-xs tabular-nums"
        >
          {formatElapsed(recorder.elapsedMs)}
        </span>
      )}
      {message !== undefined && (
        <span
          role="alert"
          data-testid="chat-voice-error"
          className="text-destructive text-xs"
        >
          {message}
        </span>
      )}
    </>
  )
}
