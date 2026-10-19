/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Audio-track extraction port: copy the audio track of a stored video into an
 * audio-only file, byte for byte (a REMUX — nothing is decoded or re-encoded).
 *
 * The output container follows the source: AAC in ISO-BMFF (MP4, QuickTime,
 * fragmented MP4) becomes a progressive `.m4a`; Opus or Vorbis in Matroska or
 * WebM becomes a seekable `.webm`. Shared by `file/extractAudio` and
 * `ai/transcribe`, so both read a video the same way.
 */

/** The audio-only file a remux produced. */
export interface ExtractedAudio {
  readonly bytes: Uint8Array
  readonly mimeType: 'audio/mp4' | 'audio/webm'
  readonly extension: 'm4a' | 'webm'
  /** Whether the source carried a video track beside its audio. */
  readonly hadVideo: boolean
}

/**
 * Why a file yielded no audio:
 *
 * - `not-a-container` — neither ISO-BMFF nor Matroska/WebM;
 * - `no-audio-track` — the container holds no audio track;
 * - `unsupported-codec` — its audio codec has no audio container to be copied
 *   into (`codec` names it, e.g. `A_PCM/INT/LIT`);
 * - `malformed` — the container could not be read.
 */
export type AudioExtractReason =
  'not-a-container' | 'no-audio-track' | 'unsupported-codec' | 'malformed'

/** A file the remux could not take an audio track out of. */
export class AudioExtractError extends Data.TaggedError('AudioExtractError')<{
  readonly reason: AudioExtractReason
  readonly message: string
  /** The codec found, for `unsupported-codec`. */
  readonly codec?: string
  /** Whether the source carried a video track, when that much could be read. */
  readonly hadVideo: boolean
}> {}

export class AudioTrackExtractor extends Context.Service<
  AudioTrackExtractor,
  {
    readonly extract: (bytes: Uint8Array) => Effect.Effect<ExtractedAudio, AudioExtractError>
  }
>()('AudioTrackExtractor') {}
