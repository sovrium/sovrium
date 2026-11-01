/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The canonical HTML escapers.
 *
 * Three character sets, because three kinds of place receive escaped text and
 * the repo's existing output is held byte-equal by generated assets and specs:
 *
 * - {@link escapeHtmlAttribute} — `& < > " '`. Safe in element content and in
 *   an attribute value under either quote. The default; use it unless the
 *   output must match one of the narrower sets byte for byte.
 * - {@link escapeHtmlDoubleQuotedAttribute} — `& < > "`, markdown-it's own set.
 *   Safe in element content and in a DOUBLE-quoted attribute only.
 * - {@link escapeHtmlText} — `& < >`. Element content only; never an attribute.
 *
 * `&` is always replaced first so an entity it produces is not escaped again.
 * Pure string functions with no imports: safe in the client bundle.
 */

const TEXT = /[&<>]/g
const DOUBLE_QUOTED = /[&<>"]/g
const ATTRIBUTE = /[&<>"']/g

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const entityOf = (char: string): string => ENTITIES[char] ?? char

/** Escape `& < >` — for element content only. */
export const escapeHtmlText = (value: string): string => value.replace(TEXT, entityOf)

/** Escape `& < > "` — for element content or a double-quoted attribute value. */
export const escapeHtmlDoubleQuotedAttribute = (value: string): string =>
  value.replace(DOUBLE_QUOTED, entityOf)

/** Escape `& < > " '` (`'` as `&#39;`) — for element content or any attribute value. */
export const escapeHtmlAttribute = (value: string): string => value.replace(ATTRIBUTE, entityOf)
