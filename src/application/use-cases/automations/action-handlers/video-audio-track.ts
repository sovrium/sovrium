/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AudioTrackExtractor,
  type AudioExtractError,
  type ExtractedAudio,
} from '@/application/ports/services/audio-track-extractor'
import {
  StorageService,
  UNATTRIBUTED_BUCKET,
  isStorageObjectTooLarge,
} from '@/application/ports/services/storage-service'
import { logError } from '@/infrastructure/logging/logger'
import { FILE_SOURCE_MAX_BYTES } from './file-support'
import { authoredActionProps, resolveOwnProp } from './run-context-resolution'
import type { ActionRunContext } from './shared'

/**
 * THE AUDIO TRACK OF A STORED VIDEO, read the one way `file/extractAudio` and
 * `ai/transcribe` share: the source read under the 100 MiB bound every `file`
 * source shares (its catalogued size checked BEFORE a byte is downloaded),
 * then the remux behind {@link AudioTrackExtractor}, with one wording for each
 * reason a video yields no audio.
 */

/** The video containers whose audio track can be taken out. */
export const VIDEO_CONTAINER_TYPES: ReadonlySet<string> = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
])

/** A MIME type without its parameters, lower-cased. */
export const baseMimeType = (mimeType: string): string =>
  mimeType.split(';')[0]!.trim().toLowerCase()

/**
 * The raw `source` value. The run loop renders every prop to a string, which
 * turns an attachment OBJECT into `"[object Object]"`; a whole-string
 * `{{path}}` is therefore re-read from the raw action so the attachment value
 * arrives intact. Anything else keeps the loop's rendering.
 */
export const rawSource = (
  resolved: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): unknown => {
  if (runContext === undefined) return resolved['source']
  const whole = resolveOwnProp(runContext, authoredActionProps(runContext)['source'])
  return typeof whole === 'object' && whole !== null ? whole : resolved['source']
}

/** The refusal of a source past the read bound, naming it. */
export const oversizedSourceRefusal = (name: string): string =>
  `"${name}" is larger than the 100 MiB limit a file source is read up to`

/** Whether a catalogued size is past the read bound. */
export const isOverReadLimit = (size: number): boolean => size > FILE_SOURCE_MAX_BYTES

/** Why `name` yielded no audio, in the step's words. */
export const extractionRefusal = (name: string, error: Readonly<AudioExtractError>): string => {
  switch (error.reason) {
    case 'no-audio-track':
      return `"${name}" holds no audio track`
    case 'unsupported-codec':
      return `the audio of "${name}" is ${error.codec ?? 'an unknown codec'}, which cannot be copied into an audio file without re-encoding it: only AAC from an MP4, QuickTime or Matroska video, and Opus or Vorbis from a Matroska or WebM video, are extracted`
    case 'not-a-container':
      return `"${name}" is not an MP4, QuickTime, Matroska or WebM video`
    case 'malformed':
      return `"${name}" could not be read as a video: ${error.message}`
  }
}

/** Why a file filed as a video could not be read as one, in the step's words. */
export const unreadableVideoRefusal = (name: string, error: Readonly<AudioExtractError>): string =>
  error.reason === 'malformed'
    ? extractionRefusal(name, error)
    : `"${name}" could not be read as a video: it is not an MP4, QuickTime, Matroska or WebM container`

/** A stored source read whole, or why it was not. */
export type BoundedRead =
  { readonly bytes: Uint8Array } | { readonly refusal: string; readonly missing?: true }

/**
 * Read `key` under the 100 MiB bound: a catalogued size past it is refused
 * before any byte is downloaded, and the download stops at the bound (a key
 * written out of band has no catalog row).
 */
export const readBoundedSource = Effect.fn('automations.read-bounded-source')(function* (
  key: string,
  name: string
) {
  const storage = yield* StorageService
  // No catalog row is the ordinary case for a key written out of band; the
  // download below re-measures the bytes, and logs a store that fails.
  const meta = yield* Effect.result(storage.getMetadata(key, UNATTRIBUTED_BUCKET))
  if (meta._tag === 'Success' && isOverReadLimit(meta.success.size)) {
    const refused: BoundedRead = { refusal: oversizedSourceRefusal(name) }
    return refused
  }
  // The bounded download stops at the cap. A step that fails cannot tell a
  // missing key from a storage outage in its message — so the cause is logged.
  const downloaded = yield* Effect.result(
    storage.downloadBounded(key, UNATTRIBUTED_BUCKET, FILE_SOURCE_MAX_BYTES)
  )
  if (downloaded._tag === 'Success') {
    const read: BoundedRead = { bytes: downloaded.success }
    return read
  }
  if (isStorageObjectTooLarge(downloaded.failure)) {
    const refused: BoundedRead = { refusal: oversizedSourceRefusal(name) }
    return refused
  }
  yield* Effect.sync(() => {
    logError('[automations] a video source could not be read', downloaded.failure)
  })
  const missing: BoundedRead = { refusal: `file not found: ${key}`, missing: true }
  return missing
})

/** The audio track of `bytes`, or the typed reason there is none. */
export const extractAudioTrack = (
  bytes: Uint8Array
): Effect.Effect<
  { readonly audio: ExtractedAudio } | { readonly error: AudioExtractError },
  never,
  AudioTrackExtractor
> =>
  Effect.gen(function* () {
    const extractor = yield* AudioTrackExtractor
    const result = yield* Effect.result(extractor.extract(bytes))
    return result._tag === 'Success' ? { audio: result.success } : { error: result.failure }
  }).pipe(Effect.withSpan('automations.extract-audio-track'))
