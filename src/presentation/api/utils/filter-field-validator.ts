/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/tables/permissions'

interface FilterCondition {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

interface Filter {
  readonly and?: readonly FilterCondition[]
  readonly or?: readonly FilterCondition[]
}

export function validateFilterFieldPermissions(
  app: App,
  tableName: string,
  userRole: string,
  filter: Filter
): readonly string[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.permissions?.fields) {
    return []
  }

  const andFields = filter.and ? filter.and.map((condition) => condition.field) : []
  const orFields = filter.or ? filter.or.map((condition) => condition.field) : []
  const fieldNames = [...andFields, ...orFields]

  const forbiddenFields = fieldNames
    .map((fieldName) => {
      const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)
      if (!fieldPermission?.read) {
        return undefined
      }

      if (!hasReadPermission(fieldPermission.read, userRole)) {
        return fieldName
      }

      return undefined
    })
    .filter((field): field is string => field !== undefined)

  return forbiddenFields
}

function hasReadPermission(permission: TablePermission, userRole: string): boolean {
  if (permission === 'all') {
    return true
  }
  if (permission === 'authenticated') {
    return true
  }
  if (Array.isArray(permission)) {
    return permission.includes(userRole)
  }
  return false
}
