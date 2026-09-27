/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Conditional reads for personalised JSON: a strong `ETag` over the exact
 * bytes the caller receives, and a `304 Not Modified` with no body when the
 * caller already holds them.
 *
 * ## Why a middleware, and why AFTER the handler
 *
 * The tag is computed in the post-`next()` half, so every authentication,
 * role, field-permission and row-level guard has already run and shaped the
 * body. Two consequences follow by construction, not by care:
 *
 *  - a denied read is a `401`/`404`, never `ok`, so it is never tagged and a
 *    replayed tag can never turn it into a `304` (S1 anti-enumeration);
 *  - two callers whose permissions differ receive different bytes and
 *    therefore different tags, so a tag taken by one never revalidates for
 *    the other.
 *
 * Errors pass through untouched, so they still reach the client through
 * `sanitizeError` exactly as before.
 *
 * ## The cache contract
 *
 * `Cache-Control: private, no-cache` — no shared cache may store the answer,
 * and the browser must ask before reusing it, so a read that follows a write
 * always sees the write. `Vary: Cookie, Authorization` — a browser whose
 * session changes never reuses the previous caller's answer.
 *
 * Built on `hono/etag` rather than beside it: that middleware already owns the
 * `If-None-Match` comparison and the 304 header set RFC 9110 requires.
 */

import { etag } from 'hono/etag'
import type { MiddlewareHandler } from 'hono'

/** `Cache-Control` for a personalised read the browser must revalidate. */
const CONDITIONAL_READ_CACHE_CONTROL = 'private, no-cache'

/** Options for {@link conditionalRead}. */
interface ConditionalReadOptions {
  /**
   * Top-level JSON keys left out of the tag. For a key whose value changes on
   * every request (a `generatedAt` stamp) and says nothing about whether the
   * data moved — including it would make the tag unmatchable.
   */
  readonly ignoreKeys?: readonly string[]
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

/**
 * The bytes the tag is taken over: the body itself, or — when keys are
 * ignored — the body re-serialised without them. A body that is not a JSON
 * object is hashed as-is.
 */
const digestInput = (body: Uint8Array, ignoreKeys: readonly string[]): Uint8Array => {
  if (ignoreKeys.length === 0) return body
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(body))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return body
    const kept = Object.fromEntries(
      Object.entries(parsed).filter(([key]) => !ignoreKeys.includes(key))
    )
    return new TextEncoder().encode(JSON.stringify(kept))
  } catch {
    return body
  }
}

/**
 * Middleware: tag a successful GET with a strong ETag and answer a matching
 * `If-None-Match` with 304. Mount it on the route itself, in front of the
 * handler: `.get(path, conditionalRead(), handler)`.
 */
export const conditionalRead = (options: ConditionalReadOptions = {}): MiddlewareHandler => {
  const ignoreKeys = options.ignoreKeys ?? []
  const tag = etag({
    generateDigest: (body) =>
      crypto.subtle.digest('SHA-256', toArrayBuffer(digestInput(body, ignoreKeys))),
  })

  return (c, next) =>
    tag(c, async () => {
      await next()
      if (!c.res.ok) return
      // Set on the 200 BEFORE `etag` decides: a 304 keeps exactly these two
      // headers (plus the tag), as RFC 9110 requires of a Not Modified answer.
      c.res.headers.set('Cache-Control', CONDITIONAL_READ_CACHE_CONTROL)
      c.res.headers.append('Vary', 'Cookie')
      c.res.headers.append('Vary', 'Authorization')
    })
}
