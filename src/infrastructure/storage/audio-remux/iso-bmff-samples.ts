/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { childBox, childrenOf, type Box } from './iso-bmff-boxes'
import { ensureCount, i32, malformed, MAX_AUDIO_FRAMES, u32, u64, u8, u16 } from './media-bytes'

/**
 * Where one track's samples are: an offset, a size and a duration per sample,
 * in parallel growable typed arrays (a one-hour recording holds a few hundred
 * thousand samples; appending stays amortised constant, never a copy per
 * sample). Read from a progressive `stbl`, and from the `moof` fragments a
 * fragmented file appends.
 *
 * Every sample is checked as it is added: it lies inside the file, the
 * samples together hold no more bytes than the file does (they are disjoint
 * ranges of it), and there are at most {@link MAX_AUDIO_FRAMES} of them. So
 * whatever a header declares, the list — and the M4A sized from its total —
 * never outgrows the file it was read from.
 */
export class SampleList {
  offsets = new Float64Array(64)
  sizes = new Float64Array(64)
  durations = new Float64Array(64)
  length = 0
  /** The bytes the samples hold together. */
  total = 0
  readonly fileLength: number

  constructor(fileLength: number) {
    this.fileLength = fileLength
  }

  add(offset: number, size: number, duration: number): void {
    ensureCount(this.length + 1, MAX_AUDIO_FRAMES, 'audio samples')
    if (offset < 0 || offset + size > this.fileLength) {
      malformed(`audio sample ${String(this.length)} lies outside the file`)
    }
    this.total += size
    if (this.total > this.fileLength) malformed('the audio samples hold more bytes than the file')
    if (this.length === this.offsets.length) {
      const grow = (from: Float64Array<ArrayBuffer>): Float64Array<ArrayBuffer> => {
        const next = new Float64Array(from.length * 2)
        next.set(from)
        return next
      }
      this.offsets = grow(this.offsets)
      this.sizes = grow(this.sizes)
      this.durations = grow(this.durations)
    }
    this.offsets[this.length] = offset
    this.sizes[this.length] = size
    this.durations[this.length] = duration
    this.length++
  }
}

/** Refuse a table of `count` entries of `entry` bytes that does not fit inside `box`. */
const ensureTable = (box: Box, at: number, count: number, entry: number): void => {
  if (at + count * entry > box.end) malformed(`the ${box.type} table overruns its box`)
}

/** The sizes an `stsz` lists: one uniform size repeated, or a table. */
const stszSizes = (bytes: Uint8Array, stsz: Box): readonly number[] => {
  const uniform = u32(bytes, stsz.payload + 4)
  const count = u32(bytes, stsz.payload + 8)
  ensureCount(count, MAX_AUDIO_FRAMES, 'audio samples')
  if (uniform !== 0) {
    // Every sample lies inside the file, so a uniform size bounds the count.
    if (uniform * count > bytes.length) malformed('the stsz count exceeds the file')
    return new Array<number>(count).fill(uniform)
  }
  ensureTable(stsz, stsz.payload + 12, count, 4)
  return Array.from({ length: count }, (_, i) => u32(bytes, stsz.payload + 12 + i * 4))
}

/** The sizes a compact `stz2` lists, in 16-, 8- or 4-bit fields. */
const stz2Sizes = (bytes: Uint8Array, stz2: Box): readonly number[] => {
  const field = u8(bytes, stz2.payload + 7)
  const count = u32(bytes, stz2.payload + 8)
  const at = stz2.payload + 12
  ensureCount(count, MAX_AUDIO_FRAMES, 'audio samples')
  ensureTable(stz2, at, Math.ceil((count * field) / 8), 1)
  if (field === 16) return Array.from({ length: count }, (_, i) => u16(bytes, at + i * 2))
  if (field === 8) return Array.from({ length: count }, (_, i) => u8(bytes, at + i))
  if (field === 4) {
    return Array.from({ length: count }, (_, i) => {
      const byte = u8(bytes, at + (i >> 1))
      return i % 2 === 0 ? byte >> 4 : byte & 0x0f
    })
  }
  return malformed(`an stz2 table with ${String(field)}-bit sizes`)
}

/** The sizes `stsz` (or the compact `stz2`) lists. */
const sampleSizes = (bytes: Uint8Array, stbl: Box): readonly number[] => {
  const stsz = childBox(bytes, stbl, 'stsz')
  if (stsz !== undefined) return stszSizes(bytes, stsz)
  const stz2 = childBox(bytes, stbl, 'stz2')
  return stz2 === undefined ? [] : stz2Sizes(bytes, stz2)
}

