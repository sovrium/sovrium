/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService, type BucketBinding } from '@/application/ports/services/storage-service'
import { resolveTranscribeSource } from './ai-transcribe-source'
import { recordedBucket } from './file-ops'
import { tempKey, uploadArtifactTo } from './file-support'
import { recordOwnCopy, type RunWrittenFiles } from './run-written-files'
import { actionAttributes, stringProp } from './shared'
import { starterFileGate } from './starter-file-gate'
import {
  extractAudioTrack,
  extractionRefusal,
  rawSource,
  readBoundedSource,
} from './video-audio-track'
import type { ActionHandler, ActionOutcome } from './shared'
import type { AudioTrackExtractor } from '@/application/ports/services/audio-track-extractor'
import type { ImageTransformService } from '@/application/ports/services/image-transform-service'

/**
 * `file/extractAudio` — copy the audio track of a stored video into an
 * audio-only file. A remux: AAC from MP4 or QuickTime becomes an
 * `.m4a`, Opus or Vorbis from Matroska or WebM a `.webm`, nothing re-encoded.
 *
 * Every refusal FAILS the step — a missing source, a video past the read
 * bound, one with no audio track or whose codec no audio container carries —
 * and nothing is written. In a run started by hand the gates of
 * `gated-file-operator.ts` judge the source and the destination first.
 */

/** The media services the `file` steps run: the image transform and the audio remux. */
export type MediaStepRequirements = ImageTransformService | AudioTrackExtractor

const props = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] as Record<string, unknown> | undefined) ?? {}

const failure = (error: string): ActionOutcome => ({ status: 'failure', error })

/**
 * Record the extracted audio as this run's own file, with its SOURCE's
 * standing: written in the bucket its source is recorded in, its bytes count
 * as brought in by the run only when the source's did — the rule a copy
 * follows, since the audio is a copy of the source's sound.
 */
const recordExtractedAudio = (
  written: RunWrittenFiles | undefined,
  audio: { readonly bucket: BucketBinding; readonly sourceKey: string; readonly key: string }
): Effect.Effect<void> =>
  Effect.sync(() =>
    recordOwnCopy(written, {
      bucket: audio.bucket,
      sourceKey: audio.sourceKey,
      destinationKey: audio.key,
    })
  )

export const handleFileExtractAudio: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const p = props(action)
    const source = resolveTranscribeSource(rawSource(p, runContext), undefined)
    if (source === undefined) {
      return failure('file.extractAudio requires a source: a storage key or an attachment value')
    }
    // The gates judged the rendered prop; an attachment value is judged here by the key it names.
    const refused = yield* starterFileGate(app, automation)(source.key)
    if (refused !== undefined) return failure(refused)

    const read = yield* readBoundedSource(source.key, source.fileName)
    if ('refusal' in read) return failure(read.refusal)
    const extracted = yield* extractAudioTrack(read.bytes)
    if ('error' in extracted) return failure(extractionRefusal(source.fileName, extracted.error))
    const { audio } = extracted

    const storage = yield* StorageService
    const bucket = yield* recordedBucket(storage, source.key)
    const destination = stringProp(p, 'destination').trim()
    const key = destination !== '' ? destination : tempKey(`.${audio.extension}`)
    const file = { bytes: audio.bytes, contentType: audio.mimeType }
    const wrote = yield* uploadArtifactTo(storage, key, file, bucket)
    if (!wrote) return failure(`failed to write the audio to ${key}`)
    yield* recordExtractedAudio(automation.writtenFiles, { bucket, sourceKey: source.key, key })

    return {
      status: 'success',
      output: {
        key,
        mimeType: audio.mimeType,
        extension: audio.extension,
        size: audio.bytes.length,
      },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-file-extract-audio', {
      attributes: actionAttributes(action),
    })
  )
