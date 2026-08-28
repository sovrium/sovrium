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
 * The five Developers pages: the two integration references (REST API, MCP)
 * followed by the three config-introspection surfaces — the App-schema explorer
 * and the declared-env viewer authorised by [internal ref] amendment A1, and the
 * design-system console authorised by amendment A2.
 *
 * Order: integration docs first — they are what a developer arrives for — then
 * introspection, which is what they reach for once something does not behave.
 *
 * The introspection group belongs HERE rather than in the Data nav because they
 * reflect CONFIG, not runtime data: the Data destinations answer "what rows
 * exist", these answer "what is this instance running".
 *
 * Within that group the order is schema → env → design system, which is the
 * order of increasing distance from the config file: what you WROTE, what this
 * box RESOLVED, and what the app actually RENDERS once everything it inherited
 * without declaring is folded in.
 */
export const DEVELOPER_NAV_PAGES: ReadonlyArray<DeveloperNavPage> = [
  { key: 'api', label: 'API', href: '/_admin/api' },
  { key: 'mcp', label: 'MCP', href: '/_admin/mcp' },
  { key: 'schema', label: 'Schema', href: '/_admin/schema' },
  { key: 'env', label: 'Environment', href: '/_admin/env' },
  { key: 'design-system', label: 'Design system', href: '/_admin/design-system' },
]

/** The English heading shown above the Developers nav list. */
export const DEVELOPER_NAV_SECTION_LABEL = 'Developers'
