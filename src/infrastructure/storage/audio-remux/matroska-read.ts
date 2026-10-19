/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  childElement,
  EBML_ID,
  elementBytes,
  elementsIn,
  floatValue,
  readVint,
  stringValue,
  uintValue,
  type Element,
} from './ebml'
import { ensureCount, malformed, MAX_AUDIO_FRAMES, RemuxRefusal } from './media-bytes'

/**
 * Reading the audio track out of a Matroska or WebM file: its TrackEntry as
 * stored, and every block of it, cluster by cluster, as stored. Void and
 * CRC-32 elements are skipped wherever they sit; an unknown-size Segment or
 * Cluster is read to where the next top-level element starts.
 */

/** The audio codecs a WebM carries, and so the only ones this remux copies. */
const WEBM_AUDIO_CODECS: ReadonlySet<string> = new Set(['A_OPUS', 'A_VORBIS'])

const TRACK_TYPE_VIDEO = 1
const TRACK_TYPE_AUDIO = 2

/** One cluster's audio: its timecode, and its blocks of the audio track, as stored. */
export interface AudioCluster {
  readonly timecode: number
  readonly blocks: readonly Uint8Array[]
}

export interface MatroskaAudioTrack {
  readonly timecodeScale: number
  /** The segment's duration in timecode ticks: the source's own, else computed from the blocks. */
  readonly durationTicks: number
  /** The audio TrackEntry, header included, copied verbatim. */
  readonly trackEntry: Uint8Array
  /** The track number its blocks carry. */
  readonly trackNumber: number
  readonly clusters: readonly AudioCluster[]
  readonly hadVideo: boolean
}

interface TrackInfo {
  readonly entry: Element
  readonly number: number
  readonly type: number
  readonly codec: string
  readonly defaultDuration: number
}

const readTrack = (bytes: Uint8Array, entry: Element): TrackInfo => {
  const field = (id: number) => childElement(bytes, entry, id)
  const number = field(EBML_ID.trackNumber)
  const type = field(EBML_ID.trackType)
  const codec = field(EBML_ID.codecId)
  const defaultDuration = field(EBML_ID.defaultDuration)
  return {
    entry,
    number: number === undefined ? 0 : uintValue(bytes, number),
    type: type === undefined ? 0 : uintValue(bytes, type),
    codec: codec === undefined ? '' : stringValue(bytes, codec),
    defaultDuration: defaultDuration === undefined ? 0 : uintValue(bytes, defaultDuration),
  }
}

/** The track a block belongs to, and the timecode it carries relative to its cluster. */
const blockHeader = (
  bytes: Uint8Array,
  block: Element
): { readonly track: number; readonly relative: number } => {
  const track = readVint(bytes, block.payload, false)
  const at = block.payload + track.length
  if (at + 2 > block.end) malformed('a block shorter than its header')
  const raw = (bytes[at]! << 8) | bytes[at + 1]!
  return { track: track.value, relative: raw >= 0x80_00 ? raw - 0x1_00_00 : raw }
}

interface ClusterRead {
  readonly cluster: AudioCluster
  /** Where the cluster's last audio block ends, in ticks; 0 when it holds none. */
  readonly lastTick: number
}

const readCluster = (
  bytes: Uint8Array,
  cluster: Element,
  track: TrackInfo,
  defaultTicks: number
): ClusterRead => {
  const children = elementsIn(bytes, cluster.payload, cluster.end)
  const timecodeElement = children.find((child) => child.id === EBML_ID.timecode)
  const timecode = timecodeElement === undefined ? 0 : uintValue(bytes, timecodeElement)
  const blocks: Uint8Array[] = []
  let lastTick = 0
  children.forEach((child) => {
    const block =
      child.id === EBML_ID.simpleBlock
        ? child
        : child.id === EBML_ID.blockGroup
          ? childElement(bytes, child, EBML_ID.block)
          : undefined
    if (block === undefined) return
    const header = blockHeader(bytes, block)
    if (header.track !== track.number) return
    // eslint-disable-next-line no-restricted-syntax -- sanctioned mutation: appending each block to one array keeps a cluster read linear
    blocks.push(elementBytes(bytes, child))
    const durationElement =
      child.id === EBML_ID.blockGroup
        ? childElement(bytes, child, EBML_ID.blockDuration)
        : undefined
    const duration =
      durationElement === undefined ? defaultTicks : uintValue(bytes, durationElement)
    lastTick = Math.max(lastTick, timecode + header.relative + duration)
  })
  return { cluster: { timecode, blocks }, lastTick }
}

