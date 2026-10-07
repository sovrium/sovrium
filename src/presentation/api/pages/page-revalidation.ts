/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Revalidated page responses — the validator half of the
 * `REVALIDATED_PAGE_CACHE_CONTROL` disposition (see `page-cache-decision.ts`).
 *
 * An anonymous render of a page that reads record data is sent
 * `public, no-cache`: a browser or a CDN may keep the bytes, but must ask the
 * server before showing them again. Asking is only cheap if the server can say
 * "what you hold is still right" without resending it, so the response carries
 * a weak `ETag` taken over the exact bytes sent, and a request whose
 * `If-None-Match` names it is answered `304 Not Modified` with no body.
 *
 * The page is still rendered in full to compute the tag: the saving is the
 * transfer, never the render. That is the price of a next visit that is fresh
 * by construction — a write changes the bytes, the bytes change the tag, and
 * the visitor's copy fails revalidation.
 *
 * Weak (`W/`) rather than strong: the tag promises the same page, not the same
 * octets on the wire — a compression layer in front of the server may re-encode
 * the body without invalidating it.
 */

import { createHash } from 'node:crypto'
import type { Context } from 'hono'

/** The weak entity tag of a rendered page body. */
export const pageEntityTag = (body: string): string =>
  `W/"${createHash('sha256').update(body).digest('base64url')}"`

/** An entity tag without its weak marker, for the weak comparison RFC 9110 prescribes. */
const opaqueTag = (tag: string): string => (tag.startsWith('W/') ? tag.slice(2) : tag)

/**
 * Whether an `If-None-Match` header names `entityTag` — a list member under the
 * weak comparison, or `*`. A missing or empty header matches nothing.
 */
export const ifNoneMatchNames = (header: string | undefined, entityTag: string): boolean => {
  if (header === undefined || header.trim() === '') return false
  const wanted = opaqueTag(entityTag)
  return header
    .split(',')
    .map((member) => member.trim())
    .some((member) => member === '*' || opaqueTag(member) === wanted)
}

/**
 * Send a page body under the revalidated disposition: tagged over the exact
 * bytes sent (a content-only partial therefore gets its own tag), and answered
 * `304` with no body when the request already holds them. The 304 repeats the
 * 200's headers — `Cache-Control`, `Vary`, the tag — as RFC 9110 requires of a
 * Not Modified answer.
 */
export const sendRevalidatedPage = (
  c: Context,
  body: string,
  headers: Readonly<Record<string, string>>
): Response => {
  const entityTag = pageEntityTag(body)
  const tagged = { ...headers, ETag: entityTag }
  if (ifNoneMatchNames(c.req.header('If-None-Match'), entityTag)) {
    return c.body(null, 304, tagged)
  }
  return c.html(body, 200, tagged)
}
