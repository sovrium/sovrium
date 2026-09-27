/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Microphone recording for an island: start, stop, the elapsed time, and the
 * finished recording handed to `onRecorded` as a `File`.
 *
 * Format: `audio/webm;codecs=opus` where the browser records it, `audio/mp4`
 * otherwise (older Safari). The file is named `.weba` / `.m4a` — never `.webm`,
 * which one extension table maps to VIDEO — and carries its bare audio type.
 *
 * `stop()` may be called before capture has started (a button released while
 * the browser is still granting the microphone): the recording then stops the
 * moment it begins, and nothing shorter than that is lost or left running.
 * `maxDurationMs` stops it by itself.
 */

type RecorderPhase = 'idle' | 'starting' | 'recording'

interface RecorderType {
  readonly mime: string
  readonly ext: string
}

const RECORDER_TYPES: ReadonlyArray<RecorderType> = [
  { mime: 'audio/webm;codecs=opus', ext: '.weba' },
  { mime: 'audio/webm', ext: '.weba' },
  { mime: 'audio/mp4', ext: '.m4a' },
]

const pickRecorderType = (): RecorderType | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined
  if (typeof MediaRecorder.isTypeSupported !== 'function') return RECORDER_TYPES[0]
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type.mime))
}

interface ActiveRecording {
  readonly recorder: MediaRecorder
  readonly stream: MediaStream
  readonly startedAt: number
}

export interface VoiceRecorder {
  readonly phase: RecorderPhase
  readonly elapsedMs: number
  /** Why capture could not start (refused, unavailable), or `undefined`. */
  readonly error: string | undefined
  readonly start: () => void
  readonly stop: () => void
}

/** Collect a recorder's chunks and hand them over as one file when it stops. */
const collectRecording = (
  recorder: MediaRecorder,
  type: RecorderType,
  onRecorded: (file: File) => void
): void => {
  // Chunks arrive one event at a time; the holder is private to this recorder.
  const collected: { chunks: readonly Blob[] } = { chunks: [] }
  recorder.addEventListener('dataavailable', (event) => {
    // eslint-disable-next-line functional/immutable-data -- see above
    if (event.data.size > 0) collected.chunks = [...collected.chunks, event.data]
  })
  recorder.addEventListener('stop', () => {
    const mime = (recorder.mimeType || type.mime).split(';')[0] ?? type.mime
    const blob = new Blob([...collected.chunks], { type: mime })
    if (blob.size > 0) onRecorded(new File([blob], `recording${type.ext}`, { type: mime }))
  })
}

/** Start a recorder on `stream`; its file reaches `onFile` when it stops. */
const startRecording = (
  stream: MediaStream,
  type: RecorderType,
  onFile: (file: File) => void
): ActiveRecording => {
  const recorder = new MediaRecorder(stream, { mimeType: type.mime })
  collectRecording(recorder, type, onFile)
  recorder.start()
  return { recorder, stream, startedAt: Date.now() }
}

/** Stop the recorder (which emits the file) and release the microphone. */
const releaseRecording = (active: ActiveRecording): void => {
  if (active.recorder.state !== 'inactive') active.recorder.stop()
  active.stream.getTracks().forEach((track) => track.stop())
}

/**
 * While recording, refresh the elapsed time four times a second and stop at
 * the cap.
 */
function useRecordingTicker({
  recording,
  activeRef,
  maxDurationMs,
  setElapsedMs,
  stop,
}: {
  readonly recording: boolean
  readonly activeRef: { readonly current: ActiveRecording | undefined }
  readonly maxDurationMs: number
  readonly setElapsedMs: (ms: number) => void
  readonly stop: () => void
}): void {
  useEffect(() => {
    if (!recording) return undefined
    const ticker = setInterval(() => {
      const active = activeRef.current
      if (active === undefined) return
      const elapsed = Date.now() - active.startedAt
      setElapsedMs(elapsed)
      if (elapsed >= maxDurationMs) stop()
    }, 250)
    return () => clearInterval(ticker)
  }, [recording, activeRef, maxDurationMs, setElapsedMs, stop])
}

