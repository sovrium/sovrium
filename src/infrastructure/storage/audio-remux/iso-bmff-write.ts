/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { writeBox, writeFullBox } from './iso-bmff-boxes'
import { concatBytes, latin1Bytes, malformed, uintBytes } from './media-bytes'
import type { EditEntry, IsoAudioTrack, MediaHeader } from './iso-bmff-read'

/**
 * Writing a progressive M4A around one AAC track: `ftyp` (`M4A `), then a
 * `moov` indexing the track as a single chunk, then one `mdat` holding only
 * its samples, copied byte for byte. The sample description (`stsd`) is the
 * source's own; the timing tables are rebuilt from the sample list, so a
 * fragmented source comes out indexed like any other.
 */

const U32_MAX = 0xff_ff_ff_ff

const u32 = (value: number): Uint8Array => uintBytes(value, 4)
const u64 = (value: number): Uint8Array => uintBytes(value, 8)
const u16 = (value: number): Uint8Array => uintBytes(value, 2)
const zeros = (length: number): Uint8Array => new Uint8Array(length)

/** The unity matrix every track and movie header carries. */
const UNITY_MATRIX = concatBytes(
  [0x00_01_00_00, 0, 0, 0, 0x00_01_00_00, 0, 0, 0, 0x40_00_00_00].map((value) => u32(value))
)

const ftyp = (): Uint8Array =>
  writeBox('ftyp', [
    latin1Bytes('M4A '),
    u32(0x2_00),
    latin1Bytes('M4A '),
    latin1Bytes('mp42'),
    latin1Bytes('isom'),
  ])

/** A time field of a version-0 or version-1 header, by whether 32 bits hold it. */
const needsV1 = (...values: readonly number[]): boolean => values.some((value) => value > U32_MAX)

const mvhd = (timescale: number, duration: number): Uint8Array => {
  const v1 = needsV1(duration)
  const time = v1 ? u64 : u32
  return writeFullBox('mvhd', v1 ? 1 : 0, 0, [
    time(0),
    time(0),
    u32(timescale),
    time(duration),
    u32(0x00_01_00_00),
    u16(0x01_00),
    zeros(10),
    UNITY_MATRIX,
    zeros(24),
    u32(2),
  ])
}

const tkhd = (duration: number): Uint8Array => {
  const v1 = needsV1(duration)
  const time = v1 ? u64 : u32
  // flags 0x3: enabled and in the movie; volume 1.0; no width or height.
  return writeFullBox('tkhd', v1 ? 1 : 0, 0x3, [
    time(0),
    time(0),
    u32(1),
    zeros(4),
    time(duration),
    zeros(8),
    u16(0),
    u16(0),
    u16(0x01_00),
    zeros(2),
    UNITY_MATRIX,
    u32(0),
    u32(0),
  ])
}

const elst = (edits: readonly EditEntry[]): Uint8Array => {
  const v1 = edits.some(
    (edit) =>
      needsV1(edit.segmentDuration) ||
      edit.mediaTime > 0x7f_ff_ff_ff ||
      edit.mediaTime < -0x80_00_00_00
  )
  const entries = edits.map((edit) =>
    v1
      ? concatBytes([u64(edit.segmentDuration), signed64(edit.mediaTime), u32(edit.rate)])
      : concatBytes([u32(edit.segmentDuration), signed32(edit.mediaTime), u32(edit.rate)])
  )
  return writeBox('edts', [writeFullBox('elst', v1 ? 1 : 0, 0, [u32(edits.length), ...entries])])
}

const signed32 = (value: number): Uint8Array => u32(value < 0 ? value + 0x1_00_00_00_00 : value)

const signed64 = (value: number): Uint8Array => {
  const out = new Uint8Array(8)
  new DataView(out.buffer).setBigInt64(0, BigInt(value))
  return out
}

const mdhd = (media: MediaHeader, duration: number): Uint8Array => {
  const v1 = needsV1(media.creation, media.modification, duration)
  const time = v1 ? u64 : u32
  return writeFullBox('mdhd', v1 ? 1 : 0, 0, [
    time(media.creation),
    time(media.modification),
    u32(media.timescale),
    time(duration),
    u16(media.language),
    u16(0),
  ])
}

const hdlr = (): Uint8Array =>
  writeFullBox('hdlr', 0, 0, [
    u32(0),
    latin1Bytes('soun'),
    zeros(12),
    latin1Bytes('SoundHandler\0'),
  ])

const dinf = (): Uint8Array =>
  writeBox('dinf', [writeFullBox('dref', 0, 0, [u32(1), writeFullBox('url ', 0, 1, [])])])

