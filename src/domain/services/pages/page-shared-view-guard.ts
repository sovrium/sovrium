/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { findMatchingRoute } from '@/domain/utils/matching/route-matcher'
import { hasReadPermissionForRoles } from '@/domain/validators/permission-evaluators'
import type { App, Page, Table } from '@/domain/models/app'

export function isSharedViewAccessDenied(
  app: App,
  path: string,
  query: string,
  session: { readonly role: string; readonly effectiveRoles?: readonly string[] } | undefined
): boolean {
  if (!hasUserViewParam(query)) return false
  const matchedPage = findPageForPath(app, path)
  if (!matchedPage) return false
  const tableNames = collectDataTableTableNames(matchedPage)
  if (tableNames.length === 0) return false
  const effectiveRoles = resolveEffectiveRoles(session)
  return tableNames.some((tableName) => {
    const table = findTable(app, tableName)
    if (!table) return false
    return !hasReadPermissionForRoles(table, effectiveRoles, app.tables)
  })
}

function resolveEffectiveRoles(
  session: { readonly role: string; readonly effectiveRoles?: readonly string[] } | undefined
): readonly string[] {
  if (session?.effectiveRoles && session.effectiveRoles.length > 0) {
    return session.effectiveRoles
  }
  return [session?.role ?? 'viewer']
}

function findTable(app: App, name: string): Table | undefined {
  return (app.tables ?? []).find((t) => t.name === name)
}

function findPageForPath(app: App, path: string): Page | undefined {
  if (!app.pages || app.pages.length === 0) return undefined
  const patterns = app.pages.map((p) => p.path)
  const match = findMatchingRoute(patterns, path)
  if (!match) return undefined
  return app.pages[match.index]
}

function hasUserViewParam(query: string): boolean {
  if (query === '') return false
  const params = new URLSearchParams(query)
  const param = params.get('userView')
  return param !== null && param !== ''
}

function collectDataTableTableNames(page: Page): readonly string[] {
  const components = page.components ?? []
  const names = components.flatMap((item) => extractTableName(item))
  return Array.from(new Set(names))
}

function extractTableName(item: unknown): readonly string[] {
  if (!isComponentRecord(item)) return []
  if (item['type'] !== 'data-table') return []
  const { dataSource } = item
  if (!isComponentRecord(dataSource)) return []
  const { table } = dataSource
  return typeof table === 'string' && table !== '' ? [table] : []
}

function isComponentRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object'
}
