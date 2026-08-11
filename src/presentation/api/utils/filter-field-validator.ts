/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
} from '@/domain/models/shared/permission-evaluation'
import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/tables/permissions'

/**
 * Filter condition with field reference
 */
interface FilterCondition {
  readonly field: string
  readonly operator: string
  readonly value: unknown
}

/**
 * Filter structure supporting AND/OR logic
 */
interface Filter {
  readonly and?: readonly FilterCondition[]
  readonly or?: readonly FilterCondition[]
}

/**
 * Validate that user has permission to filter by specified fields
 *
 * This prevents users from querying data based on fields they cannot read.
 * Returns array of field names user cannot filter by.
 *
 * @param app - Application configuration
 * @param tableName - Name of the table
 * @param userRole - User's role
 * @param filter - Filter object to validate
 * @returns Array of field names user cannot filter by (empty if all allowed)
 */
export function validateFilterFieldPermissions(
  app: App,
  tableName: string,
  userRole: string,
  filter: Filter
): readonly string[] {
  // Find table definition
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.permissions?.fields) {
    return [] // No field permissions defined
  }

  // Extract all field names from filter conditions using immutable patterns
  const andFields = filter.and ? filter.and.map((condition) => condition.field) : []
  const orFields = filter.or ? filter.or.map((condition) => condition.field) : []
  const fieldNames = [...andFields, ...orFields]

  // Check each field used in filter
  const forbiddenFields = fieldNames
    .map((fieldName) => {
      const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)
      return canFilterOnField(fieldPermission?.read, userRole) ? undefined : fieldName
    })
    .filter((field): field is string => field !== undefined)

  return forbiddenFields
}

/**
 * Whether the role may FILTER on a field carrying this `read` restriction.
 *
 * An undeclared restriction restricts nothing, so the field stays filterable.
 * Admin override: an admin outranks a field allowlist on every other read
 * path, so a field an admin can READ is also a field an admin can FILTER on.
 */
function canFilterOnField(permission: TablePermission | undefined, userRole: string): boolean {
  return permits(
    evaluatePermission(
      permission,
      { role: userRole },
      {
        whenUndeclared: OPEN_WHEN_UNDECLARED,
        adminOverride: 'admin-outranks-everything',
      }
    )
  )
}
