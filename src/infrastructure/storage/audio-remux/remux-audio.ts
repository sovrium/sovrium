/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readIsoAudioTrack } from './iso-bmff-read'
import { writeM4a, writeMatroskaAacM4a } from './iso-bmff-write'
import { readMatroskaAudioTrack } from './matroska-read'
import { writeWebmAudio } from './matroska-write'
import { latin1, RemuxRefusal } from './media-bytes'
import type { ExtractedAudio } from '@/application/ports/services/audio-track-extractor'

/**
 * The audio remux: tell the container from its first bytes, take its audio
 * track out, and write it into the audio container its codec belongs to —
 * AAC into an M4A whatever it came in, Opus and Vorbis into a WebM.
 * Throws a {@link RemuxRefusal}; the adapter turns it into a typed error.
 */

export type MediaContainer = 'iso-bmff' | 'matroska'

/** Box types an ISO-BMFF file may open with (`.mov` files often lead with `wide` or `mdat`). */
const ISO_BMFF_LEADING_BOXES: ReadonlySet<string> = new Set([
  'ftyp',
  'moov',
  'mdat',
  'wide',
  'free',
  'skip',
  'styp',
  'pnot',
])

/** The container `bytes` are written in, read from their first bytes alone. */
export const detectContainer = (bytes: Uint8Array): MediaContainer | undefined => {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return 'matroska'
  }
  if (bytes.length >= 8 && ISO_BMFF_LEADING_BOXES.has(latin1(bytes, 4, 4))) return 'iso-bmff'
  return undefined
}

/** The audio track of the video in `bytes`, as an audio-only file. */
export const remuxAudio = (bytes: Uint8Array): ExtractedAudio => {
  const container = detectContainer(bytes)
  if (container === 'iso-bmff') {
    const track = readIsoAudioTrack(bytes)
    return {
      bytes: writeM4a(bytes, track),
      mimeType: 'audio/mp4',
      extension: 'm4a',
      hadVideo: track.hadVideo,
    }
  }
  if (container === 'matroska') {
    const track = readMatroskaAudioTrack(bytes)
    if (track.codec === 'A_AAC') {
      return {
        bytes: writeMatroskaAacM4a(bytes, track),
        mimeType: 'audio/mp4',
        extension: 'm4a',
        hadVideo: track.hadVideo,
      }
    }
    return {
      bytes: writeWebmAudio(track),
      mimeType: 'audio/webm',
      extension: 'webm',
      hadVideo: track.hadVideo,
    }
  }
  throw new RemuxRefusal('not-a-container', 'is not an MP4, QuickTime, Matroska or WebM file')
}
