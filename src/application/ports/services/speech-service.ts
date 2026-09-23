/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { SpeechTier } from '@/domain/models/process-env/ai/speech'
import type { Effect } from 'effect'

/**
 * Speech-to-text port.
 *
 * One operation: turn a recording into text on the operator-run speech
 * endpoint configured by the `STT_*` environment variables. The port knows
 * nothing about HTTP shapes — the OpenAI-compatible route and whisper.cpp's
 * `/inference` route are adapters behind it.
 */

/**
 * Speech-to-text is not configured (`STT_PROVIDER` unset), or the configured
 * provider may not be used under the active precedence. The app still boots;
 * only a transcription fails, with an operator-readable reason.
 */
export class SpeechNotConfiguredError extends Data.TaggedError('SpeechNotConfiguredError')<{
  readonly message: string
}> {}

/** The recording was refused before anything was sent (too large, not audio). */
export class SpeechInputError extends Data.TaggedError('SpeechInputError')<{
  readonly message: string
}> {}

/** The speech endpoint answered with a non-2xx status or an unreadable body. */
export class SpeechProviderError extends Data.TaggedError('SpeechProviderError')<{
  readonly statusCode: number
  readonly message: string
  readonly cause?: unknown
}> {}

/** The request exceeded `STT_TIMEOUT_MS`; the socket was aborted. */
export class SpeechTimeoutError extends Data.TaggedError('SpeechTimeoutError')<{
  readonly message: string
  readonly timeoutMs: number
}> {}

/** Every failure the `SpeechService` port can surface. */
export type SpeechError =
  SpeechNotConfiguredError | SpeechInputError | SpeechProviderError | SpeechTimeoutError

/** One recording to transcribe, and the author's intent for it. */
export interface TranscribeInput {
  readonly bytes: Uint8Array
  readonly fileName: string
  /** An `audio/*` MIME type — the caller has already refused anything else. */
  readonly mimeType: string
  /** Two-letter ISO 639-1 hint; omitted lets the engine detect the language. */
  readonly language?: string
  /** Tier the model is resolved from; `accurate` when omitted. */
  readonly quality?: SpeechTier
  /** Exact model, overriding the tier. */
  readonly model?: string
  /** Vocabulary hint: names and jargon the engine should expect. */
  readonly prompt?: string
  /** Ask for per-segment timings. */
  readonly timestamps?: boolean
}

/** One timed stretch of a transcript, times in seconds. */
export interface TranscriptSegment {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** What a transcription returns. */
export interface Transcript {
  readonly text: string
  readonly language?: string
  readonly durationSeconds?: number
  /** The model that produced the text — the requested one, or what the server reported. */
  readonly model: string
  /** Present only when `timestamps` was asked for and the engine returned them. */
  readonly segments?: readonly TranscriptSegment[]
}

export class SpeechService extends Context.Service<
  SpeechService,
  {
    readonly transcribe: (input: TranscribeInput) => Effect.Effect<Transcript, SpeechError>
  }
>()('SpeechService') {}
