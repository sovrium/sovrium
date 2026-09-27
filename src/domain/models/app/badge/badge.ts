/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * BadgeSchema controls the "Built with Sovrium" badge — a small static link
 * pill rendered bottom-right on every page of a Sovrium-generated app.
 *
 * Positive polarity (AppSchema carries zero `hideX` booleans): the badge is
 * SHOWN when the property is omitted or `true`, and hidden with `badge: false`.
 * Removal is free forever — one config line, never license-gated.
 *
 * The badge is pure SSR chrome: a static `<a href="https://sovrium.com?ref=badge">`
 * with zero telemetry (no beacon, no pixel, no image request, no JS). Its label
 * follows the page's active locale via an internal platform map (en/fr with
 * English fallback) — it is NOT app-authored `$t:` translation content and the
 * text is not customizable (trademark clarity).
 *
 * The object form `badge: { placement }` chooses WHERE the badge sits while
 * keeping it shown: `'floating'` (the default) pins it to the bottom-right
 * corner of the viewport; `'footer'` renders it as a static line inside a
 * `<footer>` landmark after the page content, so it never covers anything.
 * The boolean form is unchanged (precedent for the union: `moderation` in
 * `tables/comments.ts`).
 *
 * @example
 * ```typescript
 * // Default — badge shown (property omitted)
 * const app1 = { name: 'my-app' }
 *
 * // Explicitly shown
 * const app2 = { name: 'my-app', badge: true }
 *
 * // Removed — free, one line, forever
 * const app3 = { name: 'my-app', badge: false }
 *
 * // Shown, as a footer line instead of a floating pill
 * const app4 = { name: 'my-app', badge: { placement: 'footer' } }
 * ```
 */
const BadgePlacementSchema = Schema.Literals(['floating', 'footer']).pipe(
  Schema.annotate({
    title: 'Badge Placement',
    description:
      "Where the badge sits: 'floating' (the default) pins it to the bottom-right corner of the window, over the page; 'footer' renders it as a static line in a footer after the page content, so it never covers anything.",
    examples: ['floating', 'footer'],
  })
)

const BadgeOptionsSchema = Schema.Struct({
  placement: Schema.optional(BadgePlacementSchema),
}).pipe(
  Schema.annotate({
    title: 'Badge Options',
    description:
      'Shows the badge and chooses where it sits. An empty object behaves like true: the badge floats bottom-right.',
  })
)

export const BadgeSchema = Schema.Union([Schema.Boolean, BadgeOptionsSchema]).pipe(
  Schema.annotate({
    title: 'Built with Sovrium Badge',
    description:
      'Controls the "Built with Sovrium" badge shown on every page. Shown by default (omitted or true); set to false to remove it — removal is free forever, one config line, never license-gated. Use the object form, { placement }, to move it into a footer line instead of floating it bottom-right.',
    examples: [true, false, { placement: 'footer' }],
  })
)

/** @public */
export type Badge = typeof BadgeSchema.Type

/**
 * Single source of truth for the badge's positive polarity: the badge is
 * shown when the property is omitted (`undefined`) or `true`, and hidden
 * only with an explicit `badge: false`.
 *
 * Every rendering injection point (page, default home, standalone/closed
 * form documents, static error fallbacks) resolves visibility through this
 * predicate, so the object form `{ placement }` changes one function instead
 * of every call site: any object means shown.
 */
export const isBadgeEnabled = (badge: Badge | undefined): boolean => badge !== false
