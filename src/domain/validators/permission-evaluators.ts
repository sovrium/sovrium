/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { checkPermissionWithAdminOverride, isAdminRole } from '@/domain/models/shared/permissions'
import type {
  TableFieldPermissions,
  TablePermissions,
} from '@/domain/models/app/tables/permissions'

export function evaluateTablePermissions(
  tablePermissions: TablePermissions | undefined,
  userRole: string,
  isAdmin: boolean
): Readonly<{ read: boolean; create: boolean; update: boolean; delete: boolean }> {
  return {
    read: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.read, userRole),
    create: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.create, userRole),
    update: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.update, userRole),
    delete: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.delete, userRole),
  }
}

export function evaluateFieldPermissions(
  fieldPerms: TableFieldPermissions | undefined,
  userRole: string,
  isAdmin: boolean
): Record<string, { read: boolean; write: boolean }> {
  const fields = fieldPerms ?? []
  return Object.fromEntries(
    fields.map((fieldPerm) => [
      fieldPerm.field,
      {
        read: checkPermissionWithAdminOverride(isAdmin, fieldPerm.read, userRole),
        write: checkPermissionWithAdminOverride(isAdmin, fieldPerm.write, userRole),
      },
    ])
  )
}

function getEffectivePermissions(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: unknown }>[] | undefined
): unknown {
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

function inheritanceFailed(
  table: Readonly<{ permissions?: Readonly<{ inherit?: string }> }> | undefined,
  allTables: readonly unknown[] | undefined,
  effectivePermissions: unknown
): boolean {
  return Boolean(allTables && table?.permissions?.inherit && !effectivePermissions)
}

function hasCircularInheritance(tableName: string, visited: ReadonlySet<string>): boolean {
  return visited.has(tableName)
}

function findParentTable(
  parentName: string | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): Readonly<{ name: string; permissions?: TablePermissions }> | undefined {
  if (!parentName) return undefined
  return allTables.find((t) => t.name === parentName)
}

function mergePermission<T>(
  overrideValue: T | undefined,
  currentValue: T | undefined,
  parentValue: T | undefined
): T | undefined {
  return overrideValue ?? currentValue ?? parentValue
}

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

export function hasCreatePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          create?: unknown
          inherit?: string
          override?: { create?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ create?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false
  if (userRole === 'viewer') return false

  const createPermission = effectivePerms?.create
  if (!createPermission || !Array.isArray(createPermission)) return true
  return createPermission.includes(userRole)
}

export function hasDeletePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          delete?: unknown
          inherit?: string
          override?: { delete?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ delete?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const deletePermission = effectivePerms?.delete

  if (userRole === 'viewer') {
    return Array.isArray(deletePermission) && deletePermission.includes(userRole)
  }

  if (!deletePermission || !Array.isArray(deletePermission)) return true
  return deletePermission.includes(userRole)
}

export function hasUpdatePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          update?: unknown
          inherit?: string
          override?: { update?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ update?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const updatePermission = effectivePerms?.update

  if (Array.isArray(updatePermission)) {
    return updatePermission.includes(userRole)
  }

  if (userRole === 'viewer') return false

  return true
}

export function hasReadPermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{ read?: unknown; inherit?: string; override?: { read?: unknown } }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ read?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const readPermission = effectivePerms?.read

  if (Array.isArray(readPermission)) {
    return readPermission.includes(userRole)
  }

  if (readPermission === 'all') return true
  if (readPermission === 'authenticated') return true

  if (userRole === 'viewer') return false

  return true
}

export function hasReadPermissionForRoles(
  table: Parameters<typeof hasReadPermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return effectiveRoles.some((role) => hasReadPermission(table, role, allTables))
}

export function hasCreatePermissionForRoles(
  table: Parameters<typeof hasCreatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return effectiveRoles.some((role) => hasCreatePermission(table, role, allTables))
}

export function hasUpdatePermissionForRoles(
  table: Parameters<typeof hasUpdatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return effectiveRoles.some((role) => hasUpdatePermission(table, role, allTables))
}

export function hasDeletePermissionForRoles(
  table: Parameters<typeof hasDeletePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return effectiveRoles.some((role) => hasDeletePermission(table, role, allTables))
}

export function resolveInheritedPermissions(
  table: Readonly<{ name: string; permissions?: TablePermissions }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  visited: ReadonlySet<string> = new Set()
): TablePermissions | undefined {
  if (!table?.permissions) return undefined

  const { permissions } = table

  if (!permissions.inherit) {
    return permissions
  }

  if (hasCircularInheritance(table.name, visited)) {
    return undefined
  }

  const parentTable = findParentTable(permissions.inherit, allTables)
  if (!parentTable) {
    return undefined
  }

  const parentPermissions = resolveInheritedPermissions(
    parentTable,
    allTables,
    new Set([...visited, table.name])
  )

  if (!parentPermissions) return permissions

  return mergePermissions(permissions, parentPermissions)
}