/** `stts`: the durations, run-length encoded into one table. */
const stts = (durations: Float64Array): Uint8Array => {
  const table = new Uint8Array(durations.length * 8)
  const view = new DataView(table.buffer)
  let runs = 0
  for (let i = 0; i < durations.length; i++) {
    if (i > 0 && durations[i] === durations[i - 1]) {
      view.setUint32((runs - 1) * 8, view.getUint32((runs - 1) * 8) + 1)
      continue
    }
    view.setUint32(runs * 8, 1)
    view.setUint32(runs * 8 + 4, durations[i]!)
    runs++
  }
  return writeFullBox('stts', 0, 0, [u32(runs), table.subarray(0, runs * 8)])
}

/** `stsz`: one size when every sample shares it, else the table. */
const stsz = (sizes: Float64Array): Uint8Array => {
  const first = sizes[0] ?? 0
  if (sizes.every((size) => size === first)) {
    return writeFullBox('stsz', 0, 0, [u32(first), u32(sizes.length)])
  }
  const table = new Uint8Array(sizes.length * 4)
  const view = new DataView(table.buffer)
  sizes.forEach((size, i) => view.setUint32(i * 4, size))
  return writeFullBox('stsz', 0, 0, [u32(0), u32(sizes.length), table])
}

/** The one chunk's offset: `stco`, or `co64` past 4 GiB. */
const chunkOffset = (offset: number): Uint8Array =>
  offset > U32_MAX
    ? writeFullBox('co64', 0, 0, [u32(1), u64(offset)])
    : writeFullBox('stco', 0, 0, [u32(1), u32(offset)])

const moov = (track: IsoAudioTrack, dataOffset: number): Uint8Array => {
  const { media } = track
  const durations = track.samples.durations.subarray(0, track.samples.length)
  const sizes = track.samples.sizes.subarray(0, track.samples.length)
  const summed = durations.reduce((total, duration) => total + duration, 0)
  const mediaDuration = summed > 0 ? summed : media.duration
  const scale = (value: number): number =>
    track.movieTimescale > 0 ? Math.round((value * media.timescale) / track.movieTimescale) : value
  const edits = track.edits?.map((edit) => ({
    ...edit,
    segmentDuration: scale(edit.segmentDuration),
  }))
  const edited = edits?.reduce((total, edit) => total + edit.segmentDuration, 0) ?? 0
  const movieDuration = edited > 0 ? edited : mediaDuration
  const stbl = writeBox('stbl', [
    track.stsd,
    stts(durations),
    writeFullBox('stsc', 0, 0, [u32(1), u32(1), u32(sizes.length), u32(1)]),
    stsz(sizes),
    chunkOffset(dataOffset),
  ])
  const minf = writeBox('minf', [writeFullBox('smhd', 0, 0, [u16(0), u16(0)]), dinf(), stbl])
  const mdia = writeBox('mdia', [mdhd(media, mediaDuration), hdlr(), minf])
  const trak = writeBox('trak', [
    tkhd(movieDuration),
    ...(edits !== undefined && edits.length > 0 ? [elst(edits)] : []),
    mdia,
  ])
  return writeBox('moov', [mvhd(media.timescale, movieDuration), trak])
}

/** Copy every sample of `samples` out of `source`, end to end, into `out` from `at`. */
const copySamples = (
  source: Uint8Array,
  samples: IsoAudioTrack['samples'],
  out: Uint8Array,
  at: number
): void => {
  let cursor = at
  for (let i = 0; i < samples.length; i++) {
    const offset = samples.offsets[i]!
    const size = samples.sizes[i]!
    if (offset < 0 || offset + size > source.length) {
      malformed(`audio sample ${String(i)} lies outside the file`)
    }
    out.set(source.subarray(offset, offset + size), cursor)
    cursor += size
  }
}

const mdatHeader = (payload: number): Uint8Array =>
  payload + 8 > U32_MAX
    ? concatBytes([u32(1), latin1Bytes('mdat'), u64(payload + 16)])
    : concatBytes([u32(payload + 8), latin1Bytes('mdat')])

/** The M4A file holding `track`'s samples, read out of `source`, in one buffer. */
export const writeM4a = (source: Uint8Array, track: IsoAudioTrack): Uint8Array => {
  const payload = track.samples.sizes
    .subarray(0, track.samples.length)
    .reduce((total, size) => total + size, 0)
  const head = ftyp()
  const mdat = mdatHeader(payload)
  // The moov's size does not depend on the offset it records below 4 GiB, so measure it once.
  const provisional = moov(track, 0)
  const dataOffset = head.length + provisional.length + mdat.length
  const index = moov(track, dataOffset)
  if (index.length !== provisional.length) malformed('the sample index changed size')
  const out = new Uint8Array(dataOffset + payload)
  out.set(head, 0)
  out.set(index, head.length)
  out.set(mdat, head.length + index.length)
  copySamples(source, track.samples, out, dataOffset)
  return out
}
