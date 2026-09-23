/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { SpeechService } from '@/application/ports/services/speech-service'
import { StorageService } from '@/application/ports/services/storage-service'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { logError } from '@/infrastructure/logging/logger'
import {
  audioMimeForTranscription,
  resolveTranscribeSource,
  type TranscribeSource,
} from './ai-transcribe-source'
import {
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type { Transcript } from '@/application/ports/services/speech-service'

/**
 * `ai/transcribe` — turn a stored recording into text on the operator's speech
 * endpoint.
 *
 * Unlike the `ai/generate` family, a failure here FAILS the step (and so the
 * run, and so a `retry` policy re-runs it): a transcript is the input of the
 * steps that follow, and a `record/update` writing an error envelope into a
 * long-text field would be worse than a failed run an operator can see.
 */

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

const failure = (error: string): ActionOutcome => ({ status: 'failure', error })

const optionalString = (p: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = stringProp(p, key).trim()
  return p[key] === undefined || value === '' ? undefined : value
}

/**
 * The raw `source` value. The run loop renders every prop to a string, which
 * turns an attachment OBJECT into `"[object Object]"`; a whole-string
 * `{{path}}` is therefore re-read from the raw action so the attachment value
 * arrives intact. Anything else keeps the loop's rendering.
 */
const rawSource = (
  resolved: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): unknown => {
  if (runContext === undefined) return resolved['source']
  const whole = resolveRunContextValue(
    rawActionProps(runContext)['source'],
    buildRunContextView(runContext)
  )
  return typeof whole === 'object' && whole !== null ? whole : resolved['source']
}

/**
 * The recording's MIME type: the attachment's own, else the catalog's, else the key's.
 *
 * A failed catalog lookup is swallowed without a log on purpose: "no catalog
 * row" is the ordinary case for a key written outside the upload route, and the
 * extension fallback answers it. A real storage failure is not lost — the
 * download that follows hits the same store and logs its cause.
 */
const resolveMimeType = (source: TranscribeSource) =>
  Effect.gen(function* () {
    if (source.mimeType !== undefined) return source.mimeType
    const storage = yield* StorageService
    const metadata = yield* Effect.result(storage.getMetadata(source.key, source.bucket))
    const cataloged = metadata._tag === 'Success' ? metadata.success.contentType : undefined
    return cataloged !== undefined && cataloged !== 'application/octet-stream'
      ? cataloged
      : inferMimeFromKey(source.key)
  })

const toOutput = (transcript: Transcript): Readonly<Record<string, unknown>> => ({
  text: transcript.text,
  ...(transcript.language !== undefined ? { language: transcript.language } : {}),
  ...(transcript.durationSeconds !== undefined
    ? { durationSeconds: transcript.durationSeconds }
    : {}),
  model: transcript.model,
  ...(transcript.segments !== undefined ? { segments: transcript.segments } : {}),
})

export const handleAiTranscribe: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    const p = props(action)
    const source = resolveTranscribeSource(rawSource(p, runContext), optionalString(p, 'bucket'))
    if (source === undefined) {
      return failure('ai.transcribe requires a source: a storage key or an attachment value')
    }

    const mimeType = yield* resolveMimeType(source)
    const audioMime = audioMimeForTranscription(mimeType)
    if (audioMime === undefined) {
      return failure(
        `ai.transcribe needs an audio recording, but "${source.fileName}" is ${mimeType}`
      )
    }

    const storage = yield* StorageService
    // The step fails either way, but its message cannot tell a missing key from
    // a bucket mismatch or a storage outage — so the cause is logged first.
    const downloaded = yield* storage.download(source.key, source.bucket).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[automations] ai.transcribe could not read the recording', cause, {
            'sovrium.storage.bucket': source.bucket,
          })
        })
      ),
      Effect.result
    )
    if (downloaded._tag === 'Failure') return failure(`recording not found: ${source.key}`)

    const speech = yield* SpeechService
    const quality = optionalString(p, 'quality')
    const language = optionalString(p, 'language')
    const model = optionalString(p, 'model')
    const prompt = optionalString(p, 'prompt')
    const transcribed = yield* Effect.result(
      speech.transcribe({
        bytes: downloaded.success,
        fileName: source.fileName,
        mimeType: audioMime,
        quality: quality === 'fast' ? 'fast' : 'accurate',
        ...(language !== undefined ? { language } : {}),
        ...(model !== undefined ? { model } : {}),
        ...(prompt !== undefined ? { prompt } : {}),
        timestamps: p['timestamps'] === true || p['timestamps'] === 'true',
      })
    )
    if (transcribed._tag === 'Failure') return failure(transcribed.failure.message)
    return { status: 'success', output: toOutput(transcribed.success) } as const
  }).pipe(
    Effect.withSpan('automations.handle-ai-transcribe', { attributes: actionAttributes(action) })
  )
