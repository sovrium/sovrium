/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  AudioExtractError,
  AudioTrackExtractor,
} from '@/application/ports/services/audio-track-extractor'
import { logError } from '@/infrastructure/logging/logger'
import { RemuxRefusal } from './audio-remux/media-bytes'
import { remuxAudio } from './audio-remux/remux-audio'

/**
 * The audio-track extractor: the pure-TypeScript remux in `audio-remux/`, run
 * synchronously over bytes already in memory (the callers bound the read).
 * A refusal the parsers throw becomes an {@link AudioExtractError}. Anything
 * else they throw is a parser bug the file tripped: it is logged with its
 * cause, and the step is told only that the file could not be read, so an
 * engine-internal message never reaches a run's output.
 */
const toError = (cause: unknown): AudioExtractError => {
  if (cause instanceof RemuxRefusal) {
    return new AudioExtractError({
      reason: cause.reason,
      message: cause.message,
      hadVideo: cause.hadVideo,
      ...(cause.codec !== undefined ? { codec: cause.codec } : {}),
    })
  }
  logError('[storage] the audio remux threw on a file it should have refused', cause)
  return new AudioExtractError({
    reason: 'malformed',
    message: 'its structure could not be read',
    hadVideo: false,
  })
}

export const AudioTrackExtractorLive = Layer.succeed(
  AudioTrackExtractor,
  AudioTrackExtractor.of({
    extract: (bytes) =>
      Effect.try({ try: () => remuxAudio(bytes), catch: toError }).pipe(
        Effect.withSpan('storage.audio-track-extract', {
          attributes: { 'sovrium.bytes': bytes.length },
        })
      ),
  })
)
