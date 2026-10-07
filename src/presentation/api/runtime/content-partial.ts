/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Content-only (SPA) partial-render support, shared by every route that
 * answers a client-side navigation.
 *
 * The client navigation module (`islands/navigation/spa-nav-*`) swaps ONE
 * region of a page and keeps everything around it mounted. To do that it
 * fetches a CONTENT-ONLY partial: the same page rendered through the existing
 * trusted page pipeline, with everything outside the region stripped away.
 *
 * The partial reuses the FULL render verbatim and extracts the region from it
 * — no second render path, no parallel template, so the partial can never
 * drift from the full document. The detection signal is the request (header
 * or query param), resolved by {@link isPartialRequest}.
 *
 * The operator console was the first consumer,
 * which is why the inner-HTML spelling {@link extractSurfaceContent} keeps its
 * console name: its response body is asserted end-to-end and must not change.
 */

import type { Context } from 'hono'

/** The header the client navigation module sets to request a content-only partial. */
export const PARTIAL_HEADER = 'X-Sovrium-Partial'
/** The header value that signals a partial request. */
export const PARTIAL_VALUE = 'content'
/** The query-param fallback (for environments that can't set the header). */
export const PARTIAL_PARAM = '_partial'

/**
 * The header a partial response ECHOES, with {@link PARTIAL_VALUE}, to say the
 * body really is a partial.
 *
 * Same name as the request header on purpose: the client asked in it and reads
 * the answer in it. A route that cannot extract its region falls back to the
 * FULL document, and a full document swapped into a region nests a second page
 * inside the first — so the client treats a response that does not echo the
 * header as "not a partial" and full-loads instead.
 */
// Spelled out rather than aliased to `PARTIAL_HEADER`: an alias is one binding
// exported under two names, which Knip reports as a duplicate export.
export const PARTIAL_ECHO_HEADER = 'X-Sovrium-Partial'

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
export const TITLE_HEADER = 'X-Sovrium-Title'

/**
 * The header a partial may carry the destination's density preset in, so a
 * swap between two pages of different density re-applies it on the document
 * root, which the body cannot reach. Absent means "leave it as it is".
 */
export const DENSITY_HEADER = 'X-Sovrium-Density'

/**
 * The header a partial sets to `1` when its region needs the page client
 * script and the document it lands in may not have loaded it. Absent means the
 * region needs nothing the document lacks.
 */
export const NEEDS_CLIENT_HEADER = 'X-Sovrium-Needs-Client'

/**
 * The console's swap-target region id.
 *
 * Emitted by the console's own shell component, `src/admin/config/components/shell.ts`.
 * The two spellings must agree; nothing but this comment
 * links them, because one is a config string and the other a server constant.
 */
const ADMIN_CONTENT_REGION_ID = 'admin-surface-content'

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

/** Whether `html[index]` ends a tag name — the `<div` of `<div>`, not of `<divider`. */
const endsTagName = (html: string, index: number): boolean => {
  const next = html.charAt(index)
  return next === '>' || next === '/' || /\s/.test(next)
}

/** The index of the next opening `<tag` at or after `cursor`, or `-1`. */
const findNextOpen = (html: string, tag: string, cursor: number): number => {
  const candidate = html.indexOf(`<${tag}`, cursor)
  if (candidate === -1) return -1
  return endsTagName(html, candidate + tag.length + 1)
    ? candidate
    : findNextOpen(html, tag, candidate + tag.length + 1)
}

/**
 * Find the index of the `</tag>` that balances the `<tag>` opened just before
 * `cursor` (depth starts at 1). Recursive walk — at each step it compares the
 * next `<tag` and next `</tag>`: a nearer open deepens, a nearer close either
 * un-nests or, at depth 1, is the match. Returns `-1` if unbalanced.
 *
 * Only the region's OWN tag is counted. A `<main>` region holds plenty of
 * `<div>`s and none of them can close it, while counting only `<div>` — as
 * this walk did while the console's `<div>` region was its only caller — would
 * take the first `</div>` inside a `<main>` for the `<main>`'s own close.
 */
const findMatchingClose = (html: string, tag: string, cursor: number, depth: number): number => {
  const closeTag = `</${tag}>`
  const nextClose = html.indexOf(closeTag, cursor)
  if (nextClose === -1) return -1
  const nextOpen = findNextOpen(html, tag, cursor)
  if (nextOpen !== -1 && nextOpen < nextClose) {
    return findMatchingClose(html, tag, nextOpen + tag.length + 1, depth + 1)
  }
  if (depth === 1) return nextClose
  return findMatchingClose(html, tag, nextClose + closeTag.length, depth - 1)
}

