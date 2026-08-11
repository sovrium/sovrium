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
 * heading (the Stripe-Dashboard "Developers" pattern). Both pages are
 * management surfaces (`/_admin/api`, `/_admin/mcp`) resolved by the surface
 * builder's `MANAGEMENT_BUILDERS`, NOT data-page keys, so they live in their own
 * nav list rather than the Data nav's `system` data section.
 *
 * Lives in `domain/utils` (importable by both the presentation sidebar island
 * and any application consumer) and is pure data — no React, no I/O.
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
 * The two Developers pages: the REST API reference and the MCP connection
 * guide. Order: API first (the broader integration surface), then MCP (the
 * AI-specific one).
 */
export const DEVELOPER_NAV_PAGES: ReadonlyArray<DeveloperNavPage> = [
  { key: 'api', label: 'API', href: '/_admin/api' },
  { key: 'mcp', label: 'MCP', href: '/_admin/mcp' },
]

/** The English heading shown above the Developers nav list. */
export const DEVELOPER_NAV_SECTION_LABEL = 'Developers'
