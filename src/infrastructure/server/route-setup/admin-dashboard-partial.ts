/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type { Context } from 'hono'

const PARTIAL_HEADER = 'x-sovrium-partial'
const PARTIAL_VALUE = 'content'
const PARTIAL_PARAM = '_partial'

const CONTENT_MARKER = 'id="admin-surface-content"'

export function isPartialRequest(
  c: Context
): boolean {
  const header = c.req.header(PARTIAL_HEADER)
  if (header === PARTIAL_VALUE) return true
  return c.req.query(PARTIAL_PARAM) === '1'
}

function findMatchingClose(html: string, cursor: number, depth: number): number {
  const nextClose = html.indexOf('</div>', cursor)
  if (nextClose === -1) return -1
  const nextOpen = html.indexOf('<div', cursor)
  if (nextOpen !== -1 && nextOpen < nextClose) {
    return findMatchingClose(html, nextOpen + 4, depth + 1)
  }
  if (depth === 1) return nextClose
  return findMatchingClose(html, nextClose + 6, depth - 1)
}

export function extractSurfaceContent(fullHtml: string): string | undefined {
  const markerIndex = fullHtml.indexOf(CONTENT_MARKER)
  if (markerIndex === -1) return undefined

  const openEnd = fullHtml.indexOf('>', markerIndex)
  if (openEnd === -1) return undefined
  const innerStart = openEnd + 1

  const closeIndex = findMatchingClose(fullHtml, innerStart, 1)
  if (closeIndex === -1) return undefined
  return fullHtml.slice(innerStart, closeIndex)
}
