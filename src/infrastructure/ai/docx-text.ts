/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { inflateRawSync } from 'node:zlib'

/**
 * The text of a Word document (`.docx`), for a model to read.
 *
 * A docx is a ZIP archive whose `word/document.xml` holds the body. Reading it
 * takes two small steps and no dependency: find that one entry through the
 * archive's central directory and inflate it with the runtime's own zlib, then
 * keep the text runs (`<w:t>`) with a tab for `<w:tab/>`, a line break for
 * `<w:br/>` and a new line at the end of each paragraph. Headers, footers,
 * comments and formatting are not read.
 *
 * Inflation is bounded: an entry that would unpack past
 * {@link DOCX_MAX_UNPACKED_BYTES} is refused rather than allocated, so a small
 * crafted archive cannot exhaust memory. Anything that is not a readable docx —
 * no central directory, no body entry, an unknown compression method, ZIP64 —
 * answers `undefined`.
 */

/** The most the document body may unpack to: 64 MiB. */
export const DOCX_MAX_UNPACKED_BYTES = 64 * 1024 * 1024

const EOCD_SIGNATURE = 0x06_05_4b_50
const CENTRAL_SIGNATURE = 0x02_01_4b_50
const LOCAL_SIGNATURE = 0x04_03_4b_50
/** The End Of Central Directory record is 22 bytes plus a comment of at most 65535. */
const EOCD_MAX_DISTANCE = 22 + 0xff_ff
const BODY_ENTRY = 'word/document.xml'
const STORED = 0
const DEFLATED = 8

interface ZipEntry {
  readonly method: number
  readonly compressedSize: number
  readonly localOffset: number
}

/** The offset of the End Of Central Directory record, searched backwards. */
const findEndOfCentralDirectory = (view: DataView): number | undefined => {
  const last = view.byteLength - 22
  const first = Math.max(0, view.byteLength - EOCD_MAX_DISTANCE)
  const offsets = Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => last - i)
  return offsets.find((offset) => view.getUint32(offset, true) === EOCD_SIGNATURE)
}

/** The central-directory entry named `wanted`, walking `count` headers from `start`. */
const findEntry = (
  archive: { readonly bytes: Uint8Array; readonly view: DataView },
  start: number,
  count: number,
  wanted: string
): ZipEntry | undefined => {
  const { bytes, view } = archive
  const decoder = new TextDecoder('utf-8')
  let offset = start
  for (let remaining = count; remaining > 0; remaining -= 1) {
    if (offset + 46 > view.byteLength) return undefined
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) return undefined
    const nameLength = view.getUint16(offset + 28, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (name === wanted) {
      return {
        method: view.getUint16(offset + 10, true),
        compressedSize: view.getUint32(offset + 20, true),
        localOffset: view.getUint32(offset + 42, true),
      }
    }
    offset +=
      46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  return undefined
}

/** The bytes of `entry`, inflated when deflated; `undefined` when unreadable or too large. */
const readEntry = (bytes: Uint8Array, view: DataView, entry: ZipEntry): Uint8Array | undefined => {
  const at = entry.localOffset
  if (at + 30 > view.byteLength || view.getUint32(at, true) !== LOCAL_SIGNATURE) return undefined
  const dataStart = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  const data = bytes.subarray(dataStart, dataStart + entry.compressedSize)
  if (entry.method === STORED) return data
  if (entry.method !== DEFLATED) return undefined
  try {
    return new Uint8Array(inflateRawSync(data, { maxOutputLength: DOCX_MAX_UNPACKED_BYTES }))
  } catch {
    return undefined
  }
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/** Decode the five named XML entities and numeric character references. */
const decodeXmlText = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, ref: string) => {
    if (ref.startsWith('#x') || ref.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(ref.slice(2), 16))
    }
    if (ref.startsWith('#')) return String.fromCodePoint(Number.parseInt(ref.slice(1), 10))
    return XML_ENTITIES[ref] ?? whole
  })

/** The text a WordprocessingML body reads as: runs, tabs, breaks, one line per paragraph. */
export const wordXmlToText = (xml: string): string =>
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:t\s*\/>|<w:tab\/>|<w:br[^>]*\/>|<\/w:p>/gu)]
    .map(([token, text]) => {
      if (text !== undefined) return decodeXmlText(text)
      if (token === '<w:tab/>') return '\t'
      if (token.startsWith('<w:t')) return ''
      return '\n'
    })
    .join('')
    .trim()

/** The text of the docx in `bytes`, or `undefined` when it is not a readable Word document. */
export const docxToText = (bytes: Uint8Array): string | undefined => {
  if (bytes.byteLength < 22) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const eocd = findEndOfCentralDirectory(view)
  if (eocd === undefined) return undefined
  const count = view.getUint16(eocd + 10, true)
  const start = view.getUint32(eocd + 16, true)
  const entry = findEntry({ bytes, view }, start, count, BODY_ENTRY)
  if (entry === undefined) return undefined
  const body = readEntry(bytes, view, entry)
  return body === undefined ? undefined : wordXmlToText(new TextDecoder('utf-8').decode(body))
}
