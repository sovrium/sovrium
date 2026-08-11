/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Plain-text extraction for the `file/extractText` action.
 *
 * Supported source types are inferred from the storage key's extension and
 * the byte signature: PDF (`.pdf` / `%PDF` magic), HTML (`.html`/`.htm`),
 * and plain text (`.txt` / valid UTF-8). Binary formats with no textual
 * representation (e.g. `.bin`) return `undefined` so the handler can
 * surface a graceful `error` outcome.
 *
 * PDF extraction is intentionally lightweight — it pulls visible text from
 * the content streams' `Tj`/`TJ` operators rather than embedding a full PDF
 * parser. This covers the automation use case (extracting body copy from
 * generated / simple PDFs) without a heavyweight native dependency.
 *
 * HTML extraction flattens markup via the canonical parser-based
 * `htmlToTextLines` stripper rather than a hand-rolled regex, so nested-tag
 * bypasses and entity double-unescaping are closed by construction.
 */

import { htmlToTextLines } from '@/domain/utils/html-sanitization'

export type ExtractTextFormat = 'plain' | 'markdown'

export interface ExtractedText {
  readonly text: string
  readonly wordCount: number
  readonly pageCount: number
}

const PDF_MAGIC = '%PDF'

/** True when every byte is a plausible UTF-8 text byte (no NUL / control noise). */
const looksTextual = (bytes: Uint8Array): boolean => {
  if (bytes.length === 0) return true
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096))
  const controlCount = sample.reduce(
    (count, byte) =>
      byte === 0 || byte < 0x09 || (byte > 0x0d && byte < 0x20) ? count + 1 : count,
    0
  )
  return controlCount / sample.length < 0.1
}

const extOf = (key: string): string => {
  const dot = key.lastIndexOf('.')
  return dot === -1 ? '' : key.slice(dot + 1).toLowerCase()
}

const countWords = (text: string): number => {
  const trimmed = text.trim()
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length
}

/** Pull literal-string operands out of a PDF body's text-showing operators. */
const extractPdfText = (raw: string): string => {
  const matches = raw.match(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g) ?? []
  return matches
    .map((m) => {
      const inner = /\(((?:[^()\\]|\\.)*)\)/.exec(m)?.[1] ?? ''
      return inner.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const countPdfPages = (raw: string): number => {
  const countMatch = /\/Count\s+(\d+)/.exec(raw)
  if (countMatch) return Math.max(1, Number(countMatch[1]))
  const typePages = (raw.match(/\/Type\s*\/Page\b/g) ?? []).length
  return Math.max(1, typePages)
}

const htmlToText = (html: string): string => htmlToTextLines(html).join('\n')

/** Detected source format for extraction dispatch. */
type ExtractSourceKind = 'pdf' | 'html' | 'text' | 'unknown'

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['txt', 'md', 'csv'])
const HTML_EXTENSIONS: ReadonlySet<string> = new Set(['html', 'htm'])

const detectSourceKind = (bytes: Uint8Array, key: string): ExtractSourceKind => {
  const ext = extOf(key)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 8))
  if (ext === 'pdf' || head.startsWith(PDF_MAGIC)) return 'pdf'
  if (HTML_EXTENSIONS.has(ext)) return 'html'
  // Both "declared as text by extension" and "no extension / unknown but
  // byte-content looks textual" funnel into the same `text` branch.
  if (TEXT_EXTENSIONS.has(ext) || looksTextual(bytes)) return 'text'
  return 'unknown'
}

const extractFromPdf = (bytes: Uint8Array): ExtractedText => {
  const raw = new TextDecoder('latin1').decode(bytes)
  const text = extractPdfText(raw)
  return { text, wordCount: countWords(text), pageCount: countPdfPages(raw) }
}

const extractFromHtml = (bytes: Uint8Array): ExtractedText => {
  // `format` is reserved for a future markdown-vs-plain difference. Today
  // both formats run through the same tag-stripping pipeline (and the prior
  // ternary `format === 'markdown' ? htmlToText : htmlToText` was a dead
  // branch — both arms identical). When markdown-specific extraction lands,
  // dispatch reopens here.
  const decoded = new TextDecoder('utf-8').decode(bytes)
  const text = htmlToText(decoded)
  return { text, wordCount: countWords(text), pageCount: 1 }
}

const extractFromText = (bytes: Uint8Array): ExtractedText => {
  const text = new TextDecoder('utf-8').decode(bytes).trim()
  return { text, wordCount: countWords(text), pageCount: 1 }
}

/**
 * Extract text from file bytes. Returns `undefined` for unsupported binary
 * formats so the caller can report a graceful error.
 *
 * `format` is currently advisory — the HTML pipeline produces the same text
 * regardless. The parameter is kept on the public signature so callers can
 * already pass `'markdown'` (per the spec) ahead of a future markdown-aware
 * HTML extractor.
 */
export const extractTextFromBytes = (
  bytes: Uint8Array,
  key: string,
  _format: ExtractTextFormat
): ExtractedText | undefined => {
  const kind = detectSourceKind(bytes, key)
  switch (kind) {
    case 'pdf':
      return extractFromPdf(bytes)
    case 'html':
      return extractFromHtml(bytes)
    case 'text':
      return extractFromText(bytes)
    default:
      return undefined
  }
}