/**
 * The recording in progress: `begin` starts it on a granted stream, `stop`
 * ends it (or, before capture has started, arranges for it to end at once).
 *
 * Every press opens a new SESSION. A grant that resolves for a session that is
 * no longer current — the button was pressed again while the browser was still
 * asking, or the island unmounted — releases its stream at once instead of
 * recording: without that, a quick double press left the first stream running
 * with nothing holding it, and the microphone light never went out.
 */
function useRecordingSession(
  onRecorded: (file: File) => void,
  setPhase: (phase: RecorderPhase) => void,
  setElapsedMs: (ms: number) => void
) {
  const activeRef = useRef<ActiveRecording | undefined>(undefined)
  const stopRequestedRef = useRef(false)
  const sessionRef = useRef(0)
  const unmountedRef = useRef(false)
  const onRecordedRef = useRef(onRecorded)
  // eslint-disable-next-line functional/immutable-data -- latest-callback ref
  onRecordedRef.current = onRecorded

  const stop = useCallback((): void => {
    const active = activeRef.current
    if (active === undefined) {
      // eslint-disable-next-line functional/immutable-data -- honoured once capture starts
      stopRequestedRef.current = true
      return
    }
    // eslint-disable-next-line functional/immutable-data -- one recording at a time
    activeRef.current = undefined
    releaseRecording(active)
    if (!unmountedRef.current) setPhase('idle')
  }, [setPhase])

  /** Open a session for one press; its id is what `begin` must present. */
  const open = useCallback((): number => {
    // eslint-disable-next-line functional/immutable-data -- reset for this press
    stopRequestedRef.current = false
    // eslint-disable-next-line functional/immutable-data -- a newer press supersedes
    sessionRef.current += 1
    return sessionRef.current
  }, [])

  const begin = useCallback(
    (session: number, stream: MediaStream, type: RecorderType): void => {
      if (unmountedRef.current || session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      // eslint-disable-next-line functional/immutable-data -- one recording at a time
      activeRef.current = startRecording(stream, type, (file) => {
        // A recording cut short by unmounting is discarded, not transcribed.
        if (!unmountedRef.current) onRecordedRef.current(file)
      })
      setElapsedMs(0)
      setPhase('recording')
      if (stopRequestedRef.current) stop()
    },
    [stop, setPhase, setElapsedMs]
  )

  // A recording left running when the island unmounts would keep the
  // microphone light on; a grant still pending is released when it lands.
  useEffect(
    () => () => {
      // eslint-disable-next-line functional/immutable-data -- lifecycle flag
      unmountedRef.current = true
      stop()
    },
    [stop]
  )

  return { activeRef, open, stop, begin }
}

export function useVoiceRecorder(
  maxDurationMs: number,
  onRecorded: (file: File) => void
): VoiceRecorder {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | undefined>(undefined)
  const { activeRef, open, stop, begin } = useRecordingSession(onRecorded, setPhase, setElapsedMs)

  const start = useCallback((): void => {
    if (activeRef.current !== undefined) return
    const type = pickRecorderType()
    const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
    setError(undefined)
    if (type === undefined || media === undefined) {
      setError('This browser cannot record from a microphone.')
      return
    }
    const session = open()
    setPhase('starting')
    media.getUserMedia({ audio: true }).then(
      (stream) => begin(session, stream, type),
      () => {
        setPhase('idle')
        setError('Microphone access was refused.')
      }
    )
  }, [activeRef, open, begin])

  useRecordingTicker({
    recording: phase === 'recording',
    activeRef,
    maxDurationMs,
    setElapsedMs,
    stop,
  })

  return { phase, elapsedMs, error, start, stop }
}