/** The chunk offsets `stco` or `co64` lists. */
const chunkOffsets = (bytes: Uint8Array, stbl: Box): readonly number[] => {
  const stco = childBox(bytes, stbl, 'stco')
  if (stco !== undefined) {
    const count = u32(bytes, stco.payload + 4)
    ensureCount(count, MAX_AUDIO_FRAMES, 'chunks')
    ensureTable(stco, stco.payload + 8, count, 4)
    return Array.from({ length: count }, (_, i) => u32(bytes, stco.payload + 8 + i * 4))
  }
  const co64 = childBox(bytes, stbl, 'co64')
  if (co64 === undefined) return []
  const count = u32(bytes, co64.payload + 4)
  ensureCount(count, MAX_AUDIO_FRAMES, 'chunks')
  ensureTable(co64, co64.payload + 8, count, 8)
  return Array.from({ length: count }, (_, i) => u64(bytes, co64.payload + 8 + i * 8))
}

/** How many samples each chunk holds, from the `stsc` runs over `chunkCount` chunks. */
const samplesPerChunk = (bytes: Uint8Array, stbl: Box, chunkCount: number): readonly number[] => {
  const stsc = childBox(bytes, stbl, 'stsc')
  if (stsc === undefined) return []
  const count = u32(bytes, stsc.payload + 4)
  ensureTable(stsc, stsc.payload + 8, count, 12)
  const runs = Array.from({ length: count }, (_, i) => ({
    firstChunk: u32(bytes, stsc.payload + 8 + i * 12),
    samples: u32(bytes, stsc.payload + 12 + i * 12),
  }))
  const perChunk = new Array<number>(chunkCount).fill(0)
  // Runs are in increasing chunk order; one that starts at or before a chunk
  // an earlier run already filled resumes after it. Each chunk is therefore
  // filled once, however the runs are written: a table of runs that each
  // restart at chunk 1 costs its length, never its length times the chunks.
  let next = 1
  runs.forEach((run, i) => {
    const last = Math.min(
      i + 1 < runs.length ? runs[i + 1]!.firstChunk - 1 : chunkCount,
      chunkCount
    )
    for (let chunk = Math.max(run.firstChunk, next); chunk <= last; chunk++) {
      perChunk[chunk - 1] = run.samples
      next = chunk + 1
    }
  })
  return perChunk
}

/** The duration of each of `count` samples, from the `stts` runs. */
const sampleDurations = (bytes: Uint8Array, stbl: Box, count: number): readonly number[] => {
  const stts = childBox(bytes, stbl, 'stts')
  const durations = new Array<number>(count).fill(0)
  if (stts === undefined) return durations
  const entries = u32(bytes, stts.payload + 4)
  ensureTable(stts, stts.payload + 8, entries, 8)
  let sample = 0
  for (let i = 0; i < entries && sample < count; i++) {
    const run = u32(bytes, stts.payload + 8 + i * 8)
    const delta = u32(bytes, stts.payload + 12 + i * 8)
    for (let j = 0; j < run && sample < count; j++) durations[sample++] = delta
  }
  return durations
}

/** Append the samples a progressive `stbl` indexes to `into`. */
export const readTableSamples = (bytes: Uint8Array, stbl: Box, into: SampleList): void => {
  const sizes = sampleSizes(bytes, stbl)
  if (sizes.length === 0) return
  const offsets = chunkOffsets(bytes, stbl)
  const perChunk = samplesPerChunk(bytes, stbl, offsets.length)
  const durations = sampleDurations(bytes, stbl, sizes.length)
  let sample = 0
  offsets.forEach((chunkOffset, chunk) => {
    let at = chunkOffset
    for (let i = 0; i < perChunk[chunk]! && sample < sizes.length; i++) {
      into.add(at, sizes[sample]!, durations[sample]!)
      at += sizes[sample]!
      sample++
    }
  })
  if (sample !== sizes.length) malformed('the sample table places fewer samples than it sizes')
}

/** A track's fragment defaults from its `trex`, in `moov/mvex`. */
export interface TrackDefaults {
  readonly duration: number
  readonly size: number
}

/** The `trex` defaults of `trackId`, or zeros when the file declares none. */
export const trackDefaults = (bytes: Uint8Array, moov: Box, trackId: number): TrackDefaults => {
  const mvex = childBox(bytes, moov, 'mvex')
  const trex =
    mvex === undefined
      ? undefined
      : childrenOf(bytes, mvex).find(
          (box) => box.type === 'trex' && u32(bytes, box.payload + 4) === trackId
        )
  return trex === undefined
    ? { duration: 0, size: 0 }
    : { duration: u32(bytes, trex.payload + 12), size: u32(bytes, trex.payload + 16) }
}

