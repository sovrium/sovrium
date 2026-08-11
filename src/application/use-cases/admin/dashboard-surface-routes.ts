/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure `/_admin`-stripped dashboard sub-path parsers for
 * {@link ../dashboard-surface-builder}. Each `parse*` function recognises a
 * Data-console route shape and returns its parsed descriptor (or `undefined`
 * when the path is not that shape). Extracted into a sibling module to keep the
 * surface-builder under the per-file `max-lines` cap; they are pure (string →
 * descriptor) with only a domain-util dependency (the data-page key set).
 *
 * [internal ref] retired the `/data` URL segment (no back-compat): the Data destinations
 * now live at TOP-LEVEL `/_admin/{key}[/{object}]` and the workspace landing at
 * the bare `/_admin`. A path is a Data route only when its first segment is a
 * known data-page key (`tables` / `forms` / `buckets` / `automations` / `agents`
 * / `users` / `connections` / `pages`) — so the management surfaces (`/gdpr`,
 * `/mcp`) are NOT swallowed by the Data parser.
 */

import { DATA_NAV_PAGES } from '@/domain/utils/admin-data-nav'

/** The set of known top-level Data-page keys (the first route segment of a data surface). */
const DATA_PAGE_KEYS: ReadonlySet<string> = new Set(DATA_NAV_PAGES.map((page) => page.key))

/**
 * A parsed top-level Data dashboard sub-path — the operator-data workspace
 *. `page` is undefined for the bare `/_admin`
 * landing; otherwise it is the requested destination key (`tables`, `forms`,
 * `buckets`, `automations`, `agents`, `users`, `connections`, `pages`). `object`
 * is the optional per-page selection (a table / form / automation name): a Data
 * page opens on a picker when `object` is undefined and on the selected object's
 * runtime-data surface when present (e.g. `/tables/contacts` = the contacts grid).
 */
export type DataRoute = { readonly page?: string; readonly object?: string }

/**
 * Parse a top-level Data dashboard sub-path, or `undefined` when it is not one.
 * [internal ref] retired the `/data` segment (no back-compat): the landing is the bare
 * root and each destination is `/{key}`. A non-root path is a Data route ONLY
 * when its first segment is a known data-page key — otherwise (e.g. `/gdpr`,
 * `/mcp`) it falls through to the management surfaces.
 *
 *  - `/` or ``               → { } (the workspace landing, was `/data`)
 *  - `/tables`               → { page: 'tables' } (the table picker)
 *  - `/tables/contacts`      → { page: 'tables', object: 'contacts' } (the grid)
 *  - `/forms/contact`        → { page: 'forms', object: 'contact' }
 *  - `/gdpr`                 → undefined (a management surface, not Data)
 */
export function parseDataRoute(dashboardPath: string): DataRoute | undefined {
  const segments = dashboardPath.split('/').filter((segment) => segment.length > 0)
  if (segments.length === 0) return {}
  const page = segments[0]
  if (!page || !DATA_PAGE_KEYS.has(page)) return undefined
  if (segments.length === 1) return { page }
  if (segments.length === 2 && segments[1]) return { page, object: segments[1] }
  return undefined
}
