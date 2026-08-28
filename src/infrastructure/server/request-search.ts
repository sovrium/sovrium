/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The raw query string of a request, for redirects that must preserve it
 * byte-for-byte.
 *
 * ## Why this is not `c.req.query()`
 *
 * The obvious implementation — read the parsed params and re-serialize them —
 * is silently lossy. `URLSearchParams` reorders nothing but normalizes
 * percent-encoding, and rebuilding the string from an object reorders keys.
 * Either is enough to break campaign attribution (`?utm_source=…&utm_campaign=…`
 * arriving in a different order or with `%20` rewritten to `+`), signed URLs
 * whose signature covers the exact query string, and any downstream consumer
 * comparing the raw value.
 *
 * Every redirect Sovrium emits must therefore carry the query string EXACTLY as
 * the visitor sent it, which means slicing it off the raw URL. Extracted here
 * rather than copied because the wrong version is the one that looks right: the
 * rationale needs a single home, or the next redirect-emitting route
 * reintroduces the bug.
 */

/**
 * The single thing this helper reads. Declared structurally rather than as
 * `Context` so it accepts a handler context under ANY Hono env generic —
 * `Context<BlankEnv>` and `Context<{ Variables: … }>` are mutually
 * unassignable, and neither call site should have to care.
 */
interface RequestWithUrl {
  readonly req: { readonly url: string }
}

/**
 * The raw query string of the incoming request, including its leading `?`, or
 * the empty string when there is none.
 *
 * @param c - The Hono request context.
 * @returns The verbatim search string, ready to append to a redirect target.
 */
export const requestSearch = (c: RequestWithUrl): string => {
  const queryIndex = c.req.url.indexOf('?')
  return queryIndex === -1 ? '' : c.req.url.slice(queryIndex)
}
