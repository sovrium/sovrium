/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import Handlebars from 'handlebars'
import { sanitizeRichTextHTML } from '@/domain/kernel/sanitize/html-sanitization'
import { toStr } from './helper-coercion'

/**
 * The encoders behind position-aware rendering (`renderTemplateFor`) and the
 * two helpers that opt a value OUT of the default encoding on purpose:
 * `{{urlPath value}}` (a multi-segment path) and `{{{safeHtml value}}}` (rich
 * text in an HTML body).
 */

/**
 * Thrown by a helper, or by the encoder, when a value from run data cannot be
 * placed where the template puts it. Every other render failure keeps the
 * template as written; this one fails the step, because no encoding makes the
 * value safe there (`%2E%2E` resolves back to `..`).
 */
export class TemplateRefusal extends Error {
  readonly _tag = 'TemplateRefusal'
}

/** Whether a path segment walks the path (`.`, `..`, or either percent-encoded). */
export const isDotSegment = (segment: string): boolean => /^(?:\.|%2e){1,2}$/i.test(segment)

/**
 * `{{urlPath value}}` — a multi-segment path from run data (`deploy/notes.md`,
 * `owner/repo`): the slashes are kept and each segment is percent-encoded on
 * its own. A `.` or `..` segment is refused rather than encoded, since the
 * server resolves it either way.
 */
export const urlPath = (value: string): string => {
  const segments = value.split('/')
  if (segments.some(isDotSegment)) {
    throw new TemplateRefusal('a path value may not hold a `.` or `..` segment')
  }
  return segments.map((segment) => encodeURIComponent(segment)).join('/')
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** HTML-escape text: the five characters that can open markup or end an attribute. */
export const escapeHtmlText = (text: string): string =>
  text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char)

/** A Handlebars `SafeString` (what `safeHtml` returns): markup already made safe. */
const isSafeString = (value: unknown): value is { readonly toHTML: () => string } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { readonly toHTML?: unknown }).toHTML === 'function'

/** A value as Handlebars prints it: nothing for `null`/`undefined`, else its text. */
const toText = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  return isSafeString(value) ? value.toHTML() : String(value)
}

/** The encodings a value can be placed under. */
export type ValueEncoding = 'html' | 'xml' | 'url' | 'json'

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/**
 * XML-escape text (an OOXML part), and drop the characters XML 1.0 cannot
 * carry at all (C0 controls other than tab, newline, carriage return), which
 * would make the part unreadable.
 */
export const escapeXmlText = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex -- the characters XML 1.0 forbids
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char)

/**
 * Encode one value for where it lands. `html` passes a `SafeString` through
 * (it is `safeHtml`'s sanitized output); `xml` escapes everything; `url` percent-encodes it as one
 * component; `json` escapes it as the content of a JSON string.
 */
export const encodeValue = (value: unknown, encoding: ValueEncoding): string => {
  if (encoding === 'html')
    return isSafeString(value) ? value.toHTML() : escapeHtmlText(toText(value))
  // In XML even `safeHtml` output is text: markup from data never enters a part.
  if (encoding === 'xml') return escapeXmlText(toText(value))
  if (encoding === 'url') return encodeURIComponent(toText(value))
  return JSON.stringify(toText(value)).slice(1, -1)
}

/**
 * The two deliberate exceptions to position-aware encoding, as registered:
 * `{{urlPath value}}` keeps a multi-segment path whole (each segment encoded,
 * a `..` refused), and `{{{safeHtml value}}}` keeps rich text as markup once
 * the canonical sanitizer (S2) has run over it. A `SafeString` is what the
 * HTML encoder lets through unescaped.
 */
export const urlPathHelper = (value: unknown): string => urlPath(toStr(value))

export const safeHtmlHelper = (value: unknown): Handlebars.SafeString =>
  new Handlebars.SafeString(sanitizeRichTextHTML(toStr(value)))

/** `{{base64Encode value}}` — the UTF-8 bytes of the value, base64-encoded. */
export const base64EncodeHelper = (v: unknown): string =>
  Buffer.from(toStr(v), 'utf8').toString('base64')

/** `{{base64Decode value}}` — the base64 value decoded as UTF-8 text. */
export const base64DecodeHelper = (v: unknown): string =>
  Buffer.from(toStr(v), 'base64').toString('utf8')
