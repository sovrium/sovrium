/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  boxBytes,
  boxesIn,
  childBox,
  childrenOf,
  descend,
  versionOf,
  type Box,
} from './iso-bmff-boxes'
import {
  readFragmentSamples,
  readTableSamples,
  SampleList,
  trackDefaults,
} from './iso-bmff-samples'
import { i32, i64, latin1, malformed, RemuxRefusal, u16, u32, u64, u8 } from './media-bytes'

/**
 * Reading the AAC track out of an ISO-BMFF file: which `trak` it is, what its
 * header boxes say, and where every sample lies — in its progressive sample
 * table, in the `moof` fragments, or both. `moov` may follow `mdat`.
 */

/** The `mdhd` fields the output keeps. */
export interface MediaHeader {
  readonly creation: number
  readonly modification: number
  readonly timescale: number
  readonly duration: number
  readonly language: number
}

/** One `elst` entry: a span of the movie timeline, in the movie timescale. */
export interface EditEntry {
  readonly segmentDuration: number
  readonly mediaTime: number
  readonly rate: number
}

/** The AAC track of a source, as the M4A writer needs it. */
export interface IsoAudioTrack {
  /** The `stsd` box, header included, copied verbatim. */
  readonly stsd: Uint8Array
  readonly media: MediaHeader
  readonly movieTimescale: number
  readonly edits: readonly EditEntry[] | undefined
  readonly samples: SampleList
  readonly hadVideo: boolean
}

/** A descriptor's tag and payload range inside an `esds`. */
const readDescriptor = (
  bytes: Uint8Array,
  at: number
): { tag: number; start: number; end: number } => {
  const tag = u8(bytes, at)
  let length = 0
  let cursor = at + 1
  for (let i = 0; i < 4; i++) {
    const byte = u8(bytes, cursor++)
    length = length * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) break
  }
  return { tag, start: cursor, end: cursor + length }
}

/** The MPEG-4 object type an `esds` announces (0x40 is AAC), or `undefined` when it names none. */
export const esdsObjectType = (bytes: Uint8Array, esds: Box): number | undefined => {
  const es = readDescriptor(bytes, esds.payload + 4)
  if (es.tag !== 0x03) return undefined
  const flags = u8(bytes, es.start + 2)
  let at = es.start + 3
  if (flags & 0x80) at += 2
  if (flags & 0x40) at += 1 + u8(bytes, at)
  if (flags & 0x20) at += 2
  const config = readDescriptor(bytes, at)
  return config.tag === 0x04 ? u8(bytes, config.start) : undefined
}

/** The `esds` of an `mp4a` sample entry: a direct child, or inside a QuickTime `wave`. */
const findEsds = (bytes: Uint8Array, entry: Box): Box | undefined => {
  // The sound sample entry's fixed fields: 28 bytes, plus 16 (QuickTime v1) or 36 (v2).
  const version = u16(bytes, entry.payload + 8)
  const skip = 28 + (version === 1 ? 16 : version === 2 ? 36 : 0)
  const children = childrenOf(bytes, entry, skip)
  return (
    children.find((box) => box.type === 'esds') ??
    childBox(
      bytes,
      children.find((box) => box.type === 'wave'),
      'esds'
    )
  )
}

/** A sound track's codec, as its first sample entry names it, and whether a remux can carry it. */
const soundCodec = (
  bytes: Uint8Array,
  stsd: Box
): { readonly name: string; readonly aac: boolean } => {
  const entry = boxesIn(bytes, stsd.payload + 8, stsd.end)[0]
  if (entry === undefined) return { name: 'an empty sample description', aac: false }
  const type = entry.type.trim()
  if (entry.type !== 'mp4a') return { name: type, aac: false }
  const esds = findEsds(bytes, entry)
  const objectType = esds === undefined ? undefined : esdsObjectType(bytes, esds)
  if (objectType === 0x40) return { name: 'mp4a', aac: true }
  const hex = objectType === undefined ? 'none' : `0x${objectType.toString(16)}`
  return { name: `mp4a (object type ${hex})`, aac: false }
}

const handlerOf = (bytes: Uint8Array, trak: Box): string => {
  const hdlr = descend(bytes, trak, ['mdia', 'hdlr'])
  return hdlr === undefined ? '' : latin1(bytes, hdlr.payload + 8, 4)
}

const trackIdOf = (bytes: Uint8Array, trak: Box): number => {
  const tkhd = childBox(bytes, trak, 'tkhd')
  if (tkhd === undefined) return malformed('a track without a tkhd')
  return u32(bytes, tkhd.payload + (versionOf(bytes, tkhd) === 1 ? 20 : 12))
}

