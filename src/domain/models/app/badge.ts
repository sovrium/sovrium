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
 * A future `badge: boolean | { position }` union is the documented escape
 * hatch (precedent: `moderation` in `tables/comments.ts`); v1 is boolean-only.
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
 * ```
 */
export const BadgeSchema = Schema.Boolean.pipe(
  Schema.annotations({
    title: 'Built with Sovrium Badge',
    description:
      'Controls the "Built with Sovrium" badge rendered bottom-right on all pages. Shown by default (omitted or true); set to false to remove it — removal is free forever, one config line, never license-gated.',
    examples: [true, false],
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
 * predicate so the documented future `boolean | { position }` union changes
 * one function instead of every call site.
 */
export const isBadgeEnabled = (badge: Badge | undefined): boolean => badge !== false
