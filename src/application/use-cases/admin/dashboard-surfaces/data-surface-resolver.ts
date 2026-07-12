/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { buildDataAgentsPage } from './data-agents-surface'
import { buildDataAutomationsPage } from './data-automations-surface'
import { buildDataBucketsPage } from './data-buckets-surface'
import { buildDataConnectionsPage } from './data-connections-surface'
import { buildDataFormsPage } from './data-forms-surface'
import {
  buildDataPagePlaceholder,
  readyDataPageLabel,
  type DataShellOptions,
} from './data-landing-surface'
import { buildDataPagesPage } from './data-pages-surface'
import { buildDataTablesPage } from './data-tables-surface'
import { buildDataUsersPage } from './data-users-surface'
import { buildOverviewPage } from './overview-surface'
import type { DataObjectRedirect } from './data-object-rail'
import type { DataRoute } from '../dashboard-surface-routes'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

export type DataSurface = Page | DataObjectRedirect

const DATA_PAGE_BUILDERS: Readonly<
  Record<string, (app: App, object: string | undefined, shell: DataShellOptions) => DataSurface>
> = {
  tables: buildDataTablesPage,
  automations: buildDataAutomationsPage,
  forms: buildDataFormsPage,
  buckets: buildDataBucketsPage,
  agents: buildDataAgentsPage,
  users: (app, _object, shell) => buildDataUsersPage(shell),
  pages: (app, _object, shell) => buildDataPagesPage(shell, app.analytics !== undefined),
  connections: (app, _object, shell) => buildDataConnectionsPage(shell),
}

export function resolveDataPage(
  operatorApp: App,
  route: DataRoute,
  canEdit: boolean,
  publishedSnapshotOf: (app: App) => Readonly<Record<string, unknown>>
): DataSurface | undefined {
  const shell: DataShellOptions = {
    canEdit,
    appName: operatorApp.name,
    appVersion: operatorApp.version,
    publishedSnapshot: publishedSnapshotOf(operatorApp),
  }
  if (route.page === undefined) return buildOverviewPage(shell)
  const label = readyDataPageLabel(route.page)
  if (label === undefined) return undefined
  const builder = DATA_PAGE_BUILDERS[route.page]
  if (builder) return builder(operatorApp, route.object, shell)
  return buildDataPagePlaceholder(route.page, label, shell)
}
