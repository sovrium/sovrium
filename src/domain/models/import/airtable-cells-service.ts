/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Airtable cells as canonical values: one function per cell shape the Web API
 * serves (`cellFormat=json`), pinned under
 * `[internal ref]` (facts d4 to d7, e1).
 *
 * - A **link** is a list of record ids: each becomes a link to that record of
 *   the field's `linkedTableId`.
 * - A **collaborator** is `{ id, email?, name? }`: it becomes a user reference
 *   when it carries an email, and is dropped otherwise (a group has none).
 * - An **attachment** is `{ id, filename, type, url, … }`: it becomes a
 *   reference to the file the fetch downloaded into `assets/`, found through
 *   the fetch's attachment index by the attachment id. The URL is never kept:
 *   it expires.
 * - A **percent** is a fraction (`0.4`); the canonical value is a percentage
 *   (`40`), as a CSV's `40%` reads.
 * - **Rich text** is Markdown; it becomes the HTML subset a rich-text field
 *   keeps (paragraphs, headings, lists, quotes, bold, italic, strikethrough,
 *   code and web links), every other character escaped.
 * - A **button** is `{ label, url }`: its URL is kept; a button with no URL
 *   (`null` or empty) holds nothing.
 * - An **AI text** cell is `{ state, value, isStale }`: its generated text is
 *   kept, and a cell in error (`value: null`) holds nothing. A **barcode** is
 *   `{ text, type }`: its text is kept.
 * - A computed cell in error (`{ error: … }`) holds nothing.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import type { CanonicalValue } from './canonical-base'
import type { SnapshotAsset } from './snapshot-manifest'

/** One downloaded attachment, as the fetch's index records it. */
export type AirtableAsset = SnapshotAsset

/** What a cell function reads besides the cell. */
export interface CellContext {
  readonly options: Readonly<Record<string, unknown>> | undefined
  /** The downloaded attachments, by Airtable attachment id. */
  readonly assets: ReadonlyMap<string, AirtableAsset>
}

type Json = Readonly<Record<string, unknown>>
type Item = Exclude<CanonicalValue, readonly unknown[]>

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [value])

const EMAIL = /^[^\s@]+@[^\s@]+$/

/** The text a structured value stands for, when it is not one of the canonical shapes. */
const textOf = (value: Json): string | undefined => {
  if ('error' in value) return undefined
  const named = ['text', 'value', 'name', 'label', 'email', 'filename']
    .map((key) => value[key])
    .find((candidate) => typeof candidate === 'string')
  return typeof named === 'string' ? named : JSON.stringify(value)
}

/** A plain cell: a scalar as it is, a structure as its text, a list item by item. */
const scalar = (value: unknown): Item | undefined => {
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  return isRecord(value) ? textOf(value) : undefined
}

const plain = (value: unknown): CanonicalValue | undefined => {
  if (!Array.isArray(value)) return scalar(value)
  const items = value.flatMap((item) => {
    const one = scalar(item)
    return one === undefined ? [] : [one]
  })
  return items.length === 0 ? undefined : items
}

const userRef = (value: unknown): Item | undefined => {
  const email = isRecord(value) ? value['email'] : undefined
  return typeof email === 'string' && EMAIL.test(email) ? { kind: 'user', email } : undefined
}

const users = (value: unknown, many: boolean): CanonicalValue | undefined => {
  const refs = listOf(value).flatMap((item) => {
    const ref = userRef(item)
    return ref === undefined ? [] : [ref]
  })
  if (refs.length === 0) return undefined
  return many ? refs : refs[0]
}

const links = (value: unknown, context: CellContext): CanonicalValue | undefined => {
  const table = context.options?.['linkedTableId']
  if (typeof table !== 'string') return undefined
  const refs = listOf(value).flatMap((record) =>
    typeof record === 'string' ? [{ kind: 'link' as const, table, record }] : []
  )
  return refs.length === 0 ? undefined : refs
}