/** Where a region sits in a document: its outer span, and its inner span. */
interface RegionSpan {
  readonly start: number
  readonly innerStart: number
  readonly innerEnd: number
  readonly end: number
}

/**
 * Locate the element carrying `id="<markerId>"` and balance it to its close.
 *
 * The tag name is READ from the document — the `<tag` immediately preceding
 * the marker — rather than assumed, so a `<main id=…>` region balances `<main>`
 * and a `<div id=…>` region balances `<div>`. The marker must be an attribute
 * of its own (`␠id="…"`), so a `data-id="…"` carrying the same text is not
 * mistaken for it.
 *
 * The opening tag ends at the first `>` after the marker: React SSR escapes
 * `<` and `>` inside attribute values, so neither can appear raw inside a tag.
 */
const locateRegion = (html: string, markerId: string): RegionSpan | undefined => {
  const markerIndex = html.indexOf(` id="${markerId}"`)
  if (markerIndex === -1) return undefined
  const start = html.lastIndexOf('<', markerIndex)
  if (start === -1) return undefined
  const tag = /^<([a-zA-Z][a-zA-Z0-9-]*)\s/.exec(html.slice(start, markerIndex + 1))?.[1]
  if (tag === undefined) return undefined
  const openEnd = html.indexOf('>', markerIndex)
  if (openEnd === -1) return undefined
  const innerStart = openEnd + 1
  const innerEnd = findMatchingClose(html, tag, innerStart, 1)
  if (innerEnd === -1) return undefined
  return { start, innerStart, innerEnd, end: innerEnd + `</${tag}>`.length }
}

/**
 * Extract the OUTER HTML of the element carrying `id="<markerId>"` — its
 * opening tag through its matching close — from a full document. Returns
 * `undefined` when the marker is absent or the element never closes, so the
 * caller can fall back to the full document rather than emit a broken partial.
 *
 * @param fullHtml - the full document rendered by the page pipeline
 * @param markerId - the `id` of the region to extract
 */
export function extractRegionElement(fullHtml: string, markerId: string): string | undefined {
  const span = locateRegion(fullHtml, markerId)
  return span === undefined ? undefined : fullHtml.slice(span.start, span.end)
}

/**
 * Extract the INNER HTML of the console's `#admin-surface-content` region from
 * a full surface document. Returns `undefined` if the marker is absent (so the
 * caller can fall back to the full document rather than emit an empty partial).
 *
 * Inner rather than outer because the console's client keeps its own region
 * node and replaces only its children — the node survives the swap, which
 * an admin dashboard shell spa spec asserts.
 *
 * @param fullHtml - the full surface document rendered by the page pipeline
 */
export function extractSurfaceContent(fullHtml: string): string | undefined {
  const span = locateRegion(fullHtml, ADMIN_CONTENT_REGION_ID)
  return span === undefined ? undefined : fullHtml.slice(span.innerStart, span.innerEnd)
}

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
 * {@link TITLE_HEADER}.
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

/**
 * The headers every content-only partial carries: the {@link PARTIAL_ECHO_HEADER}
 * echo that says the body really is the region, and the destination's
 * {@link TITLE_HEADER} when its document declares one. One spelling for every
 * route that answers a partial, so the console and an app's pages cannot
 * disagree on what a partial says about itself.
 */
export function partialEchoHeaders(fullHtml: string): Readonly<Record<string, string>> {
  const title = extractDocumentTitle(fullHtml)
  return {
    [PARTIAL_ECHO_HEADER]: PARTIAL_VALUE,
    ...(title === undefined ? {} : { [TITLE_HEADER]: title }),
  }
}

/**
 * The density step a full document puts on its root (`<html data-density>`),
 * for {@link DENSITY_HEADER}. Read from the document rather than recomputed, so
 * the partial can never name a step the full load would not have painted.
 * Returns `undefined` when the root carries none.
 */
export function extractDocumentDensity(fullHtml: string): string | undefined {
  const root = /<html\b[^>]*>/i.exec(fullHtml)?.[0]
  const step = root === undefined ? undefined : /\sdata-density="([a-z-]+)"/.exec(root)?.[1]
  return step === undefined || step === '' ? undefined : step
}

/**
 * Whether a full document loads the page client script — the region it holds
 * needs that script, so a swap into a document that never loaded it must add
 * it ({@link NEEDS_CLIENT_HEADER}). Read from the document, which already made
 * that decision for the full load.
 */
export function documentLoadsClientScript(fullHtml: string): boolean {
  // Under its stable name, or the content-hashed one a prebuilt release emits,
  // whatever attribute precedes `src` (the loader's tag opens with `type="module"`).
  return /<script\b[^>]*\ssrc="\/assets\/client(?:-[a-f0-9]{8})?\.js"/.test(fullHtml)
}
