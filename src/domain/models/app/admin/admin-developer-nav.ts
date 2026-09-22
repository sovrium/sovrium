/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure cross-layer taxonomy for the Native Admin Dashboard's **Developers**
 * sidebar section ([internal ref], Pass 2a item 2.3).
 *
 * Distinct from the Data nav (`admin-data-nav.ts`, the runtime-data
 * destinations), this section groups the auto-generated integration *docs* —
 * the REST API reference and the MCP connection guide — under one "Developers"
 * heading (the Stripe-Dashboard "Developers" pattern). Both pages are AUTHORED
 * preset surfaces (`/_admin/api`, `/_admin/mcp`) rather than data-page keys, so
 * they live in their own nav list rather than the Data nav's `system` section.
 * They were synthesised by the surface builder until [internal ref] published the facts
 * each was a function of; the nav taxonomy did not change with them.
 *
 * Lives in the `admin` slug — the feature it describes — and is pure data with
 * no React and no I/O, so both the presentation sidebar island and any
 * application consumer may import it.
 */

/** One Developers-section page: a navigable docs destination (icon-free contract). */
export interface DeveloperNavPage {
  /** Stable key — the `/_admin/{key}` route segment + the row testid suffix. */
  readonly key: string
  /** English sidebar label for the page row. */
  readonly label: string
  /** The dashboard sub-path the row links to. */
  readonly href: string
}

/**
 * The four Developers pages: the two integration references (REST API, MCP)
 * followed by the two config-introspection surfaces — the boot changelog,
 * whose `?view=current` is the configuration as booted, and the declared-env
 * viewer, authorised by [internal ref] amendment A1 and widened by amendment A6.
 *
 * Order: integration docs first — they are what a developer arrives for — then
 * introspection, which is what they reach for once something does not behave.
 *
 * The introspection pair belongs HERE rather than in the Data nav because they
 * reflect CONFIG, not runtime data: the Data destinations answer "what rows
 * exist", these answer "what is this instance running".
 *
 * The changelog row replaced a `schema` row pointing at `/_admin/schema`. That
 * route no longer exists: the configuration as booted is now one view of the
 * changelog rather than a page of its own.
 *
 * ─── WHY THE DESIGN-SYSTEM ROW IS NOT HERE ──────────────────────────────────
 *
 * It was, and it left for the Data nav's **System** group as `Design`. The rule
 * this section keeps is FLATNESS: every row here is one page a developer opens
 * and reads. The design-system console stopped being one page and became a
 * seven-page workspace, and a flat list is the wrong shape for a workspace —
 * a reader would reach one of its seven destinations and have no way back to
 * the other six except the page they happened to land on.
 *
 * Do not re-add it "for discoverability". Two rows to one destination is how a
 * nav starts lying about where a thing lives, and
 * `[internal ref]` asserts the absence for exactly that reason.
 */
export const DEVELOPER_NAV_PAGES: ReadonlyArray<DeveloperNavPage> = [
  { key: 'api', label: 'API', href: '/_admin/api' },
  { key: 'mcp', label: 'MCP', href: '/_admin/mcp' },
  { key: 'changelog', label: 'Changelog', href: '/_admin/changelog' },
  { key: 'env', label: 'Environment', href: '/_admin/env' },
]

/** The English heading shown above the Developers nav list. */
export const DEVELOPER_NAV_SECTION_LABEL = 'Developers'
