/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a file's first bytes say it is, for the few formats where that answer is
 * cheap and decisive.
 *
 * Two families are recognised, and nothing else:
 *
 *  - **Markup.** Bytes that open with `<` (after an optional UTF-8 BOM and
 *    whitespace) are a document a browser would parse as markup. They are SVG
 *    when an `<svg` element appears in the sniffed window, and HTML otherwise —
 *    whatever the file is called and whatever type the uploader declared. Both
 *    can carry a script, which is why they are named rather than left as text.
 *  - **Raster images**, by their magic number: PNG, JPEG, GIF and WebP.
 *
 * Anything else answers `undefined`: the sniff has no opinion, and the caller
 * keeps the declared type. The sniff is deliberately shallow — a polyglot that
 * opens with a valid image header is judged by that header.
 */

/** How many leading bytes the markup check reads to tell SVG from HTML. */
const MARKUP_WINDOW = 1024

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0): boolean =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, index) => bytes[offset + index] === byte)

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38] as const // "GIF8"
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const // "WEBP", at offset 8

/** The raster image type the magic number names, or `undefined`. */
const sniffImage = (bytes: Uint8Array): string | undefined => {
  if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg'
  if (startsWith(bytes, GIF_SIGNATURE)) return 'image/gif'
  if (startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, 8)) {
    return 'image/webp'
  }
  return undefined
}

/** True for the ASCII whitespace an HTML parser skips before the first tag. */
const isLeadingWhitespace = (byte: number | undefined): boolean =>
  byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c

/** Index of the first byte after an optional UTF-8 BOM and leading whitespace. */
const firstSignificantByte = (bytes: Uint8Array): number => {
  const afterBom = startsWith(bytes, [0xef, 0xbb, 0xbf]) ? 3 : 0
  const rest = Array.from(bytes.subarray(afterBom, afterBom + MARKUP_WINDOW))
  const offset = rest.findIndex((byte) => !isLeadingWhitespace(byte))
  return offset === -1 ? bytes.length : afterBom + offset
}

/** `text/html` or `image/svg+xml` when the bytes open as markup, else `undefined`. */
const sniffMarkup = (bytes: Uint8Array): string | undefined => {
  const start = firstSignificantByte(bytes)
  if (bytes[start] !== 0x3c) return undefined // "<"
  const head = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(start, start + MARKUP_WINDOW))
    .toLowerCase()
  return /<svg[\s>/]/.test(head) ? 'image/svg+xml' : 'text/html'
}

/**
 * The type the content itself announces — markup first, then a raster image
 * magic number — or `undefined` when it announces none of them.
 */
export const sniffContentType = (bytes: Uint8Array): string | undefined =>
  sniffMarkup(bytes) ?? sniffImage(bytes)

/** True for the two sniffed types that can carry a script. */
export const isScriptableMarkupType = (mimeType: string): boolean =>
  mimeType === 'text/html' || mimeType === 'image/svg+xml'
