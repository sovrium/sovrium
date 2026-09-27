/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  SpeechService,
  type SpeechError,
  type TranscribeInput,
  type Transcript,
} from '@/application/ports/services/speech-service'

/**
 * Transcribe one recording that arrived with a request — chat dictation.
 *
 * The bytes are passed straight to the speech port and never reach storage:
 * dictation is transcribed and discarded. The caller has already refused a
 * missing, oversized or non-audio file, so every failure left is the speech
 * endpoint's (not configured, refused, timed out).
 */
export const transcribeRecording = (
  input: TranscribeInput
): Effect.Effect<Transcript, SpeechError, SpeechService> =>
  Effect.gen(function* () {
    const speech = yield* SpeechService
    return yield* speech.transcribe(input)
  }).pipe(
    Effect.withSpan('ai.transcribe-recording', {
      attributes: {
        'sovrium.speech.bytes': input.bytes.length,
        'sovrium.speech.quality': input.quality ?? 'accurate',
      },
    })
  )
