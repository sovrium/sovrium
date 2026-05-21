/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export type ExtractTextFormat = 'plain' | 'markdown'

export interface ExtractedText {
  readonly text: string
  readonly wordCount: number
  readonly pageCount: number
}

const PDF_MAGIC = '%PDF'

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

const htmlToText = (html: string): string =>
  html
    .replace(/<\s*(br|\/p|\/h[1-6]|\/div|\/li)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')

type ExtractSourceKind = 'pdf' | 'html' | 'text' | 'unknown'

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set(['txt', 'md', 'csv'])
const HTML_EXTENSIONS: ReadonlySet<string> = new Set(['html', 'htm'])

const detectSourceKind = (bytes: Uint8Array, key: string): ExtractSourceKind => {
  const ext = extOf(key)
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 8))
  if (ext === 'pdf' || head.startsWith(PDF_MAGIC)) return 'pdf'
  if (HTML_EXTENSIONS.has(ext)) return 'html'
  if (TEXT_EXTENSIONS.has(ext) || looksTextual(bytes)) return 'text'
  return 'unknown'
}

const extractFromPdf = (bytes: Uint8Array): ExtractedText => {
  const raw = new TextDecoder('latin1').decode(bytes)
  const text = extractPdfText(raw)
  return { text, wordCount: countWords(text), pageCount: countPdfPages(raw) }
}

const extractFromHtml = (bytes: Uint8Array): ExtractedText => {
  const decoded = new TextDecoder('utf-8').decode(bytes)
  const text = htmlToText(decoded)
  return { text, wordCount: countWords(text), pageCount: 1 }
}

const extractFromText = (bytes: Uint8Array): ExtractedText => {
  const text = new TextDecoder('utf-8').decode(bytes).trim()
  return { text, wordCount: countWords(text), pageCount: 1 }
}

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
