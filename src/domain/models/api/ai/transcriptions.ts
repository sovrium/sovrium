/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * API contract for `POST /api/ai/transcriptions` — speech-to-text for the chat
 * push-to-talk surface.
 *
 * **Request shape.** The body is `multipart/form-data`. Its binary `file` part
 * (the recording, carrying its own filename and `Content-Type`) is NOT modelled
 * here: Effect Schema does not describe a binary part, so the route reads it
 * with Hono's `c.req.parseBody()` and asserts `file instanceof File`, exactly as
 * the bucket upload route does. What IS modelled is the set of TEXT fields that
 * travel beside it — {@link transcriptionRequestFieldsSchema} — decoded from the
 * parsed body once the file part is set aside.
 *
 * **Response shape.** {@link transcriptionResponseSchema} — the transcript and
 * the model that produced it. The recording itself is never stored: it is
 * transcribed and discarded.
 *
 * **Refusals** use the ordinary error envelope: 400 for a missing, non-audio or
 * oversized file, 404 for an anonymous caller when the app declares `auth`
 * (anti-enumeration), 429 when rate-limited, 503 when no speech provider is
 * configured.
 */

/**
 * The text fields of a transcription request (the `file` part is read
 * separately — see the module note).
 *
 * `language` repeats the automation action's ISO 639-1 rule rather than
 * importing the app-model schema: a wire contract states its own constraints,
 * so the published OpenAPI document does not depend on a domain annotation.
 *
 * @public Awaiting its route: `POST /api/ai/transcriptions` lands with chat voice
 * input.
 */
export const transcriptionRequestFieldsSchema = Schema.Struct({
  language: optionalField(
    Schema.String.annotate({
      description:
        'Language spoken in the recording, as a two-letter lowercase ISO 639-1 code (e.g. "fr"). Omit it to let the speech engine detect the language.',
    }).pipe(Schema.check(Schema.isPattern(/^[a-z]{2}$/)))
  ),
  quality: optionalField(
    Schema.Literals(['fast', 'accurate']).annotate({
      description:
        'Speech-to-text tier: "fast" (live dictation) or "accurate" (fidelity). Omit it to use the surface default, which is "fast" for chat.',
    })
  ),
})

/** @public */
export type TranscriptionRequestFields = typeof transcriptionRequestFieldsSchema.Type

/**
 * Response schema for `POST /api/ai/transcriptions` (HTTP 200).
 *
 * @public Awaiting its route: `POST /api/ai/transcriptions` lands with chat voice
 * input.
 */
export const transcriptionResponseSchema = Schema.Struct({
  text: Schema.String.annotate({
    description: 'The transcript of the recording, as plain text',
  }),
  language: optionalField(
    Schema.String.annotate({
      description:
        'Language the speech engine reports for the recording (ISO 639-1), when it reports one',
    })
  ),
  durationSeconds: optionalField(
    Schema.Finite.annotate({
      description: 'Length of the recording in seconds, when the speech engine reports it',
    }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
  ),
  model: Schema.String.annotate({
    description: 'The speech model that produced the transcript (e.g. "whisper-large-v3-turbo")',
  }),
})

/** @public */
export type TranscriptionResponse = typeof transcriptionResponseSchema.Type
