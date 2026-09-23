/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Native Admin Dashboard SPA partial-render support
 *.
 *
 * The SPA client nav module swaps ONLY the `#admin-surface-content` region of a
 * dashboard surface, keeping the persistent sidebar + ⌘K palette mounted. To do
 * that it fetches a CONTENT-ONLY partial: the same surface rendered through the
 * existing trusted page pipeline, with the shell (`<html>`, sidebar island,
 * palette host) stripped away so only the inner HTML of `#admin-surface-content`
 * remains.
 *
 * The partial reuses the FULL render verbatim and extracts the content region
 * from it — no second render path, no parallel template, so the partial can
 * never drift from the full document. The detection signal is the request
 * (header or query param), resolved by {@link isPartialRequest}.
 */

import type { Context } from 'hono'

/** The header the SPA client nav module sets to request a content-only partial. */
const PARTIAL_HEADER = 'x-sovrium-partial'
/** The header value that signals a partial request. */
const PARTIAL_VALUE = 'content'
/** The query-param fallback (for environments that can't set the header). */
const PARTIAL_PARAM = '_partial'

/**
 * The stable swap-target marker the partial extracts.
 *
 * Emitted by the console's own shell component, `src/admin/config/components/shell.ts`,
 * which is where it moved when the TypeScript shell that used to wrap every
 * surface was deleted. The two spellings must agree; nothing but this comment
 * links them, because one is a config string and the other a server constant.
 */
const CONTENT_MARKER = 'id="admin-surface-content"'

/**
 * Whether a request is a content-only partial request — header form (primary)
 * OR query-param form (fallback). Anything else is a full-document request and
 * is rendered unchanged (deep-link / refresh — SPA-004).
 */
export function isPartialRequest(c: Context): boolean {
  const header = c.req.header(PARTIAL_HEADER)
  if (header === PARTIAL_VALUE) return true
  return c.req.query(PARTIAL_PARAM) === '1'
}

/**
 * Find the index of the `</div>` that balances the `<div>` opened just before
 * `innerStart` (depth starts at 1). Recursive walk — at each step it compares
 * the next `<div` and next `</div>`: a nearer open deepens, a nearer close
 * either un-nests or, at depth 1, is the match. Returns `-1` if unbalanced.
 */
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

/**
 * Extract the INNER HTML of the `#admin-surface-content` region from a full
 * surface document. Returns `undefined` if the marker is absent (so the caller
 * can fall back to the full document rather than emit an empty partial).
 *
 * The extraction is structural: it locates the marker, finds where the opening
 * `<div …>` tag ends, then balances nested `<div>` / `</div>` to find the
 * matching close. This survives the nested `<div>`s of the chrome + surface body
 * without depending on SSR attribute order.
 *
 * @param fullHtml - the full surface document rendered by the page pipeline
 */
export function extractSurfaceContent(fullHtml: string): string | undefined {
  const markerIndex = fullHtml.indexOf(CONTENT_MARKER)
  if (markerIndex === -1) return undefined

  // The opening tag ends at the first `>` after the marker (attributes can't
  // contain a raw `>`; React SSR escapes attribute values).
  const openEnd = fullHtml.indexOf('>', markerIndex)
  if (openEnd === -1) return undefined
  const innerStart = openEnd + 1

  const closeIndex = findMatchingClose(fullHtml, innerStart, 1)
  if (closeIndex === -1) return undefined
  return fullHtml.slice(innerStart, closeIndex)
}

/**
 * The header a content-only partial carries its destination's document title in.
 *
 * The title lives in `<head>`, which is exactly the half the partial strips
 * away, so a swap has no way to learn it from the body it receives. Sending it
 * beside the body keeps the ONE render rule this module is built on: the
 * partial is still the full document with the shell removed, never a second
 * render path that could disagree with it.
 *
 * The value is percent-encoded, and that is not decoration. A header is
 * latin1 on the wire, while a title is author text — `Paramètres`, `日本語` —
 * and a raw non-latin1 byte makes the runtime throw when the header is SET,
 * turning a French page title into a 500 on the partial and a console that
 * falls back to a full navigation on every click. Encoding costs nothing and
 * removes the entire class.
 */
export const PARTIAL_TITLE_HEADER = 'X-Sovrium-Title'

/**
 * The five entities React SSR escapes into a text node, mapped back.
 *
 * The title is read out of SERIALIZED HTML, so `Ben & Jerry` arrives as
 * `Ben &amp; Jerry`. Assigning that to `document.title` verbatim would show the
 * entity to the reader — and would differ from what the same page shows on a
 * cold load, where the parser decoded it. Decoding here is what makes the two
 * paths agree, which is the whole promise the swap makes.
 */
const SSR_ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#x27;/g, "'"],
  // `&amp;` LAST: decoding it first would let `&amp;lt;` — a literal `&lt;` the
  // author wrote — turn into a `<`, which is the classic double-decode.
  [/&amp;/g, '&'],
]

/**
 * Extract the document title from a full surface document, percent-encoded for
 * {@link PARTIAL_TITLE_HEADER}.
 *
 * Returns `undefined` when the document declares no title, so the caller sends
 * no header at all and the client leaves `document.title` alone — a stale title
 * is wrong, but a title blanked to the empty string is worse, and an absent
 * `<title>` is not a claim that the destination has none.
 */
export function extractDocumentTitle(fullHtml: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(fullHtml)
  const raw = match?.[1]
  if (raw === undefined || raw === '') return undefined
  const decoded = SSR_ENTITIES.reduce(
    (text, [pattern, character]) => text.replace(pattern, character),
    raw
  )
  return encodeURIComponent(decoded)
}
