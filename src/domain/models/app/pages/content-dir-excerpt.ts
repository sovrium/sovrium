/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure helpers for building search-result excerpts from a markdown body.
 *
 * Used by the command-palette content search to surface a short snippet of body
 * text around the query match, with the matched span flagged so the client can
 * wrap it in `<mark>`. These are pure string functions — no I/O, no markdown
 * rendering — so they live in the domain layer and are unit-tested directly.
 */

/**
 * Strip markdown syntax down to readable plain text so an excerpt reads cleanly.
 *
 * This is a lightweight, allocation-friendly reducer — NOT a full markdown
 * parser. It removes the common inline/block syntax that would otherwise leak
 * into a one-line snippet:
 *   - fenced/inline code markers (keeps the code text),
 *   - heading hashes, blockquote markers, list bullets,
 *   - link/image syntax (keeps the visible label),
 *   - emphasis/strong/strike markers,
 *   - HTML tags,
 *   - collapses all whitespace (incl. newlines) to single spaces.
 *
 * The output is a single trimmed line suitable for substring matching and
 * excerpt extraction.
 */
export const stripMarkdownToPlainText = (markdown: string): string =>
  markdown
    // Fenced code blocks → keep inner text, drop the ``` fences + info string.
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code: string) => ` ${code} `)
    // Images: ![alt](url) → alt
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Links: [label](url) → label
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Inline code: `code` → code
    .replace(/`([^`]*)`/g, '$1')
    // Bold/italic/strike markers (**, __, *, _, ~~) → drop the markers.
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    // HTML tags → drop.
    .replace(/<[^>]+>/g, ' ')
    // Heading hashes, blockquote markers, list bullets at line start.
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
    // Collapse all whitespace (incl. newlines) to single spaces.
    .replace(/\s+/g, ' ')
    .trim()

/** The result of {@link extractMatchExcerpt}. */
export interface MatchExcerpt {
  /** The excerpt window of plain text (with leading/trailing ellipsis if clipped). */
  readonly excerpt: string
  /**
   * Start index of the matched query span WITHIN `excerpt` (0-based), or `-1`
   * when the query does not occur in the body. The client wraps
   * `excerpt.slice(matchStart, matchEnd)` in `<mark>`.
   */
  readonly matchStart: number
  /** End index (exclusive) of the matched span within `excerpt`. */
  readonly matchEnd: number
}

const ELLIPSIS = '…'

/**
 * Extract a short excerpt of `plain` centred on the first case-insensitive
 * occurrence of `query`, with the match span located so the caller can
 * highlight it.
 *
 * The window is `query.length + 2*radius` characters wide, clipped to the body.
 * When clipped at the start/end, a leading/trailing ellipsis is added and the
 * reported `matchStart`/`matchEnd` account for the ellipsis offset.
 *
 * Returns `matchStart: -1` (and the leading slice of the body as a fallback
 * excerpt) when the query is empty or does not occur — the caller can then omit
 * the `<mark>` and just show the snippet.
 *
 * @param plain - Plain text (typically the output of {@link stripMarkdownToPlainText}).
 * @param query - The user's search query.
 * @param radius - Characters of context to include on each side of the match
 *   (default 80).
 */
export const extractMatchExcerpt = (plain: string, query: string, radius = 80): MatchExcerpt => {
  const trimmedQuery = query.trim()
  if (trimmedQuery.length === 0) {
    const fallback = plain.length > radius * 2 ? `${plain.slice(0, radius * 2)}${ELLIPSIS}` : plain
    return { excerpt: fallback, matchStart: -1, matchEnd: -1 }
  }

  const matchIndex = plain.toLowerCase().indexOf(trimmedQuery.toLowerCase())
  if (matchIndex === -1) {
    const fallback = plain.length > radius * 2 ? `${plain.slice(0, radius * 2)}${ELLIPSIS}` : plain
    return { excerpt: fallback, matchStart: -1, matchEnd: -1 }
  }

  const windowStart = Math.max(0, matchIndex - radius)
  const windowEnd = Math.min(plain.length, matchIndex + trimmedQuery.length + radius)
  const clippedStart = windowStart > 0
  const clippedEnd = windowEnd < plain.length

  const core = plain.slice(windowStart, windowEnd)
  const prefix = clippedStart ? ELLIPSIS : ''
  const suffix = clippedEnd ? ELLIPSIS : ''
  const excerpt = `${prefix}${core}${suffix}`

  // Offset the match span by the window start and any leading ellipsis.
  const matchStart = prefix.length + (matchIndex - windowStart)
  const matchEnd = matchStart + trimmedQuery.length

  return { excerpt, matchStart, matchEnd }
}
