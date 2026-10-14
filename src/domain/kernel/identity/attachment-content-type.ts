/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sniffContentType } from './content-sniff'
import { canonicalMimeType, inferMimeFromKey } from './mime-types'

/**
 * What an uploaded file IS, read from its bytes — never from its name or the
 * type the uploader declared, both of which the uploader controls.
 *
 * The content decides the family:
 *
 *  - markup (HTML, SVG) and raster images, by {@link sniffContentType};
 *  - PDF, by its `%PDF-` header;
 *  - a Word document (`.docx`), by the ZIP local-file signature AND the
 *    `word/document.xml` entry name every docx carries (entry names are stored
 *    uncompressed); any other ZIP is `application/zip`;
 *  - text, when the bytes are valid UTF-8 holding no NUL and no control
 *    character other than tab, line feed, form feed and carriage return.
 *
 * Only for TEXT does the declared type (or the extension) get a say, and only
 * to pick among the text types — `text/csv`, `text/markdown`, `text/plain` —
 * because the bytes of a CSV and of a plain note are indistinguishable. A
 * declared text type can never turn binary content into text.
 *
 * Anything else answers `undefined`: the content is not a type this judge
 * recognises, and the caller refuses it.
 */

/** The media type of a Word document (Office Open XML). */
export const DOCX_MEDIA_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** The text types a declared type or an extension may pick among. */
const TEXT_MEDIA_TYPES: ReadonlySet<string> = new Set(['text/plain', 'text/csv', 'text/markdown'])

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const // "%PDF-"
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const // "PK\x03\x04"
const DOCX_MAIN_PART = 'word/document.xml'

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)

/** True for a byte no text file carries: NUL and the C0 controls bar \t \n \f \r, and DEL. */
const isBinaryByte = (byte: number): boolean =>
  (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d) || byte === 0x7f

/** Whether the bytes are UTF-8 text: they decode strictly and carry no control byte. */
const isUtf8Text = (bytes: Uint8Array): boolean => {
  if (bytes.some(isBinaryByte)) return false
  try {
    return typeof new TextDecoder('utf-8', { fatal: true }).decode(bytes) === 'string'
  } catch {
    return false
  }
}

/** Whether a ZIP archive names the main part of a Word document. */
const namesDocxMainPart = (bytes: Uint8Array): boolean =>
  new TextDecoder('latin1').decode(bytes).includes(DOCX_MAIN_PART)

/** The text type the declaration or, failing it, the file name points to; plain text otherwise. */
const declaredTextType = (declared: DeclaredFile): string => {
  const reported = canonicalMimeType(declared.mimeType)
  if (TEXT_MEDIA_TYPES.has(reported)) return reported
  const byName = inferMimeFromKey(declared.name)
  return TEXT_MEDIA_TYPES.has(byName) ? byName : 'text/plain'
}

/** What the uploader said about the file: never trusted for the family, only to name a text type. */
export interface DeclaredFile {
  readonly name: string
  readonly mimeType: string
}

/**
 * The media type the content of `bytes` announces, or `undefined` when it is
 * not one this judge recognises (including an empty file).
 */
export const detectAttachmentType = (
  bytes: Uint8Array,
  declared: DeclaredFile
): string | undefined => {
  if (bytes.length === 0) return undefined
  if (startsWith(bytes, PDF_SIGNATURE)) return 'application/pdf'
  if (startsWith(bytes, ZIP_SIGNATURE)) {
    return namesDocxMainPart(bytes) ? DOCX_MEDIA_TYPE : 'application/zip'
  }
  const sniffed = sniffContentType(bytes)
  if (sniffed !== undefined) return sniffed
  return isUtf8Text(bytes) ? declaredTextType(declared) : undefined
}

/**
 * Whether `mediaType` is in an `accept` list. An entry is a full media type
 * (`text/csv`) or a family wildcard (`image/*`); comparison ignores case and
 * parameters.
 */
export const isAcceptedMediaType = (mediaType: string, accept: readonly string[]): boolean => {
  const type = canonicalMimeType(mediaType)
  return accept.some((entry) => {
    const wanted = canonicalMimeType(entry)
    if (wanted.endsWith('/*')) return type.startsWith(wanted.slice(0, -1))
    return wanted === type
  })
}

/** The picture types a model reads as an image: the raster formats every vision API takes. */
const MODEL_IMAGE_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

/**
 * Whether an upload of `mediaType` goes to a model as a PICTURE. Only the
 * raster formats do: an SVG is markup, so it is read as text like any other
 * document, never sent as an image a provider would refuse on every later turn
 * of its conversation.
 */
export const isModelImageType = (mediaType: string): boolean =>
  MODEL_IMAGE_TYPES.has(canonicalMimeType(mediaType))
