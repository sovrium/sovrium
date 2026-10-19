/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { EBML_ID, elementIdBytes, writeElement, writeFloat, writeString, writeUint } from './ebml'
import { concatBytes } from './media-bytes'
import type { MatroskaAudioTrack } from './matroska-read'

/**
 * Writing a seekable audio-only WebM: the EBML header (DocType `webm`), then
 * one Segment of known size holding a SeekHead, Info (with a Duration), the
 * one audio TrackEntry as the source stored it, Clusters of known size whose
 * blocks are copied byte for byte, and Cues pointing at every Cluster.
 */

const WRITER = 'Sovrium'

const ebmlHeader = (): Uint8Array =>
  writeElement(EBML_ID.header, [
    writeUint(EBML_ID.ebmlVersion, 1),
    writeUint(EBML_ID.ebmlReadVersion, 1),
    writeUint(EBML_ID.ebmlMaxIdLength, 4),
    writeUint(EBML_ID.ebmlMaxSizeLength, 8),
    writeString(EBML_ID.docType, 'webm'),
    writeUint(EBML_ID.docTypeVersion, 4),
    writeUint(EBML_ID.docTypeReadVersion, 2),
  ])

/** A SeekHead naming where `targets` start; positions are 8 bytes so its size never moves. */
const seekHead = (
  targets: readonly { readonly id: number; readonly position: number }[]
): Uint8Array =>
  writeElement(
    EBML_ID.seekHead,
    targets.map((target) =>
      writeElement(EBML_ID.seek, [
        writeElement(EBML_ID.seekId, [elementIdBytes(target.id)]),
        writeUint(EBML_ID.seekPosition, target.position, 8),
      ])
    )
  )

const info = (track: MatroskaAudioTrack): Uint8Array =>
  writeElement(EBML_ID.info, [
    writeUint(EBML_ID.timecodeScale, track.timecodeScale),
    writeFloat(EBML_ID.duration, track.durationTicks),
    writeString(EBML_ID.muxingApp, WRITER),
    writeString(EBML_ID.writingApp, WRITER),
  ])

const cues = (track: MatroskaAudioTrack, positions: readonly number[]): Uint8Array =>
  writeElement(
    EBML_ID.cues,
    track.clusters.map((cluster, i) =>
      writeElement(EBML_ID.cuePoint, [
        writeUint(EBML_ID.cueTime, cluster.timecode),
        writeElement(EBML_ID.cueTrackPositions, [
          writeUint(EBML_ID.cueTrack, track.trackNumber),
          writeUint(EBML_ID.cueClusterPosition, positions[i]!),
        ]),
      ])
    )
  )

/** The WebM file holding `track`'s audio. */
export const writeWebmAudio = (track: MatroskaAudioTrack): Uint8Array => {
  const infoBytes = info(track)
  const tracksBytes = writeElement(EBML_ID.tracks, [track.trackEntry])
  const clusterBytes = track.clusters.map((cluster) =>
    writeElement(EBML_ID.cluster, [
      writeUint(EBML_ID.timecode, cluster.timecode),
      ...cluster.blocks,
    ])
  )
  const placeholder = seekHead([
    { id: EBML_ID.info, position: 0 },
    { id: EBML_ID.tracks, position: 0 },
    { id: EBML_ID.cues, position: 0 },
  ])
  // Positions are relative to the Segment's payload, where the SeekHead starts.
  const infoAt = placeholder.length
  const tracksAt = infoAt + infoBytes.length
  // Where each Cluster starts, then where the Cues start: one entry more than clusters.
  const clusterPositions = new Array<number>(clusterBytes.length + 1)
  clusterPositions[0] = tracksAt + tracksBytes.length
  clusterBytes.forEach((bytes, i) => {
    clusterPositions[i + 1] = clusterPositions[i]! + bytes.length
  })
  const cuesAt = clusterPositions[clusterBytes.length]!
  const head = seekHead([
    { id: EBML_ID.info, position: infoAt },
    { id: EBML_ID.tracks, position: tracksAt },
    { id: EBML_ID.cues, position: cuesAt },
  ])
  const segment = writeElement(EBML_ID.segment, [
    head,
    infoBytes,
    tracksBytes,
    ...clusterBytes,
    cues(track, clusterPositions.slice(0, clusterBytes.length)),
  ])
  return concatBytes([ebmlHeader(), segment])
}