/** The audio track to copy: the first WebM carries, refusing a file with none, or whose audio is another codec. */
const chooseAudioTrack = (tracks: readonly TrackInfo[], hadVideo: boolean): TrackInfo => {
  const audio = tracks.filter((track) => track.type === TRACK_TYPE_AUDIO)
  if (audio.length === 0) {
    throw new RemuxRefusal('no-audio-track', 'holds no audio track', { hadVideo })
  }
  const chosen = audio.find((track) => WEBM_AUDIO_CODECS.has(track.codec))
  if (chosen === undefined) {
    const codec = audio[0]!.codec || 'an unnamed codec'
    throw new RemuxRefusal('unsupported-codec', `carries ${codec} audio`, { codec, hadVideo })
  }
  return chosen
}

/** The segment's TimecodeScale (1 ms by default) and its stated Duration in ticks (0: none). */
const readInfo = (
  bytes: Uint8Array,
  info: Element | undefined
): { readonly scale: number; readonly duration: number } => {
  const scaleElement = childElement(bytes, info, EBML_ID.timecodeScale)
  const scale = scaleElement === undefined ? 1_000_000 : uintValue(bytes, scaleElement)
  if (scale === 0) return malformed('a TimecodeScale of zero')
  const durationElement = childElement(bytes, info, EBML_ID.duration)
  return { scale, duration: durationElement === undefined ? 0 : floatValue(bytes, durationElement) }
}

/** The audio track of a Matroska or WebM file, every one of its blocks found. */
export const readMatroskaAudioTrack = (bytes: Uint8Array): MatroskaAudioTrack => {
  const segment = elementsIn(bytes, 0, bytes.length).find(
    (element) => element.id === EBML_ID.segment
  )
  if (segment === undefined) return malformed('the file has no Segment')
  const level1 = elementsIn(bytes, segment.payload, segment.end)
  const tracksElement = level1.find((element) => element.id === EBML_ID.tracks)
  if (tracksElement === undefined) return malformed('the file has no Tracks')
  const tracks = elementsIn(bytes, tracksElement.payload, tracksElement.end)
    .filter((element) => element.id === EBML_ID.trackEntry)
    .map((entry) => readTrack(bytes, entry))
  const hadVideo = tracks.some((track) => track.type === TRACK_TYPE_VIDEO)
  const chosen = chooseAudioTrack(tracks, hadVideo)
  const info = readInfo(
    bytes,
    level1.find((element) => element.id === EBML_ID.info)
  )
  const defaultTicks = Math.round(chosen.defaultDuration / info.scale)
  // Counted cluster by cluster, so the blocks kept never pass the frame bound
  // by more than one cluster's list.
  let blockCount = 0
  const reads = level1
    .filter((element) => element.id === EBML_ID.cluster)
    .map((cluster) => {
      const read = readCluster(bytes, cluster, chosen, defaultTicks)
      blockCount += read.cluster.blocks.length
      ensureCount(blockCount, MAX_AUDIO_FRAMES, 'audio blocks')
      return read
    })
  const clusters = reads.map((read) => read.cluster).filter((cluster) => cluster.blocks.length > 0)
  if (clusters.length === 0) {
    throw new RemuxRefusal('no-audio-track', 'holds no audio track', { hadVideo })
  }
  const computed = reads.reduce((last, read) => Math.max(last, read.lastTick), 0)
  return {
    timecodeScale: info.scale,
    durationTicks: info.duration > 0 ? info.duration : computed,
    trackEntry: elementBytes(bytes, chosen.entry),
    trackNumber: chosen.number,
    clusters,
    hadVideo,
  }
}
