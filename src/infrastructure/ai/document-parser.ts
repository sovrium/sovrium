/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Knowledge-document parsers — infrastructure layer.
 *
 * Turns a raw document file into plain text ready for chunking + embedding:
 *  - `.pdf`  → text extraction via `unpdf` (a pure-JS, serverless PDF.js
 *              build — no native addons, Bun-standalone-binary safe).
 *  - `.md`   → Markdown markers stripped (pure domain `markdownToText`).
 *  - `.txt`  → passed through unchanged.
 *
 * {@link extractAttachmentText} reads a file a person attached to a chat, by the
 * media type its CONTENT was judged to be at upload: PDF, Word (`.docx`, via
 * `docx-text.ts`), CSV, Markdown and plain text. An image has no text: it
 * reaches a vision-capable model as an image, never through here.
 *
 * PDF parsing degrades gracefully: when `unpdf` cannot parse the bytes (e.g.
 * a test fixture that writes plain text into a `.pdf` file, or a corrupt
 * file) the raw bytes are decoded as UTF-8 text so a non-PDF `.pdf` still
 * yields embeddable content rather than aborting the sync.
 */

import { extractText, getDocumentProxy } from 'unpdf'
import { DOCX_MEDIA_TYPE } from '@/domain/kernel/identity/attachment-content-type'
import { markdownToText } from '@/domain/kernel/markdown/markdown-to-text'
import { docxToText } from './docx-text'

/** File extensions the document pipeline can ingest. */
export const SUPPORTED_DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set(['.pdf', '.md', '.txt'])

/** Lower-case file extension (including the leading dot), or '' when none. */
export const fileExtension = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot).toLowerCase()
}

/** Whether `path` has a supported knowledge-document extension. */
export const isSupportedDocument = (path: string): boolean =>
  SUPPORTED_DOCUMENT_EXTENSIONS.has(fileExtension(path))

/**
 * Extract text from PDF bytes via `unpdf`. Falls back to a UTF-8 decode of
 * the raw bytes when the file is not a parseable PDF — this keeps document
 * ingestion robust for non-PDF content that happens to carry a `.pdf`
 * extension.
 *
 * The raw-text fallback is decoded UP FRONT: `unpdf` (PDF.js) transfers and
 * detaches the input buffer, so `bytes` is zero-length once `getDocumentProxy`
 * has run — decoding afterwards would yield `''`. A copy is handed to `unpdf`
 * so the detach only affects the throwaway clone.
 */
const parsePdf = async (bytes: Uint8Array): Promise<string> => {
  const fallback = new TextDecoder('utf-8').decode(bytes)
  try {
    const pdf = await getDocumentProxy(Uint8Array.from(bytes))
    const { text } = await extractText(pdf, { mergePages: true })
    const merged = Array.isArray(text) ? text.join('\n') : text
    if (merged.trim().length > 0) return merged
  } catch {
    // Not a parseable PDF — fall through to the raw-text fallback.
  }
  return fallback
}

/**
 * Parse a knowledge-document file into plain text.
 *
 * Dispatches on the file extension. Unsupported extensions yield an empty
 * string (callers skip them with a warning before reaching this function).
 */
export const parseDocument = async (input: {
  readonly path: string
  readonly bytes: Uint8Array
}): Promise<string> => {
  const ext = fileExtension(input.path)
  if (ext === '.pdf') {
    return parsePdf(input.bytes)
  }
  const text = new TextDecoder('utf-8').decode(input.bytes)
  if (ext === '.md') {
    return markdownToText(text)
  }
  // `.txt` (and any other supported plain-text format) passes through.
  return text
}

/**
 * The text of a chat attachment, for the model to read as a quoted document,
 * or `undefined` when the type has no text to give (a raster image) or the file
 * cannot be read (a damaged Word document). `mediaType` is the type the upload
 * route read from the file's content, so it is trusted here; CSV and Markdown
 * are given verbatim, because a model reads both as they are written.
 */
export const extractAttachmentText = async (input: {
  readonly mediaType: string
  readonly bytes: Uint8Array
}): Promise<string | undefined> => {
  if (input.mediaType === 'application/pdf') return parsePdf(input.bytes)
  if (input.mediaType === DOCX_MEDIA_TYPE) return docxToText(input.bytes)
  // An SVG is markup: a model that cannot take it as a picture reads it as text.
  if (input.mediaType.startsWith('text/') || input.mediaType === 'image/svg+xml') {
    return new TextDecoder('utf-8').decode(input.bytes)
  }
  return undefined
}
