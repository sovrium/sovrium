/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export const stripMarkdownToPlainText = (markdown: string): string =>
  markdown
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code: string) => ` ${code} `)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|~~|\*|_)/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()

export interface MatchExcerpt {
  readonly excerpt: string
  readonly matchStart: number
  readonly matchEnd: number
}

const ELLIPSIS = '…'

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

  const matchStart = prefix.length + (matchIndex - windowStart)
  const matchEnd = matchStart + trimmedQuery.length

  return { excerpt, matchStart, matchEnd }
}
