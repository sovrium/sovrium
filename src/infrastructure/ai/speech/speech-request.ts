/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/prefer-immutable-types -- the Speech*Error tagged classes are mutable by Data.TaggedError design */
import { Effect } from 'effect'
import {
  SpeechProviderError,
  SpeechTimeoutError,
  type Transcript,
  type TranscriptSegment,
} from '@/application/ports/services/speech-service'
import { withFetchTimeout } from '@/infrastructure/egress/with-fetch-timeout'

/**
 * The transport both speech adapters share: one multipart POST, bounded by
 * `STT_TIMEOUT_MS`, and the parse of the JSON transcript that comes back.
 *
 * The two route shapes (OpenAI's `/audio/transcriptions`, whisper.cpp's
 * `/inference`) differ only in their URL and form fields, and both answer
 * `verbose_json` in the same `{ text, language, duration, segments }` shape —
 * so everything past building the form lives here once.
 */

/** Why a `fetch` rejected: an abort is the deadline, anything else is transport. */
const isAbort = (cause: unknown): boolean =>
  typeof cause === 'object' &&
  cause !== null &&
  ['AbortError', 'TimeoutError'].includes(String((cause as { name?: unknown }).name))

const mapRequestError = (
  cause: unknown,
  timeoutMs: number
): SpeechProviderError | SpeechTimeoutError => {
  if (cause instanceof SpeechProviderError) return cause
  if (isAbort(cause)) {
    return new SpeechTimeoutError({
      message: `speech-to-text request timed out after ${String(timeoutMs)} ms (STT_TIMEOUT_MS)`,
      timeoutMs,
    })
  }
  return new SpeechProviderError({
    statusCode: 502,
    message: `speech-to-text request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    cause,
  })
}

/** The audio part of a multipart body, typed so the engine can tell it is audio. */
export const audioPart = (bytes: Uint8Array, mimeType: string): Blob =>
  // Copied into an `ArrayBuffer`-backed view: `BlobPart` refuses a view that
  // could sit over a `SharedArrayBuffer`, which a storage download may.
  new Blob([new Uint8Array(bytes)], { type: mimeType })

/**
 * POST a multipart transcription request and return the parsed JSON body.
 *
 * `withFetchTimeout` ABORTS the socket at the deadline (standing rule E6), and
 * the abort is reported as a {@link SpeechTimeoutError} rather than a generic
 * transport failure, so an operator reading a failed run sees the cause.
 * The credential travels in a header and is never part of an error message.
 */
export const postTranscription = (input: {
  readonly url: string
  readonly form: FormData
  readonly apiKey?: string
  readonly timeoutMs: number
}): Effect.Effect<unknown, SpeechProviderError | SpeechTimeoutError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await withFetchTimeout(
        input.url,
        {
          method: 'POST',
          headers:
            input.apiKey !== undefined ? { Authorization: `Bearer ${input.apiKey}` } : undefined,
          body: input.form,
        },
        input.timeoutMs
      )
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        // eslint-disable-next-line functional/no-throw-statements -- Effect.tryPromise.catch maps thrown values to tagged errors
        throw new SpeechProviderError({
          statusCode: response.status,
          message: `speech endpoint returned HTTP ${String(response.status)}: ${body.slice(0, 200)}`,
        })
      }
      return (await response.json()) as unknown
    },
    catch: (cause) => mapRequestError(cause, input.timeoutMs),
  })

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined

const toSegment = (value: unknown): TranscriptSegment | undefined => {
  const record = asRecord(value)
  const start = finiteNumber(record?.['start'])
  const end = finiteNumber(record?.['end'])
  const text = record?.['text']
  return start !== undefined && end !== undefined && typeof text === 'string'
    ? { start, end, text: text.trim() }
    : undefined
}

const toSegments = (value: unknown): readonly TranscriptSegment[] =>
  Array.isArray(value)
    ? value.map(toSegment).filter((s): s is TranscriptSegment => s !== undefined)
    : []

/** The optional facts a `verbose_json` body carries beside its text. */
const transcriptDetails = (
  body: Readonly<Record<string, unknown>>,
  timestamps: boolean
): Pick<Transcript, 'language' | 'durationSeconds' | 'segments'> => {
  const language = nonEmptyString(body['language'])
  const durationSeconds = finiteNumber(body['duration'])
  return {
    ...(language !== undefined ? { language } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(timestamps ? { segments: toSegments(body['segments']) } : {}),
  }
}

/**
 * Read a `verbose_json` (or plain `json`) transcript body.
 *
 * `model` is the model that was asked for; a server that names the one it
 * actually used wins, and `'default'` stands for "the server chose" when
 * neither side named one.
 */
export const parseTranscript = (
  payload: unknown,
  options: { readonly model: string | undefined; readonly timestamps: boolean }
): Effect.Effect<Transcript, SpeechProviderError> => {
  const body = asRecord(payload)
  const text = body?.['text']
  if (body === undefined || typeof text !== 'string') {
    return Effect.fail(
      new SpeechProviderError({
        statusCode: 502,
        message: 'speech endpoint returned a response with no transcript text',
      })
    )
  }
  return Effect.succeed({
    text: text.trim(),
    model: nonEmptyString(body['model']) ?? options.model ?? 'default',
    ...transcriptDetails(body, options.timestamps),
  })
}
