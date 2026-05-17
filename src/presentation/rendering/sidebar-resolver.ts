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

/**
 * Resolved per-section sidebar output — what `DynamicPage` renders inside
 * the page `<aside>`. One entry per matching record, with archived
 * records dropped and the active assignment (if any) marked.
 */
export interface ResolvedSidebarSection {
  readonly entries: readonly ResolvedSidebarEntry[]
}

/**
 * Resolves a single sidebar item:
 *   1. Substitute `$currentUser.*` filter values (assignment-scoped reads,
 *      unrestricted bypass for global admins).
 *   2. Fetch records from the database.
 *   3. If `activeIndicator: '$currentUser.activeAssignment'` is set,
 *      resolve the active assignment for the table's scope.
 *   4. Hand the records + active id off to the pure
 *      `resolveSidebarEntries` resolver.
 *
 * Returns `undefined` when the user is unauthenticated and the filter
 * contains a `$currentUser` reference — the caller decides whether to
 * 401, swallow, or skip the section. (Sidebar lives behind an
 * `authenticated` page guard, so this branch is mostly defense-in-depth.)
 */
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

  // Resolve $currentUser.* references in filters (Z-1 / P-6).
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

  // Resolve the active assignment for this section's scope-table if the
  // sidebar opted in. Only `$currentUser.activeAssignment` is supported
  // today — the schema literal makes that explicit.
  const activeRecordId =
    activeIndicator === '$currentUser.activeAssignment' && ctx.session !== undefined
      ? await resolveActiveForScope(ctx, dataSource.table)
      : undefined

  const entries = resolveSidebarEntries(records, template, {
    ...(activeRecordId !== undefined ? { activeRecordId } : {}),
  })

  return { entries }
}

/**
 * Resolve the active-assignment recordId for a single scope. Reuses the
 * canonical cookie-name builder + validation predicate from
 * `domain/services/active-assignment-cookie.ts` so this and the SSR
 * `$currentUser.activeAssignment` resolver cannot drift.
 *
 * Unlike the `$currentUser` resolver, the sidebar variant does NOT
 * fall back to the first accessible record on tamper/absence — the
 * sidebar only marks an `<a>` with `data-active="true"`, and "no active
 * mark" is the correct UI for an absent or tampered cookie. The
 * `$currentUser` resolver needs the fallback because filter equality
 * against `''` would render zero rows; here we are not filtering.
 *
 * When `fetchUserAssignments` is unavailable, the cookie value is
 * trusted verbatim — matches the legacy fallback in
 * `current-user-resolver.ts` for callers without DI of user_access.
 */
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

  // Without the `user_access` reader, trust the cookie verbatim
  // (matches current-user-resolver.ts:204-207 legacy fallback).
  if (!db.fetchUserAssignments) return cookieValue

  // Validate against user_access — discard tampered cookies.
  const accessible = await db.fetchUserAssignments(session.userId, tableSlug)
  return validateActiveAssignment(cookieValue, accessible)
}

/**
 * Resolve every sidebar item declared on a page's `layout.sidebar`.
 * Sections that fail to resolve (unauthorized) are dropped. Returns
 * `undefined` when the page declares no sidebar — keeps the render path
 * a no-op for pages that don't opt in.
 */
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
