/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getBadgeLabel } from './badge-labels'

/**
 * The "Built with Sovrium" badge — a small static link pill rendered
 * bottom-right by default on every page of a Sovrium-generated app.
 *
 * Design contract (settled — do not relitigate):
 * - Pure SSR: a single `<a>` element, no island, no client JS, no hydration.
 * - Zero telemetry: static dofollow link to `https://sovrium.com?ref=badge`
 *   with `rel="noopener"` — no beacon, no pixel, no image request.
 * - Fixed bottom-right, `z-40` (below the `z-50` dialogs/skip-link layer),
 *   hidden in print (`print:hidden`).
 * - Contrast-safe in both light and dark themes via the neutral design-token
 *   scale (same platform-chrome approach as the skip link in DynamicPage).
 * - Label follows the page's active locale (en/fr, English fallback) via
 *   {@link getBadgeLabel}; the text is platform chrome, not app content.
 *
 * Rendered only when `isBadgeEnabled(app.badge)` (the shared positive-polarity
 * predicate in `@/domain/models/app/badge`) and never on the `/_admin`
 * operator console.
 */
export function SovriumBadge({
  lang,
}: {
  /** The page's active locale (e.g. `'en'`, `'fr'`); English fallback when undefined. */
  readonly lang?: string
}): Readonly<ReactElement> {
  return (
    <a
      href="https://sovrium.com?ref=badge"
      target="_blank"
      rel="noopener"
      data-testid="sovrium-badge"
      /* Role tokens carry their own dark cascade, so the six hand-written
         `dark:` variants this replaced were duplicating the token system. */
      className="border-border bg-background-raised text-foreground-muted hover:text-foreground fixed right-3 bottom-3 z-40 rounded-full border px-3 py-1.5 text-sm font-medium no-underline shadow-sm transition-colors print:hidden"
    >
      {getBadgeLabel(lang)}
    </a>
  )
}
