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
import { oversizedRecordingRefusal } from '@/domain/models/process-env/ai/speech'
import { logError } from '@/infrastructure/logging/logger'
import { isTransientSpeechFailure } from '../run/retry-classification'
import {
  audioMimeForTranscription,
  audioMimeOfContainer,
  resolveTranscribeSource,
  type TranscribeSource,
} from './ai-transcribe-source'
import { CALLER_REFUSAL } from './record-caller-gate'
import { actionAttributes, stringProp } from './shared'
import { starterFileGate, starterStanding, type StarterFileGate } from './starter-file-gate'
import {
  baseMimeType,
  extractAudioTrack,
  extractionRefusal,
  isOverReadLimit,
  oversizedSourceRefusal,
  rawSource,
  VIDEO_CONTAINER_TYPES,
} from './video-audio-track'
import type { ActionHandler, ActionOutcome } from './shared'
import type { SpeechError, Transcript } from '@/application/ports/services/speech-service'
import type { App } from '@/domain/models/app'

/**
 * `ai/transcribe` — turn a stored recording into text on the operator's speech
 * endpoint.
 *
 * Unlike the `ai/generate` family, a failure here FAILS the step (and so the
 * run, and so a `retry` policy re-runs it): a transcript is the input of the
 * steps that follow, and a `record/update` writing an error envelope into a
 * long-text field would be worse than a failed run an operator can see.
 *
 * Only a failure another attempt could fix is retried: a recording refused
 * before it is sent, an unconfigured endpoint, or a `4xx` other than `408` /
 * `429` from the endpoint carries `retryable: false` and fails the run at once.
 */

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

const failure = (error: string): ActionOutcome => ({ status: 'failure', error })

/** A failure no retry can turn into a success: the same input is refused every time. */
const permanentFailure = (error: string): ActionOutcome => ({
  status: 'failure',
  error,
  retryable: false,
})

const optionalString = (p: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = stringProp(p, key).trim()
  return p[key] === undefined || value === '' ? undefined : value
}

/**
 * The recording's catalog row, read ONCE for both its MIME type and its size,
 * or `undefined` when the key has none.
 *
 * A failed lookup is swallowed without a log on purpose: "no catalog row" is
 * the ordinary case for a key written outside the upload route, and the
 * fallbacks answer it — the extension for the MIME type, the speech service's
 * own check on the downloaded bytes for the size. A real storage failure is
 * not lost: the download that follows hits the same store and logs its cause.
 */
const readCatalogRow = (source: TranscribeSource) =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const metadata = yield* Effect.result(storage.getMetadata(source.key, source.bucket))
    return metadata._tag === 'Success' ? metadata.success : undefined
  })

/** The recording's MIME type: the attachment's own, else the catalog's, else the key's. */
const resolveMimeType = (source: TranscribeSource, catalogued: string | undefined): string => {
  if (source.mimeType !== undefined) return source.mimeType
  return catalogued !== undefined && catalogued !== 'application/octet-stream'
    ? catalogued
    : inferMimeFromKey(source.key)
}

/**
 * Everything decided before a byte is downloaded: the audio MIME type, the
 * video container whose audio track is to be extracted, or the reason the step
 * fails. A recording the run's starter may not reach, an audio recording whose
 * CATALOGUED size is over `STT_MAX_FILE_BYTES`, or a video catalogued past the
 * 100 MiB read bound is refused here, so a two-hour recording is never read
 * into memory only to be refused afterwards. A video's speech limit is
 * measured on its extracted audio instead.
 *
 * `content` marks a refusal about what the file HOLDS (not audio, no audio
 * track, an audio codec no remux carries), which a hand-started run's starter
 * who is not admin-equivalent is answered as for a key nothing holds.
 */
type Refusal = { readonly refusal: string; readonly content?: true }

type Preflight = Refusal | { readonly audioMime: string } | { readonly video: string }

const preflight = (source: TranscribeSource, gate: StarterFileGate) =>
  Effect.gen(function* () {
    // Before the type check: in a run started by hand, a file the gate refuses
    // answers as a missing one does, whatever it holds.
    const refusal = yield* gate(source.key)
    if (refusal !== undefined) return { refusal } satisfies Preflight
    const row = yield* readCatalogRow(source)
    const mimeType = resolveMimeType(source, row?.contentType)
    const video = baseMimeType(mimeType)
    if (VIDEO_CONTAINER_TYPES.has(video)) {
      const decided: Preflight =
        row !== undefined && isOverReadLimit(row.size)
          ? { refusal: oversizedSourceRefusal(source.fileName) }
          : { video }
      return decided
    }
    const audioMime = audioMimeForTranscription(mimeType)
    if (audioMime === undefined) {
      const notAudio: Preflight = {
        refusal: `ai.transcribe needs an audio recording, but "${source.fileName}" is ${mimeType}`,
        content: true,
      }
      return notAudio
    }
    const { maxFileBytes } = yield* SpeechService
    const oversized =
      row === undefined || maxFileBytes === undefined
        ? undefined
        : oversizedRecordingRefusal(row.size, maxFileBytes)
    const decided: Preflight = oversized === undefined ? { audioMime } : { refusal: oversized }
    return decided
  })