/** What a `tfhd` declares for its fragment. */
interface FragmentHeader {
  readonly trackId: number
  readonly baseOffset: number
  readonly duration: number
  readonly size: number
}

const TFHD_BASE_DATA_OFFSET = 0x01
const TFHD_SAMPLE_DESCRIPTION = 0x02
const TFHD_DEFAULT_DURATION = 0x08
const TFHD_DEFAULT_SIZE = 0x10

const readFragmentHeader = (
  bytes: Uint8Array,
  tfhd: Box,
  moof: Box,
  defaults: TrackDefaults
): FragmentHeader => {
  const flags = u32(bytes, tfhd.payload) & 0xff_ff_ff
  let at = tfhd.payload + 8
  const take = (flag: number, length: 4 | 8): number | undefined => {
    if ((flags & flag) === 0) return undefined
    const value = length === 8 ? u64(bytes, at) : u32(bytes, at)
    at += length
    return value
  }
  const base = take(TFHD_BASE_DATA_OFFSET, 8)
  take(TFHD_SAMPLE_DESCRIPTION, 4)
  const duration = take(TFHD_DEFAULT_DURATION, 4)
  const size = take(TFHD_DEFAULT_SIZE, 4)
  // `default-base-is-moof` makes the moof the base. Without it and without an
  // explicit base, the base is the moof too for a moof's first track fragment,
  // the layout every recorder this remux meets writes.
  const baseOffset = base ?? moof.start
  return {
    trackId: u32(bytes, tfhd.payload + 4),
    baseOffset,
    duration: duration ?? defaults.duration,
    size: size ?? defaults.size,
  }
}

const TRUN_DATA_OFFSET = 0x01
const TRUN_FIRST_SAMPLE_FLAGS = 0x04
const TRUN_DURATION = 0x1_00
const TRUN_SIZE = 0x2_00
const TRUN_FLAGS = 0x4_00
const TRUN_COMPOSITION = 0x8_00

/** One track fragment being read: the file, its header, and the list its samples join. */
interface FragmentRead {
  readonly bytes: Uint8Array
  readonly header: FragmentHeader
  readonly into: SampleList
}

/** Append one `trun`'s samples; returns where the next run's data starts. */
const readRun = ({ bytes, header, into }: FragmentRead, trun: Box, cursor: number): number => {
  const flags = u32(bytes, trun.payload) & 0xff_ff_ff
  const count = u32(bytes, trun.payload + 4)
  let at = trun.payload + 8
  let data = cursor
  if (flags & TRUN_DATA_OFFSET) {
    data = header.baseOffset + i32(bytes, at)
    at += 4
  }
  if (flags & TRUN_FIRST_SAMPLE_FLAGS) at += 4
  const perSample = [TRUN_DURATION, TRUN_SIZE, TRUN_FLAGS, TRUN_COMPOSITION].filter(
    (flag) => flags & flag
  ).length
  if (at + count * perSample * 4 > trun.end) malformed('a trun table overruns its box')
  ensureCount(into.length + count, MAX_AUDIO_FRAMES, 'audio samples')
  for (let i = 0; i < count; i++) {
    const duration = flags & TRUN_DURATION ? u32(bytes, (at += 4) - 4) : header.duration
    const size = flags & TRUN_SIZE ? u32(bytes, (at += 4) - 4) : header.size
    if (flags & TRUN_FLAGS) at += 4
    if (flags & TRUN_COMPOSITION) at += 4
    into.add(data, size, duration)
    data += size
  }
  return data
}

/** Append the samples of `track` that the top-level `moof` fragments carry. */
export const readFragmentSamples = (
  bytes: Uint8Array,
  top: readonly Box[],
  track: { readonly id: number; readonly defaults: TrackDefaults },
  into: SampleList
): void => {
  top
    .filter((box) => box.type === 'moof')
    .forEach((moof) => {
      childrenOf(bytes, moof)
        .filter((box) => box.type === 'traf')
        .forEach((traf) => {
          const tfhd = childBox(bytes, traf, 'tfhd')
          if (tfhd === undefined) malformed('a track fragment without a tfhd')
          const header = readFragmentHeader(bytes, tfhd!, moof, track.defaults)
          if (header.trackId !== track.id) return
          const read = { bytes, header, into }
          childrenOf(bytes, traf)
            .filter((box) => box.type === 'trun')
            .reduce((cursor, trun) => readRun(read, trun, cursor), header.baseOffset)
        })
    })
}
