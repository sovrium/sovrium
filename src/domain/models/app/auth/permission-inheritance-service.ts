/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How a table's grants resolve once `inherit` and `override` apply — the one
 * resolution every table evaluator ({@link resolveInheritedPermissions} and the
 * `permission-evaluator-service` built on it) and the no-auth rule
 * (`anonymous-grant-service`) judge a caller on.
 */

import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import type { TablePermissions } from '@/domain/models/app/tables/permissions'

/** The app's tables, as every evaluator below resolves `inherit` against them. */
export type TableList = readonly Readonly<{ name: string; permissions?: TablePermissions }>[]

/**
 * What a table-level evaluator is judged against: the app's tables alone, or
 * the app itself (its tables AND its role ladder).
 *
 * Passing the APP is what lets the admin override admit the app's top role:
 * the built-in `admin` and the role {@link resolveAdminRole} names are both
 * admin-equivalent (`isAdminEquivalent`), and only the app knows the second.
 * A bare table list keeps the historical reading — the built-in `admin` alone
 * outranks a grant — which is what a unit test asking about a table in
 * isolation means.
 */
export type TableGateScope = TableList | (AdminRoleResolvable & Readonly<{ tables?: TableList }>)

export const tablesOf = (scope: TableGateScope | undefined): TableList | undefined =>
  scope === undefined || Array.isArray(scope)
    ? (scope as TableList | undefined)
    : (scope as Readonly<{ tables?: TableList }>).tables

/**
 * Resolve effective permissions considering inheritance
 */
export function getEffectivePermissions(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  scope: TableGateScope | undefined
): unknown {
  const allTables = tablesOf(scope)
  if (!allTables || !table) return table?.permissions

  const tableWithInheritance = table as Readonly<{
    name: string
    permissions?: Readonly<{ inherit?: string }>
  }>

  if (!tableWithInheritance.permissions?.inherit) {
    return table.permissions
  }

  try {
    return resolveInheritedPermissions(
      table as Readonly<{ name: string; permissions?: TablePermissions }>,
      allTables as readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
    )
  } catch {
    return undefined
  }
}

/**
 * Check if inheritance resolution failed
 */
export function inheritanceFailed(
  table: Readonly<{ permissions?: Readonly<{ inherit?: string }> }> | undefined,
  scope: TableGateScope | undefined,
  effectivePermissions: unknown
): boolean {
  return Boolean(tablesOf(scope) && table?.permissions?.inherit && !effectivePermissions)
}

/**
 * Check if circular inheritance exists
 */
function hasCircularInheritance(tableName: string, visited: ReadonlySet<string>): boolean {
  return visited.has(tableName)
}

/**
 * Find parent table by name
 */
function findParentTable(
  parentName: string | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): Readonly<{ name: string; permissions?: TablePermissions }> | undefined {
  if (!parentName) return undefined
  return allTables.find((t) => t.name === parentName)
}

/**
 * Merge a single permission property with override support
 */
function mergePermission<T>(
  overrideValue: T | undefined,
  currentValue: T | undefined,
  parentValue: T | undefined
): T | undefined {
  return overrideValue ?? currentValue ?? parentValue
}

/**
 * Merge parent and current permissions with override support
 */
function mergePermissions(
  permissions: TablePermissions,
  parentPermissions: TablePermissions
): TablePermissions {
  const { override, read, comment, create, update, delete: deletePerms, fields } = permissions

  return {
    read: mergePermission(override?.read, read, parentPermissions.read),
    comment: mergePermission(override?.comment, comment, parentPermissions.comment),
    create: mergePermission(override?.create, create, parentPermissions.create),
    update: mergePermission(override?.update, update, parentPermissions.update),
    delete: mergePermission(override?.delete, deletePerms, parentPermissions.delete),
    fields: fields ?? parentPermissions.fields,
  }
}

/**
 * Resolve inherited permissions for a table
 *
 * Recursively resolves permissions by following the inheritance chain.
 * Handles circular inheritance detection and merges override permissions.
 *
 * @param table - The table to resolve permissions for
 * @param allTables - All tables in the app (for parent lookup)
 * @param visited - Set of visited table names (for circular detection)
 * @returns Resolved permissions or undefined if inheritance chain is invalid
 * @throws Error if circular inheritance detected or parent table not found
 */
export function resolveInheritedPermissions(
  table: Readonly<{ name: string; permissions?: TablePermissions }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  visited: ReadonlySet<string> = new Set()
): TablePermissions | undefined {
  if (!table?.permissions) return undefined

  const { permissions } = table

  // If no inheritance, return current permissions
  if (!permissions.inherit) {
    return permissions
  }

  // Circular inheritance detection
  if (hasCircularInheritance(table.name, visited)) {
    // Return undefined to indicate error (caught by callers)
    return undefined
  }

  // Find parent table
  const parentTable = findParentTable(permissions.inherit, allTables)
  if (!parentTable) {
    // Return undefined to indicate error (caught by callers)
    return undefined
  }

  // Recursively resolve parent permissions
  const parentPermissions = resolveInheritedPermissions(
    parentTable,
    allTables,
    new Set([...visited, table.name])
  )

  if (!parentPermissions) return permissions

  // Merge parent permissions with current permissions (current takes precedence)
  return mergePermissions(permissions, parentPermissions)
}