/** What is sent to the speech endpoint: the bytes and the audio type they are announced as. */
type Recording = { readonly bytes: Uint8Array; readonly mimeType: string }

/**
 * The audio of a downloaded video: its extracted audio track when it holds a
 * picture; the file as it is, under its audio type, when it holds none (an
 * audio-only MP4 or WebM is sent as before). A video with no audio track, or
 * whose audio codec no audio container carries, is refused.
 */
const audioOfVideo = (bytes: Uint8Array, video: string, name: string) =>
  Effect.gen(function* () {
    if (isOverReadLimit(bytes.length)) {
      const refused: Refusal | Recording = { refusal: oversizedSourceRefusal(name) }
      return refused
    }
    const asItIs: Recording = { bytes, mimeType: audioMimeOfContainer(video) }
    const extracted = yield* extractAudioTrack(bytes)
    if ('audio' in extracted) {
      const { audio } = extracted
      const sent: Recording = audio.hadVideo
        ? { bytes: audio.bytes, mimeType: audio.mimeType }
        : asItIs
      return sent
    }
    const { error } = extracted
    // A file whose picture could not be found is sent as it was before extraction existed.
    if (!error.hadVideo && error.reason !== 'no-audio-track') return asItIs
    const refused: Refusal | Recording = {
      refusal: extractionRefusal(name, error),
      content: true,
    }
    return refused
  })

/**
 * A refusal as the step answers it: a refusal about what the file holds is
 * `Resource not found` for a hand-started run's starter who is not
 * admin-equivalent, word for word as a key nothing holds.
 */
const answerRefusal = (app: App, automation: Parameters<ActionHandler>[2], refused: Refusal) =>
  Effect.gen(function* () {
    if (refused.content !== true) return permanentFailure(refused.refusal)
    const standing = yield* starterStanding(app, automation)
    return permanentFailure(standing.kind === 'judged' ? CALLER_REFUSAL : refused.refusal)
  })

/** A failed transcription, retryable only when the speech endpoint's answer allows it. */
const speechFailure = (error: Readonly<SpeechError>): ActionOutcome =>
  isTransientSpeechFailure(error) ? failure(error.message) : permanentFailure(error.message)

const toOutput = (transcript: Transcript): Readonly<Record<string, unknown>> => ({
  text: transcript.text,
  ...(transcript.language !== undefined ? { language: transcript.language } : {}),
  ...(transcript.durationSeconds !== undefined
    ? { durationSeconds: transcript.durationSeconds }
    : {}),
  model: transcript.model,
  ...(transcript.segments !== undefined ? { segments: transcript.segments } : {}),
})

/** Send `recording` to the speech endpoint with the step's hints. */
const transcribeRecording = (
  p: Readonly<Record<string, unknown>>,
  source: TranscribeSource,
  recording: Recording
) =>
  Effect.gen(function* () {
    const speech = yield* SpeechService
    const quality = optionalString(p, 'quality')
    const language = optionalString(p, 'language')
    const model = optionalString(p, 'model')
    const prompt = optionalString(p, 'prompt')
    return yield* speech.transcribe({
      bytes: recording.bytes,
      fileName: source.fileName,
      mimeType: recording.mimeType,
      quality: quality === 'fast' ? 'fast' : 'accurate',
      ...(language !== undefined ? { language } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(prompt !== undefined ? { prompt } : {}),
      timestamps: p['timestamps'] === true || p['timestamps'] === 'true',
    })
  })

export const handleAiTranscribe: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const p = props(action)
    const source = resolveTranscribeSource(rawSource(p, runContext), optionalString(p, 'bucket'))
    if (source === undefined) {
      return permanentFailure(
        'ai.transcribe requires a source: a storage key or an attachment value'
      )
    }

    const checked = yield* preflight(source, starterFileGate(app, automation))
    if ('refusal' in checked) return yield* answerRefusal(app, automation, checked)

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
    const recording: Refusal | Recording =
      'video' in checked
        ? yield* audioOfVideo(downloaded.success, checked.video, source.fileName)
        : { bytes: downloaded.success, mimeType: checked.audioMime }
    if ('refusal' in recording) return yield* answerRefusal(app, automation, recording)

    const transcribed = yield* Effect.result(transcribeRecording(p, source, recording))
    if (transcribed._tag === 'Failure') return speechFailure(transcribed.failure)
    return { status: 'success', output: toOutput(transcribed.success) } as const
  }).pipe(
    Effect.withSpan('automations.handle-ai-transcribe', { attributes: actionAttributes(action) })
  )
