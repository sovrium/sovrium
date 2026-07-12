/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseDataRoute } from './dashboard-surface-routes'
import { buildApiDocsPage } from './dashboard-surfaces/api-docs-surface'
import {
  isDataObjectRedirect,
  type DataObjectRedirect,
} from './dashboard-surfaces/data-object-rail'
import { resolveDataPage, type DataSurface } from './dashboard-surfaces/data-surface-resolver'
import { recordGridTablesFor } from './dashboard-surfaces/data-tables-surface'
import { buildGdprPage } from './dashboard-surfaces/gdpr-surface'
import { buildMcpDocsPage } from './dashboard-surfaces/mcp-docs-surface'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

export type DashboardSurfaceResult = App | DataObjectRedirect | undefined

function publishedSnapshotOf(operatorApp: App): Readonly<Record<string, unknown>> {
  return operatorApp as unknown as Readonly<Record<string, unknown>>
}

type ManagementShell = {
  readonly canEdit: boolean
  readonly appName?: string
  readonly appVersion?: string
  readonly publishedSnapshot: Readonly<Record<string, unknown>>
}

const MANAGEMENT_BUILDERS: Readonly<
  Record<string, (shell: ManagementShell, operatorApp: App) => Page>
> = {
  '/api': (shell, app) => buildApiDocsPage('Sovrium — API', app, shell),
  '/mcp': (shell, app) => buildMcpDocsPage('Sovrium — MCP', app, shell),
  '/connect-ai': (shell, app) => buildMcpDocsPage('Sovrium — MCP', app, shell),
  '/gdpr': (shell) => buildGdprPage('Sovrium — Mon compte', shell),
}

function resolveSurfacePage(
  operatorApp: App,
  dashboardPath: string,
  canEdit: boolean
): DataSurface | undefined {
  const dataRoute = parseDataRoute(dashboardPath)
  if (dataRoute !== undefined) {
    const dataSurface = resolveDataPage(operatorApp, dataRoute, canEdit, publishedSnapshotOf)
    if (dataSurface !== undefined) return dataSurface
  }

  const managementBuilder = MANAGEMENT_BUILDERS[dashboardPath]
  if (managementBuilder) {
    return managementBuilder(
      {
        canEdit,
        appName: operatorApp.name,
        appVersion: operatorApp.version,
        publishedSnapshot: publishedSnapshotOf(operatorApp),
      },
      operatorApp
    )
  }

  return undefined
}

export async function buildDashboardSurfaceApp(
  dashboardApp: App,
  operatorApp: App,
  dashboardPath: string,
  canEdit: boolean
): Promise<DashboardSurfaceResult> {
  const surface = resolveSurfacePage(operatorApp, dashboardPath, canEdit)
  if (surface === undefined) return undefined
  if (isDataObjectRedirect(surface)) return surface
  const page: Page = surface

  const basePages = (dashboardApp.pages ?? []).filter((p) => p.path !== page.path)

  const operatorTables = recordGridTablesFor(operatorApp, dashboardPath)

  return {
    ...dashboardApp,
    palette: { enabled: false },
    tables: [...(dashboardApp.tables ?? []), ...operatorTables],
    pages: [...basePages, page],
  } as App
}
