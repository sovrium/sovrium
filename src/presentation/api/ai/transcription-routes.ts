/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { transcribeRecording } from '@/application/use-cases/ai/transcribe-recording'
import { canonicalMimeType, inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import {
  transcriptionRequestFieldsSchema,
  transcriptionResponseSchema,
} from '@/domain/models/api/ai/transcriptions'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import {
  createAiAnonRateLimit,
  type AiAnonRateLimit,
} from '@/presentation/api/ai/ai-anon-rate-limit'
import { checkChatRateLimit } from '@/presentation/api/ai/chat-rate-limit'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import type { SpeechError, Transcript } from '@/application/ports/services/speech-service'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * `POST /api/ai/transcriptions` — speech-to-text for chat dictation.
 *
 * The recording travels as the `file` part of a `multipart/form-data` body,
 * with optional `language` and `quality` text fields. It is transcribed on the
 * operator's speech endpoint (`STT_*`) and discarded: nothing is written to
 * storage. The tier defaults to `fast`, because a person is waiting.
 *
 * Refusals, in the order they are decided:
 *  - 404 when the app declares `auth` and the caller has no session — the
 *    endpoint does not reveal that it exists (S1);
 *  - 429 when the app declares no `auth` and the caller's address is over the
 *    anonymous limit (`AI_ANON_RATE_LIMIT`, default 10 per 60 s);
 *  - 429 when the caller is over the chat rate limit (`AI_CHAT_RATE_LIMIT`,
 *    counted separately from chat messages);
 *  - 400 for a missing, oversized (over 25 MB) or non-audio file, or an
 *    invalid `language` / `quality`, before any byte reaches the engine;
 *  - 503 when no speech provider is configured;
 *  - 504 when the engine does not answer within `STT_TIMEOUT_MS`, and 502
 *    when it answers with an error — both upstream failures the browser can
 *    tell the person about, never a 500.
 *
 * The route runs under `STT_TIMEOUT_MS` plus `API_TIMEOUT_MS` rather than the
 * general ceiling (`ROUTE_TIMEOUTS` in `request-guards.ts`).
 */

/** Largest recording the chat surface accepts: five minutes of speech fits well under it. */
const CHAT_RECORDING_MAX_BYTES = 25 * 1024 * 1024

/**
 * Containers a browser records audio into but that one extension maps to a
 * VIDEO type. An audio-only recording in them is sent under its audio name.
 */
const AUDIO_CAPABLE_CONTAINERS: Readonly<Record<string, string>> = {
  'video/webm': 'audio/webm',
  'video/mp4': 'audio/mp4',
  'video/ogg': 'audio/ogg',
}

/** The audio MIME type of an uploaded recording, or `undefined` when it is not audio. */
const audioMimeOf = (file: File): string | undefined => {
  const reported = canonicalMimeType(file.type)
  const mime = reported === '' ? inferMimeFromKey(file.name) : reported
  return mime.startsWith('audio/') ? mime : AUDIO_CAPABLE_CONTAINERS[mime]
}

/**
 * Room left in the declared body size for the multipart envelope and the two
 * text fields. A `Content-Length` beyond cap + this margin cannot hold an
 * acceptable recording, so it is refused before a byte is buffered.
 */
const MULTIPART_ENVELOPE_BYTES = 64 * 1024

const OVERSIZED_REFUSAL = 'The recording is too large: the limit is 25 MB.'

/**
 * True when the request DECLARES a body no acceptable recording fits in. A
 * chunked request declares nothing and falls through to the per-file check
 * after parsing, as before.
 */
const declaresOversizedBody = (c: Context): boolean => {
  const declared = Number(c.req.header('content-length'))
  return Number.isFinite(declared) && declared > CHAT_RECORDING_MAX_BYTES + MULTIPART_ENVELOPE_BYTES
}

const badRequest = (c: Context, message: string): Response =>
  c.json(errorBody({ error: message, code: ApiErrorCode.BAD_REQUEST }), 400)

const textField = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

/** Map a speech failure onto the response the caller can act on. */
const speechFailureResponse = (c: Context, error: SpeechError): Response => {
  if (error._tag === 'SpeechInputError') return badRequest(c, error.message)
  if (error._tag === 'SpeechNotConfiguredError') {
    return c.json(
      errorBody({
        error: 'Speech-to-text is not available on this server.',
        code: ApiErrorCode.SERVICE_UNAVAILABLE,
      }),
      503
    )
  }
  // Past this point the engine failed, and the body the caller gets names no
  // cause (never the endpoint's own words, which may echo its URL): the cause
  // is logged here, or the operator has nothing to read (E6).
  logError('[ai] transcription failed at the speech engine', error)
  if (error._tag === 'SpeechTimeoutError') {
    return c.json(
      errorBody({
        error: 'The speech engine did not finish the transcription in time.',
        code: ApiErrorCode.GATEWAY_TIMEOUT,
      }),
      504
    )
  }
  return c.json(
    errorBody({
      error: 'The speech engine could not transcribe the recording.',
      code: ApiErrorCode.BAD_GATEWAY,
    }),
    502
  )
}

const toResponseBody = (transcript: Transcript) => ({
  text: transcript.text,
  ...(transcript.language !== undefined ? { language: transcript.language } : {}),
  ...(transcript.durationSeconds !== undefined
    ? { durationSeconds: transcript.durationSeconds }
    : {}),
  model: transcript.model,
})

type ParsedRequest =
  | {
      readonly file: File
      readonly mimeType: string
      readonly language?: string
      readonly quality?: 'fast' | 'accurate'
    }
  | { readonly refusal: string }

/** Read and check the multipart body; nothing here contacts the speech engine. */
const parseTranscriptionRequest = async (c: Context): Promise<ParsedRequest> => {
  const body = await c.req.parseBody().catch(() => undefined)
  if (body === undefined) return { refusal: 'Send the recording as multipart/form-data.' }
  const { file } = body
  if (!(file instanceof File) || file.size === 0) {
    return { refusal: 'A recording is required in the "file" field.' }
  }
  if (file.size > CHAT_RECORDING_MAX_BYTES) {
    return { refusal: OVERSIZED_REFUSAL }
  }
  const mimeType = audioMimeOf(file)
  if (mimeType === undefined) {
    return { refusal: `The file is not an audio recording (${file.type || file.name}).` }
  }
  const fields = decodeSafe(transcriptionRequestFieldsSchema)({
    language: textField(body['language']),
    quality: textField(body['quality']),
  })
  if (!fields.success) return { refusal: fields.error.message }
  return {
    file,
    mimeType,
    ...(fields.data.language !== undefined ? { language: fields.data.language } : {}),
    ...(fields.data.quality !== undefined ? { quality: fields.data.quality } : {}),
  }
}

/**
 * The anonymous and rate-limit gates, or `undefined` when the caller may go on.
 * Decided before the body is read, so a refused caller costs no upload.
 */
const gateCaller = (
  c: Context,
  app: App | undefined,
  anonLimit: AiAnonRateLimit
): Response | undefined => {
  const session = getSessionContext(c)
  if (app?.auth !== undefined && session === undefined) {
    return notFound(c, 'Not Found')
  }
  const anonymous = anonLimit(c, app, 'transcriptions')
  if (anonymous !== undefined) return anonymous
  const principal = session?.userId ?? `ip:${getRequestRateLimitKey(c)}`
  const rate = checkChatRateLimit(`transcriptions:${principal}`)
  return rate.limited ? rateLimitedResponse(c, rate.retryAfter) : undefined
}

/** Transcribe an accepted recording and shape the 200, or map the failure. */
const transcribeAccepted = async (
  c: Context,
  request: Exclude<ParsedRequest, { readonly refusal: string }>
): Promise<Response> => {
  const bytes = new Uint8Array(await request.file.arrayBuffer())
  const result = await runRequestEffect(
    c,
    provideDomain(
      c,
      transcribeRecording({
        bytes,
        fileName: request.file.name || 'recording',
        mimeType: request.mimeType,
        quality: request.quality ?? 'fast',
        ...(request.language !== undefined ? { language: request.language } : {}),
      })
    ).pipe(Effect.result)
  )
  if (result._tag === 'Failure') return speechFailureResponse(c, result.failure)
  const encoded = decodeSafe(transcriptionResponseSchema)(toResponseBody(result.success))
  if (!encoded.success) return toErrorResponse(c, encoded.error)
  return c.json(encoded.data, 200)
}

const handleTranscription = async (
  c: Context,
  app: App | undefined,
  anonLimit: AiAnonRateLimit
): Promise<Response> => {
  const refused = gateCaller(c, app, anonLimit)
  if (refused !== undefined) return refused
  // After the anonymous gate, so an oversized anonymous request is still a 404.
  if (declaresOversizedBody(c)) return badRequest(c, OVERSIZED_REFUSAL)
  const parsed = await parseTranscriptionRequest(c)
  if ('refusal' in parsed) return badRequest(c, parsed.refusal)
  return transcribeAccepted(c, parsed)
}

/** Chain `POST /api/ai/transcriptions` onto the app. Always registered. */
export function chainAiTranscriptionRoutes(honoApp: Hono, app?: App): Hono {
  const anonLimit = createAiAnonRateLimit()
  return honoApp.post('/api/ai/transcriptions', (c) => handleTranscription(c, app, anonLimit))
}
