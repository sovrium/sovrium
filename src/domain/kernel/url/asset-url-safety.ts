/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure scheme validation for URL-valued ATTRIBUTES — the `src` of an `<img>`,
 * the `href` of a resource — whose value a visitor can influence.
 *
 * The threat is scheme control, not origin. A picture may legitimately live on
 * another host (a CDN, a gravatar, an object-storage bucket), so an attribute
 * sink cannot demand same-origin the way a navigation sink does. What it must
 * refuse is every scheme that is not a plain fetch: `javascript:` and
 * `vbscript:` run code where a user agent honours them, `data:` smuggles
 * inline content (and inline base64 is banned for assets anyway), `blob:` and
 * `file:` name things the page's author never chose. So the check accepts two
 * shapes and nothing else:
 *
 *  - a same-origin absolute path, decided by {@link toSafeRedirectPath} — the
 *    one canonical same-origin check, reused rather than re-derived; and
 *  - an absolute `http:` or `https:` URL, written with its `//` authority
 *    (the same shape `HttpUrlSchema` in `./url` admits at decode time) and
 *    carrying no credentials.
 *
 * Protocol-relative `//host`, `/\host`, relative paths, leading whitespace,
 * the empty string and non-strings are all refused. A refusal is `undefined`,
 * which every caller treats as an ABSENCE: draw the next rung of whatever
 * fall-back chain it has, never the raw value.
 *
 * ─── WHY THE RESULT IS THE PARSER'S `href` ─────────────────────────────────
 *
 * Both branches hand back a string the WHATWG URL parser serialised, never the
 * caller's input. That normalises the value (scheme and host lower-cased,
 * spaces, quotes and angle brackets percent-encoded) and it is what static
 * analysis can see: CodeQL taints a `URL` object only through its `search`,
 * `hash` and `searchParams` properties, so a value read off `href` is the
 * parser's output rather than DOM text reinterpreted as a URL. The same
 * reasoning is written out in full on {@link toSafeRedirectPath}.
 *
 * This is the single canonical check for URL-valued attributes, as
 * {@link toSafeRedirectPath} is for navigation — never add a second one.
 */

import { toSafeRedirectPath } from './redirect-safety'

/** An absolute web URL written with its authority: `http://…` or `https://…`. */
const ABSOLUTE_WEB_URL = /^https?:\/\//

/**
 * The address `value` denotes, serialised by the URL parser, when it is a
 * same-origin absolute path or an absolute `http(s)` URL without credentials;
 * `undefined` for anything else.
 */
export const toSafeAssetUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value === '') return undefined
  if (value.startsWith('/')) return toSafeRedirectPath(value)
  if (!ABSOLUTE_WEB_URL.test(value)) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (url.username !== '' || url.password !== '') return undefined
    return url.href
  } catch {
    // `https://` with no host, or an unparseable authority: not an address.
    return undefined
  }
}
