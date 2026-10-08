/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { stripHtmlToText } from './html-sanitization'

/**
 * THE PLAIN-TEXT PART OF A MESSAGE, DERIVED FROM ITS (SANITIZED) HTML.
 *
 * Written for a reader with a text-only client: a link reads `label (url)`
 * (its address once when the label is the address), a simple table is one
 * line per row with ` | ` between the cells, paragraphs are separated by a
 * blank line, a `<br>` is a line break, and nothing of a `<style>` or
 * `<script>` block appears (the parser drops their content).
 *
 * The markup here is only marked up before the parser-based strip
 * (`stripHtmlToText`) removes every tag, so the output is text, never HTML.
 */

const LINK = /<a\b[^>]*?\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi
const ROW = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi
const CELL = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi
const BLOCK_END = /<\/(?:p|h[1-6]|div|li|table|ul|ol|blockquote|section|header|footer)\s*>/gi
const LINE_BREAK = /<br\s*\/?>/gi

const ENTITIES: Readonly<Record<string, string>> = { '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }

const textOf = (html: string): string =>
  stripHtmlToText(html)
    .replace(/&(?:quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()

const linkAsText = (_match: string, href: string, label: string): string => {
  const text = textOf(label)
  const url = href.replace(/&amp;/g, '&')
  return text === '' || text === url ? url : `${text} (${url})`
}

const rowAsLine = (_match: string, cells: string): string =>
  `${[...cells.matchAll(CELL)].map((cell) => textOf(cell[1] ?? '')).join(' | ')}\n`

/** The plain-text part a message's HTML reads as. */
export const emailTextFromHtml = (html: string): string =>
  stripHtmlToText(
    html
      .replace(LINK, linkAsText)
      .replace(ROW, rowAsLine)
      .replace(BLOCK_END, '\n\n')
      .replace(LINE_BREAK, '\n')
  )
    .replace(/&(?:quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
