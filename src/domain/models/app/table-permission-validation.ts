/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { extractGroupNames } from './auth/groups/group-reference'

const PERMISSION_OPS = [
  'read',
  'comment',
  'create',
  'update',
  'delete',
  'permanentDelete',
  'restore',
] as const

interface AppForTablePermissionValidation {
  readonly auth?: { readonly groups?: ReadonlyArray<{ readonly name: string }> }
  readonly tables?: ReadonlyArray<{ readonly name: string; readonly permissions?: unknown }>
}

interface PermissionRef {
  readonly location: string
  readonly value: unknown
}

function collectPermissionRefs(tableName: string, permissions: unknown): readonly PermissionRef[] {
  if (!permissions || typeof permissions !== 'object') return []
  const perms = permissions as Readonly<Record<string, unknown>>

  const tableLevel = PERMISSION_OPS.map((op) => ({
    location: `Table '${tableName}' permissions.${op}`,
    value: perms[op],
  }))

  const fields = Array.isArray(perms['fields'])
    ? (perms['fields'] as readonly unknown[]).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const fieldPerm = entry as Readonly<Record<string, unknown>>
        const fieldName = String(fieldPerm['field'] ?? '?')
        return [
          {
            location: `Table '${tableName}' permissions.fields '${fieldName}'.read`,
            value: fieldPerm['read'],
          },
          {
            location: `Table '${tableName}' permissions.fields '${fieldName}'.write`,
            value: fieldPerm['write'],
          },
        ]
      })
    : []

  return [...tableLevel, ...fields]
}

export const validateAllTablePermissionGroups = (
  app: AppForTablePermissionValidation
): string | true => {
  if (!app.tables) return true

  const definedGroups = new Set(app.auth?.groups?.map((group) => group.name) ?? [])

  const error = app.tables
    .flatMap((table) => collectPermissionRefs(table.name, table.permissions))
    .flatMap((ref) =>
      extractGroupNames(ref.value)
        .filter((groupName) => !definedGroups.has(groupName))
        .map(
          (groupName) =>
            `${ref.location} references undefined group 'group:${groupName}'. ` +
            `Declare it in auth.groups.`
        )
    )
    .at(0)

  return error ?? true
}
