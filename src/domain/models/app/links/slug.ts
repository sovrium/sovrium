/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The charset a short-link slug may use: lowercase alphanumerics joined by
 * single `-` or `_` separators. No leading, trailing or doubled separator.
 *
 * TWO properties of this pattern are load-bearing at runtime, and neither is
 * cosmetic — relaxing either one breaks something elsewhere:
 *
 *  1. **Lowercase only.** A short link's whole job is to survive a poster, a
 *     business card and a phone call. Base62 case-sensitivity (`/l/aB3xK` being
 *     a different link from `/l/ab3xk`) is a permanent support tax for a
 *     namespace gain Sovrium does not need. The resolver lowercases the incoming
 *     token and 301s any token that differed, so there is exactly ONE canonical
 *     address per link — which matters because that address is also the join key
 *     every click event is recorded under.
 *
 *  2. **No `.`** — which is what makes `token.endsWith('.svg')` an EXACT
 *     discriminator in the `/l/:token` handler. Because no slug can contain a
 *     dot, `raw.slice(0, -4)` is unambiguous for every input, and the QR route
 *     and the redirect route can share one handler instead of two overlapping
 *     param routes whose registration order would decide the winner.
 */
export const LINK_SLUG_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/

/**
 * Slugs the link namespace reserves for itself.
 *
 * `/api/admin/links/overview` and `/api/admin/links/series` are registered
 * before `/api/admin/links/:slug`, so a link minted under either name would be
 * shadowed by its own console endpoint and could never be opened. Rejecting the
 * name at decode time is better than shipping a link that resolves publicly but
 * is invisible to the operator who owns it.
 */
export const RESERVED_LINK_SLUGS: ReadonlySet<string> = new Set(['overview', 'series'])

/**
 * The single path segment after `/l/`.
 *
 * Bounded at 64 characters: long enough for a readable campaign name
 * (`spring-promo-newsletter-2026`), short enough that the whole short URL still
 * fits on a business card and inside a low-density QR symbol.
 */
export const LinkSlugSchema = Schema.String.pipe(
  Schema.annotate({
    identifier: 'LinkSlug',
    title: 'Link Slug',
    description:
      "The single path segment after /l/ (e.g. 'spring-promo' resolves at /l/spring-promo). Lowercase and dot-free by construction, so each link has exactly one canonical address.",
    examples: ['spring-promo', 'deck', 'q3_report'],
  }),
  Schema.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(64),
    Schema.isPattern(LINK_SLUG_PATTERN, {
      message:
        "link 'slug' must be lowercase alphanumeric with single '-' or '_' separators (e.g. 'spring-promo') — it must not contain '/', '.', uppercase letters or whitespace",
    }),
    Schema.makeFilter((slug) =>
      RESERVED_LINK_SLUGS.has(slug)
        ? `Link slug '${slug}' is reserved — the admin console serves /api/admin/links/${slug}, so a link under this name could never be opened from the dashboard`
        : true
    )
  )
)

/**
 * TypeScript type inferred from LinkSlugSchema
 * @public
 */
export type LinkSlug = Schema.Schema.Type<typeof LinkSlugSchema>
