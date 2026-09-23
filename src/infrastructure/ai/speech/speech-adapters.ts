/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { audioPart, parseTranscript, postTranscription } from './speech-request'
import type {
  SpeechProviderError,
  SpeechTimeoutError,
  Transcript,
  TranscribeInput,
} from '@/application/ports/services/speech-service'
import type { SpeechConfig } from '@/domain/models/process-env/ai/speech'

/**
 * The two HTTP shapes Sovrium speaks to a speech server ([internal ref] D1).
 *
 * - OpenAI's `POST {STT_BASE_URL}/audio/transcriptions` — the de facto local
 *   standard (Speaches, LocalAI), and OpenAI's and Mistral's hosted APIs.
 * - whisper.cpp's bundled server, `POST {STT_BASE_URL}/inference`, which takes
 *   no model (it serves the one it was started with) and a `temperature`.
 *
 * Both ask for `verbose_json`, the only format that carries the detected
 * language, the duration and the segments; Mistral's API does not take the
 * field and answers that shape on its own.
 */

type SpeechRequestError = SpeechProviderError | SpeechTimeoutError

/** What an adapter needs beyond the recording: the resolved model. */
export interface SpeechRequest {
  readonly config: SpeechConfig
  readonly input: TranscribeInput
  readonly model: string | undefined
}

const appendOptional = (form: FormData, key: string, value: string | undefined): void => {
  if (value !== undefined && value !== '') form.append(key, value)
}

/** Build the OpenAI transcription form: `file`, `model`, and the optional hints. */
const openAiForm = (request: SpeechRequest): FormData => {
  const { config, input, model } = request
  const form = new FormData()
  form.append('file', audioPart(input.bytes, input.mimeType), input.fileName)
  appendOptional(form, 'model', model)
  appendOptional(form, 'language', input.language)
  appendOptional(form, 'prompt', input.prompt)
  if (config.provider !== 'mistral') form.append('response_format', 'verbose_json')
  if (input.timestamps === true) form.append('timestamp_granularities[]', 'segment')
  return form
}

/** Build whisper.cpp's `/inference` form: `file`, the hints, a JSON format, greedy decoding. */
const whisperCppForm = (request: SpeechRequest): FormData => {
  const { input } = request
  const form = new FormData()
  form.append('file', audioPart(input.bytes, input.mimeType), input.fileName)
  appendOptional(form, 'language', input.language)
  appendOptional(form, 'prompt', input.prompt)
  form.append('response_format', 'verbose_json')
  form.append('temperature', '0.0')
  return form
}

/** Send one transcription to whichever route shape `STT_PROVIDER` names. */
export const transcribeOverHttp = (
  request: SpeechRequest
): Effect.Effect<Transcript, SpeechRequestError> => {
  const { config } = request
  const isWhisperCpp = config.provider === 'whisper-cpp'
  return postTranscription({
    url: `${config.baseUrl}${isWhisperCpp ? '/inference' : '/audio/transcriptions'}`,
    form: isWhisperCpp ? whisperCppForm(request) : openAiForm(request),
    ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
    timeoutMs: config.timeoutMs,
  }).pipe(
    Effect.flatMap((payload) =>
      parseTranscript(payload, {
        model: request.model,
        timestamps: request.input.timestamps === true,
      })
    )
  )
}
