/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { getBadgeLabel } from './badge-labels'
import type { BadgePlacement } from './badge-placement'

/** The pill's look, shared by both placements; only the positioning differs. */
const PILL_CLASSES =
  'border-border bg-background-raised text-foreground-muted hover:text-foreground rounded-full border px-3 py-1.5 text-sm font-medium no-underline shadow-sm transition-colors'

/**
 * The "Built with Sovrium" badge — a small static link pill shown on every
 * page of a Sovrium-generated app, in one of two placements.
 *
 * Design contract (settled — do not relitigate):
 * - Pure SSR: a single `<a>` element, no island, no client JS, no hydration.
 * - Zero telemetry: static dofollow link to `https://sovrium.com?ref=badge`
 *   with `rel="noopener"` — no beacon, no pixel, no image request.
 * - `placement: 'floating'` (the default) pins it bottom-right, `z-40` (below
 *   the `z-50` dialogs/skip-link layer). `placement: 'footer'` wraps it in a
 *   `<footer>` landmark rendered after `<main>`, in the document flow, so it
 *   never covers the page's last row (a submit button, a pager).
 * - Hidden in print (`print:hidden`) in both placements.
 * - Contrast-safe in both light and dark themes via the neutral design-token
 *   scale (same platform-chrome approach as the skip link in DynamicPage).
 * - Label follows the page's active locale (en/fr, English fallback) via
 *   {@link getBadgeLabel}; the text is platform chrome, not app content.
 *
 * Rendered only when `resolveBadge(app.badge)` yields a placement (it reads the
 * shared positive-polarity predicate `isBadgeEnabled`) and never on the
 * `/_admin` operator console.
 */
export function SovriumBadge({
  lang,
  placement = 'floating',
}: {
  /** The page's active locale (e.g. `'en'`, `'fr'`); English fallback when undefined. */
  readonly lang?: string
  /** Floating pill (default) or a static line in a footer after the content. */
  readonly placement?: BadgePlacement
}): Readonly<ReactElement> {
  const isFooter = placement === 'footer'
  const link = (
    <a
      href="https://sovrium.com?ref=badge"
      target="_blank"
      rel="noopener"
      data-testid="sovrium-badge"
      /* Role tokens carry their own dark cascade, so the six hand-written
         `dark:` variants this replaced were duplicating the token system. */
      className={
        isFooter
          ? `${PILL_CLASSES} inline-block`
          : `${PILL_CLASSES} fixed right-3 bottom-3 z-40 print:hidden`
      }
    >
      {getBadgeLabel(lang)}
    </a>
  )
  if (!isFooter) return link
  return <footer className="flex justify-center px-4 py-6 print:hidden">{link}</footer>
}