const attachments = (value: unknown, context: CellContext): CanonicalValue | undefined => {
  const files = listOf(value).flatMap((item): readonly Item[] => {
    if (!isRecord(item) || typeof item['filename'] !== 'string') return []
    const held = typeof item['id'] === 'string' ? context.assets.get(item['id']) : undefined
    const asset = held?.asset
    return [
      {
        kind: 'attachment',
        filename: item['filename'],
        ...(asset === undefined ? {} : { asset }),
        ...(typeof item['type'] === 'string' ? { mimeType: item['type'] } : {}),
      },
    ]
  })
  return files.length === 0 ? undefined : files
}

/** A fraction as a percentage, rounded so `0.07 * 100` stays `7`. */
const percent = (value: unknown): CanonicalValue | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value * 100 * 1e9) / 1e9
    : undefined

const SAFE_LINK = /^(?:https?:|mailto:)/i

/** Inline Markdown on an already-escaped line. */
const inline = (line: string): string =>
  line
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/(^|[^*\w])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (whole, text: string, href: string) =>
      SAFE_LINK.test(href) ? `<a href="${href}">${text}</a>` : whole
    )

const LIST_ITEM = /^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/
const HEADING = /^(#{1,6})\s+/
const QUOTE = /^>\s?/

/** One block of lines (no blank line inside) as HTML. */
const block = (lines: readonly string[]): string => {
  const [first = ''] = lines
  if (lines.every((line) => LIST_ITEM.test(line))) {
    const tag = /^\s*\d+\./.test(first) ? 'ol' : 'ul'
    const items = lines.map((line) => `<li>${inline(line.replace(LIST_ITEM, ''))}</li>`)
    return `<${tag}>${items.join('')}</${tag}>`
  }
  const heading = HEADING.exec(first)
  if (heading !== null && lines.length === 1) {
    const level = Math.min(heading[1]?.length ?? 1, 6)
    return `<h${String(level)}>${inline(first.replace(HEADING, ''))}</h${String(level)}>`
  }
  if (lines.every((line) => QUOTE.test(line))) {
    return `<blockquote><p>${lines.map((line) => inline(line.replace(QUOTE, ''))).join('<br>')}</p></blockquote>`
  }
  return `<p>${lines.map(inline).join('<br>')}</p>`
}

/** Airtable's Markdown as the HTML subset a rich-text field keeps. */
export const markdownToRichText = (markdown: string): string =>
  escapeHtml(markdown.replace(/\r\n?/g, '\n'))
    .split(/\n\s*\n/)
    .map((chunk) => chunk.split('\n').filter((line) => line.trim() !== ''))
    .filter((lines) => lines.length > 0)
    .map(block)
    .join('')

const richText = (value: unknown): CanonicalValue | undefined =>
  typeof value === 'string' && value.trim() !== '' ? markdownToRichText(value) : undefined

const button = (value: unknown): CanonicalValue | undefined =>
  isRecord(value) && typeof value['url'] === 'string' && value['url'] !== ''
    ? value['url']
    : undefined

/** AI text: the generated text; a cell still generating or in error holds nothing. */
const aiText = (value: unknown): CanonicalValue | undefined => {
  if (typeof value === 'string') return value
  return isRecord(value) && typeof value['value'] === 'string' ? value['value'] : undefined
}

/** The cell functions, by Airtable field type; every other type is read as plain. */
const CELLS: Readonly<
  Record<string, (value: unknown, context: CellContext) => CanonicalValue | undefined>
> = {
  multipleRecordLinks: links,
  singleCollaborator: (value) => users(value, false),
  createdBy: (value) => users(value, false),
  lastModifiedBy: (value) => users(value, false),
  multipleCollaborators: (value) => users(value, true),
  multipleAttachments: attachments,
  percent,
  richText,
  button,
  aiText,
}

/** One Airtable cell as a canonical value, or `undefined` when it holds nothing. */
export const airtableCell = (
  type: string,
  value: unknown,
  context: CellContext
): CanonicalValue | undefined => {
  if (value === null || value === undefined) return undefined
  const read = CELLS[type]
  return read === undefined ? plain(value) : read(value, context)
}