const readMediaHeader = (bytes: Uint8Array, mdhd: Box): MediaHeader => {
  const v1 = versionOf(bytes, mdhd) === 1
  const read = v1 ? u64 : u32
  const field = v1 ? 8 : 4
  const at = mdhd.payload + 4
  return {
    creation: read(bytes, at),
    modification: read(bytes, at + field),
    timescale: u32(bytes, at + field * 2),
    duration: read(bytes, at + field * 2 + 4),
    language: u16(bytes, at + field * 3 + 4),
  }
}

const readEdits = (bytes: Uint8Array, trak: Box): readonly EditEntry[] | undefined => {
  const elst = descend(bytes, trak, ['edts', 'elst'])
  if (elst === undefined) return undefined
  const v1 = versionOf(bytes, elst) === 1
  const count = u32(bytes, elst.payload + 4)
  const entry = v1 ? 20 : 12
  if (elst.payload + 8 + count * entry > elst.end) malformed('the elst table overruns its box')
  return Array.from({ length: count }, (_, i) => {
    const at = elst.payload + 8 + i * entry
    return v1
      ? {
          segmentDuration: u64(bytes, at),
          mediaTime: i64(bytes, at + 8),
          rate: u32(bytes, at + 16),
        }
      : { segmentDuration: u32(bytes, at), mediaTime: i32(bytes, at + 4), rate: u32(bytes, at + 8) }
  })
}

/** The sound track to copy: the first carrying AAC, refusing a file with none, or whose sound is another codec. */
const chooseSoundTrack = (
  bytes: Uint8Array,
  traks: readonly Box[],
  hadVideo: boolean
): { readonly trak: Box; readonly stsd: Box } => {
  const sound = traks
    .filter((trak) => handlerOf(bytes, trak) === 'soun')
    .map((trak) => {
      const stsd = descend(bytes, trak, ['mdia', 'minf', 'stbl', 'stsd'])
      if (stsd === undefined) return malformed('a sound track without a sample description')
      return { trak, stsd, codec: soundCodec(bytes, stsd) }
    })
  if (sound.length === 0) {
    throw new RemuxRefusal('no-audio-track', 'holds no audio track', { hadVideo })
  }
  const chosen = sound.find((track) => track.codec.aac)
  if (chosen === undefined) {
    const codec = sound[0]!.codec.name
    throw new RemuxRefusal('unsupported-codec', `carries ${codec} audio`, { codec, hadVideo })
  }
  return chosen
}

/** Every sample of `trak`: its progressive table first, then the fragments that follow. */
const readTrackSamples = (
  bytes: Uint8Array,
  top: readonly Box[],
  moov: Box,
  trak: Box
): SampleList => {
  const samples = new SampleList(bytes.length)
  const stbl = descend(bytes, trak, ['mdia', 'minf', 'stbl'])
  if (stbl !== undefined) readTableSamples(bytes, stbl, samples)
  const id = trackIdOf(bytes, trak)
  readFragmentSamples(bytes, top, { id, defaults: trackDefaults(bytes, moov, id) }, samples)
  return samples
}

/** The AAC track of an ISO-BMFF file, its samples located, `moov` before or after `mdat`. */
export const readIsoAudioTrack = (bytes: Uint8Array): IsoAudioTrack => {
  const top = boxesIn(bytes, 0, bytes.length)
  const moov = top.find((box) => box.type === 'moov')
  if (moov === undefined) return malformed('the file has no moov box')
  const traks = childrenOf(bytes, moov).filter((box) => box.type === 'trak')
  const hadVideo = traks.some((trak) => handlerOf(bytes, trak) === 'vide')
  const { trak, stsd } = chooseSoundTrack(bytes, traks, hadVideo)
  const mdhd = descend(bytes, trak, ['mdia', 'mdhd'])
  const mvhd = childBox(bytes, moov, 'mvhd')
  if (mdhd === undefined || mvhd === undefined) return malformed('a track without an mdhd or mvhd')
  const samples = readTrackSamples(bytes, top, moov, trak)
  if (samples.length === 0) {
    throw new RemuxRefusal('no-audio-track', 'holds no audio track', { hadVideo })
  }
  return {
    stsd: boxBytes(bytes, stsd),
    media: readMediaHeader(bytes, mdhd),
    movieTimescale: u32(bytes, mvhd.payload + (versionOf(bytes, mvhd) === 1 ? 20 : 12)),
    edits: readEdits(bytes, trak),
    samples,
    hadVideo,
  }
}
