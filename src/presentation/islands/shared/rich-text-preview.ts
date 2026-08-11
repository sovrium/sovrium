/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Flatten stored rich-text markup to a one-line plain-text preview, for the
 * dense read-only surfaces (a grid cell, a card summary) where the prose has to
 * be legible but its structure cannot fit.
 *
 * ## This is NOT a sanitiser
 *
 * The result is rendered as TEXT — React escapes it — so nothing here is a
 * security boundary and nothing here may be relied on as one. The single
 * canonical sanitiser is `sanitizeRichTextHTML` (security rule S2) and it stays
 * the only thing standing between stored markup and `dangerouslySetInnerHTML`.
 * What this does is cosmetic: it stops a reader seeing `<p>` and `<strong>`
 * spelled out in a cell.
 *
 * ## Why not reuse the canonical sanitiser
 *
 * `stripHtmlToText` is backed by a full HTML parser package. Importing it here
 * would pull that parser into the client bundle for the sake of a text preview,
 * which is the kind of weight ecoconception R2 exists to refuse. The browser
 * already ships a parser, and `DOMParser` with `text/html` is inert by
 * specification: it runs no script and fetches no resource.
 *
 * Script-ish elements are dropped before the text is read, because their
 * CONTENT is text too — left in place, a `<script>alert(1)</script>` would
 * surface its source in the preview.
 */

/** Elements whose text content is code or metadata, never prose. */
const NON_PROSE_SELECTOR = 'script, style, noscript, template, iframe, object, embed'

/** Collapse runs of whitespace so a multi-line body reads as one line. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

/**
 * Fallback for any environment without `DOMParser` (server-side render of an
 * island shell). Deliberately conservative and deliberately not clever: it
 * drops script-ish blocks with their content, then removes the remaining tags.
 * A construct that defeats it produces a slightly wrong PREVIEW, never an
 * execution — see the note above about what this function is not.
 */
const stripWithoutParser = (html: string): string =>
  oneLine(
    html
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  )

/** A one-line, markup-free preview of stored rich text. */
export function richTextPreview(html: string): string {
  if (typeof DOMParser === 'undefined') return stripWithoutParser(html)
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  Array.from(parsed.body.querySelectorAll(NON_PROSE_SELECTOR)).forEach((element) => {
    element.remove()
  })
  return oneLine(parsed.body.textContent ?? '')
}
