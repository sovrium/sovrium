/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  cookieNameForScope,
  validateActiveAssignment,
} from '@/domain/services/active-assignment-cookie'
import { resolveSidebarEntries, type ResolvedSidebarEntry } from '@/domain/services/sidebar-filter'
import { resolveFilters, hasCurrentUserRef } from './current-user-resolver'
import type { App } from '@/domain/models/app'
import type { SidebarItem } from '@/domain/models/app/pages/layout'
import type { SessionInfo } from '@/domain/types/session-info'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

export interface ResolvedSidebarSection {
  readonly entries: readonly ResolvedSidebarEntry[]
}

export const resolveSidebarSection = async (
  item: SidebarItem,
  app: App,
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
  }
): Promise<ResolvedSidebarSection | undefined> => {
  const { dataSource, template, activeIndicator } = item
  const filters = dataSource.filter ?? []

  const resolvedFilters = hasCurrentUserRef(filters)
    ? await resolveFilters(filters, {
        session: ctx.session,
        cookies: ctx.cookies,
        fetchAssignments: ctx.db.fetchUserAssignments,
        ...(app.auth?.scopeTables !== undefined ? { scopeTables: app.auth.scopeTables } : {}),
      })
    : { kind: 'ok' as const, filter: filters }

  if (resolvedFilters.kind === 'unauthorized') return undefined

  const records = await ctx.db.fetchRecords(dataSource.table, {
    filter: resolvedFilters.filter,
    sort: dataSource.sort,
  })

  const activeRecordId =
    activeIndicator === '$currentUser.activeAssignment' && ctx.session !== undefined
      ? await resolveActiveForScope(ctx, dataSource.table)
      : undefined

  const entries = resolveSidebarEntries(records, template, {
    ...(activeRecordId !== undefined ? { activeRecordId } : {}),
  })

  return { entries }
}

const resolveActiveForScope = async (
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
  },
  tableSlug: string
): Promise<string | undefined> => {
  const { session, cookies, db } = ctx
  if (!session) return undefined
  const cookieValue = cookies?.[cookieNameForScope(tableSlug)]
  if (!cookieValue) return undefined

  if (!db.fetchUserAssignments) return cookieValue

  const accessible = await db.fetchUserAssignments(session.userId, tableSlug)
  return validateActiveAssignment(cookieValue, accessible)
}

export const resolvePageSidebar = async (
  sidebar: readonly SidebarItem[] | undefined,
  app: App,
  ctx: {
    readonly session: SessionInfo | undefined
    readonly cookies: Readonly<Record<string, string>> | undefined
    readonly db: DataSourceDb
  }
): Promise<readonly ResolvedSidebarSection[] | undefined> => {
  if (!sidebar || sidebar.length === 0) return undefined
  const resolved = await Promise.all(sidebar.map((item) => resolveSidebarSection(item, app, ctx)))
  const sections = resolved.filter((s): s is ResolvedSidebarSection => s !== undefined)
  return sections.length > 0 ? sections : undefined
}
