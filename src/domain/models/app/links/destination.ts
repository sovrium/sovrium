/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Where a short link sends the visitor: a root-relative path on this app, or an
 * absolute `http(s)` URL.
 *
 * The pattern is character-for-character the one `RedirectToSchema` uses, and
 * deliberately so — but the THREAT MODEL differs, and conflating the two is how
 * a future reader ends up "unifying" them wrongly.
 *
 * A redirect table is same-origin infrastructure that happens to allow a
 * hand-off. A link shortener is an **open redirect by design**: pointing off-site
 * is the entire product. What makes that safe is not this pattern but the WRITE
 * AUTHORITY — destinations come from config (reviewed in git) or from an
 * admin-authenticated database write. So the pattern's job here is narrower:
 * reject the forms that are never intentional.
 *
 *  - `//evil.example.com` — protocol-relative, which a browser resolves as an
 *    absolute cross-origin URL. Accepting it would let a target that reads as a
 *    local path silently leave the origin.
 *  - `javascript:` / `data:` — cannot follow a leading `/` and are not http(s),
 *    so both fall outside the pattern.
 *  - whitespace-bearing targets, which no author writes on purpose.
 *
 * NOTE for whoever finds `isSafeRedirectPath` in `@/domain/kernel/url/redirect-safety`
 * and wonders why it is not reused: that helper is the canonical SAME-ORIGIN
 * check and would reject every legitimate off-site destination. It answers a
 * different question. This is not a second copy of it.
 */
export const LINK_DESTINATION_PATTERN = /^(?:\/(?!\/)[^\s#]*|https?:\/\/[^\s]+)$/

/**
 * A single destination for a link target.
 *
 * Rejects a destination that itself points back into `/l/` — a link pointing at
 * another link is a browser-visible extra hop that burns a click event on the
 * intermediate slug and can be arranged into a ring.
 */
export const LinkDestinationSchema = Schema.String.pipe(
  Schema.annotate({
    identifier: 'LinkDestination',
    title: 'Link Destination',
    description:
      'Where the short link sends the visitor — an absolute http(s) URL (the common case) or a root-relative path on this app.',
    examples: ['https://example.com/pricing', '/pricing'],
  }),
  Schema.check(
    Schema.isPattern(LINK_DESTINATION_PATTERN, {
      message:
        "link destination must be a root-relative path starting with a single '/' or an absolute http(s) URL — protocol-relative '//host' targets are rejected because a browser resolves them as absolute cross-origin URLs",
    }),
    Schema.makeFilter((to) =>
      to === '/l' || to.startsWith('/l/')
        ? `Link destination '${to}' points at another short link — chaining links burns a click event on the intermediate slug and can ring. Point at the final destination instead.`
        : true
    )
  )
)

/**
 * Whether a destination leaves the app entirely.
 *
 * Exported for the runtime resolver and the UTM merge, for the same reason
 * `isAbsoluteRedirectTarget` is exported from the redirects module: the
 * config-side and request-side notions of "absolute" must agree, or a link could
 * pass `sovrium validate` and then behave differently.
 */
export const isAbsoluteLinkDestination = (to: string): boolean =>
  to.startsWith('http://') || to.startsWith('https://')

/**
 * TypeScript type inferred from LinkDestinationSchema
 * @public
 */
export type LinkDestination = Schema.Schema.Type<typeof LinkDestinationSchema>
