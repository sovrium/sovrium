/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Data-tab surface resolution.
 *
 * Extracted from `dashboard-surface-builder.ts` so that file stays under its
 * per-file `max-lines` cap as the Data-tab page set grows. Resolves a parsed
 * Data-tab route (`/data[/:page[/:object]]`) to its synthesized page: the
 * workspace overview, a full-width object-scoped surface, a first-object 302
 * redirect (Pass 1 item 1.5a), or the "coming next" placeholder. The builder
 * calls {@link resolveDataPage} and otherwise stays agnostic of the catalog.
 */

import { buildDataAgentsPage } from './data-agents-surface'
import { buildDataAutomationsPage } from './data-automations-surface'
import { buildDataBucketsPage } from './data-buckets-surface'
import { buildDataConnectionsPage } from './data-connections-surface'
import { buildDataFormsPage } from './data-forms-surface'
import {
  buildDataPagePlaceholder,
  readyDataPageLabel,
  type ConsoleRequest,
  type DataShellOptions,
} from './data-landing-surface'
import { buildDataLinksPage } from './data-links-surface'
import { buildDataPagesPage } from './data-pages-surface'
import { buildDataTablesPage } from './data-tables-surface'
import { buildDataUsersPage } from './data-users-surface'
import { buildFootprintPage } from './footprint-surface'
import { buildOverviewPage } from './overview-surface'
import type { DataObjectRedirect } from './data-object-rail'
import type { DataRoute } from '../dashboard-surface-routes'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/**
 * A resolved Data surface: either a synthesized `Page`, or a {@link DataObjectRedirect}
 * (a bare object-page path with ≥1 object → 302 to the first object, Pass 1 item
 * 1.5a). The builder propagates either through to the route handler.
 */
export type DataSurface = Page | DataObjectRedirect

/**
 * The Data pages with a built surface, keyed by their `/data/{page}` segment. The
 * object-scoped pages (`tables` / `forms` / `buckets` / `agents`) mount the
 * selected object's runtime-data island FULL-WIDTH and 302-redirect a bare path
 * to their first object (Pass 1 items 1.5a + 1.5c); the flat directories
 * (`users` / `pages` / `connections`) ignore the object segment and render a
 * single island. Ready destinations not in this map fall back to the "coming
 * next" placeholder.
 */
const DATA_PAGE_BUILDERS: Readonly<
  Record<
    string,
    (
      app: App,
      object: string | undefined,
      shell: DataShellOptions,
      // The per-request analytics window (`?period=`), forwarded only to the
      // analytics-shaped surfaces that derive their reads from it. Every other
      // builder ignores it, which is why it is a plain optional argument rather
      // than a field on the shell: a surface with no window must not be able to
      // read one by accident.
      period?: string
    ) => DataSurface
  >
> = {
  tables: buildDataTablesPage,
  automations: buildDataAutomationsPage,
  forms: buildDataFormsPage,
  buckets: buildDataBucketsPage,
  agents: buildDataAgentsPage,
  // The Users directory is flat (one user population, not many objects), so
  // it ignores the per-page object segment and mounts a single directory island.
  users: (app, _object, shell) => buildDataUsersPage(shell, app),
  // Analytics is an app-wide analytics dashboard (not per-object), so it too
  // ignores the object segment. Threads whether the operator declared an
  // `analytics` block: enabled → live KPI/chart/table over the baked window;
  // absent → the static "Analytics not enabled" region.
  pages: (app, _object, shell) => buildDataPagesPage(shell, app.analytics !== undefined),
  // Connections is a flat directory over the bounded set of external connections
  // (not many objects to pick), so it ignores the object segment and mounts a
  // single directory island fed by GET /api/admin/connections.
  connections: (app, _object, shell) => buildDataConnectionsPage(shell),
  // Footprint describes the INSTANCE rather than any object in it — there is
  // nothing to pick — so it ignores the object segment and renders one page.
  footprint: (app, _object, shell) => buildFootprintPage(shell),
  // Links is a FLAT directory — deliberately no first-object redirect. Records,
  // Submissions and Files redirect a bare path to their first object because
  // their object list is config-bounded and the sidebar enumerates it; the links
  // population is unbounded and database-backed, so there is no meaningful
  // "first link" and the operator's first question is cross-link anyway. The
  // object segment, when present, opens that one link's deep-dive.
  links: buildDataLinksPage,
}

/**
 * Resolve a Data-tab path (`/data[/:page[/:object]]`) to its surface, or
 * `undefined` when the path is not a Data-tab route OR the requested page is not
 * a backend-ready destination. The bare root opens the "Dashboard"
 * overview; an object-scoped page ({@link DATA_PAGE_BUILDERS}) opens the selected
 * object's full-width surface (or a {@link DataObjectRedirect} to its first object
 * on a bare path — Pass 1 item 1.5a); remaining ready pages open the "coming next"
 * placeholder. A gap / unknown page returns `undefined` so the route falls through
 * to the dashboard not-found rather than rendering an empty page.
 */
export function resolveDataPage(
  operatorApp: App,
  route: DataRoute,
  request: ConsoleRequest
): DataSurface | undefined {
  const shell: DataShellOptions = {
    ...request,
    appName: operatorApp.name,
    appVersion: operatorApp.version,
  }
  // [internal ref] reclaimed the root for the cross-domain KPI overview: the bare
  // `/_admin` (page undefined) IS the "Dashboard" overview, NOT the retired
  // Data card-grid landing (the flat Data-nav sidebar is the full navigation).
  if (route.page === undefined) return buildOverviewPage(shell)
  const label = readyDataPageLabel(route.page)
  if (label === undefined) return undefined
  const builder = DATA_PAGE_BUILDERS[route.page]
  if (builder) return builder(operatorApp, route.object, shell, request.period)
  return buildDataPagePlaceholder(route.page, label, shell)
}
