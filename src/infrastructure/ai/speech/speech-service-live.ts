/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  SpeechInputError,
  SpeechNotConfiguredError,
  SpeechService,
  type TranscribeInput,
} from '@/application/ports/services/speech-service'
import {
  parseSpeechEnv,
  resolveSpeechModel,
  speechPrecedenceRefusal,
  type SpeechConfig,
} from '@/domain/models/process-env/ai/speech'
import { transcribeOverHttp } from './speech-adapters'

/**
 * The speech-to-text service, read from the `STT_*` environment once, when the
 * layer is built.
 *
 * The layer body does no I/O, like `AiServiceLive` — nothing is probed at
 * boot. An unset `STT_PROVIDER` builds an INERT service: the app runs, and a
 * transcription fails with "speech-to-text is not configured". An invalid env
 * never reaches here as a crash either: startup validation
 * (`validate-speech-configuration.ts`) refuses the boot first, and the service
 * degrades to inert if it is ever built without that gate.
 */

const NOT_CONFIGURED =
  'speech-to-text is not configured: set STT_PROVIDER (and STT_BASE_URL) to a speech server to enable transcription'

/** Refuse a recording above `STT_MAX_FILE_BYTES` before any byte leaves the process. */
const checkSize = (
  config: SpeechConfig,
  input: TranscribeInput
): Effect.Effect<void, SpeechInputError> =>
  input.bytes.length > config.maxFileBytes
    ? Effect.fail(
        new SpeechInputError({
          message: `the recording is ${String(input.bytes.length)} bytes, above the ${String(config.maxFileBytes)}-byte limit (STT_MAX_FILE_BYTES)`,
        })
      )
    : Effect.void

const makeConfigured = (config: SpeechConfig, refusal: string | undefined) =>
  SpeechService.of({
    transcribe: (input) =>
      refusal !== undefined
        ? Effect.fail(new SpeechNotConfiguredError({ message: refusal }))
        : checkSize(config, input).pipe(
            Effect.flatMap(() =>
              transcribeOverHttp({
                config,
                input,
                model: resolveSpeechModel(config, input.quality ?? 'accurate', input.model),
              })
            )
          ),
  })

const inert = SpeechService.of({
  transcribe: () => Effect.fail(new SpeechNotConfiguredError({ message: NOT_CONFIGURED })),
})

export const SpeechServiceLive = Layer.effect(
  SpeechService,
  Effect.sync(() => {
    const parsed = parseSpeechEnv(process.env)
    if (!parsed.ok) {
      const message = parsed.error
      return SpeechService.of({
        transcribe: () => Effect.fail(new SpeechNotConfiguredError({ message })),
      })
    }
    const { config } = parsed
    return config === undefined
      ? inert
      : makeConfigured(config, speechPrecedenceRefusal(config, process.env))
  })
)
