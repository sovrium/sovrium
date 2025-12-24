/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * Check if user has permission to write to specific fields
 *
 * This implements Better Auth layer field permission validation.
 * Returns forbidden fields that the user cannot write to.
 *
 * @param app - Application configuration
 * @param tableName - Name of the table
 * @param userRole - User's role
 * @param fields - Fields being updated
 * @returns Array of field names user cannot write to (empty if all allowed)
 */
export function validateFieldWritePermissions(
  app: App,
  tableName: string,
  userRole: string,
  fields: Readonly<Record<string, unknown>>
): readonly string[] {
  // Find table definition
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.permissions?.fields) {
    return [] // No field permissions defined
  }

  // Check each field being updated using functional approach
  const forbiddenFields = Object.keys(fields)
    .map((fieldName) => {
      const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)
      if (!fieldPermission?.write) {
        return undefined // No write restriction on this field
      }

      if (!hasWritePermission(fieldPermission.write, userRole)) {
        return fieldName
      }

      return undefined
    })
    .filter((field): field is string => field !== undefined)

  return forbiddenFields
}

/**
 * Check if user's role has write permission
 */
function hasWritePermission(permission: TablePermission, userRole: string): boolean {
  switch (permission.type) {
    case 'public':
      return true

    case 'authenticated':
      return true // User is authenticated (has session)

    case 'roles':
      return permission.roles?.includes(userRole) ?? false

    case 'owner':
      // Owner check requires row-level context (handled by RLS)
      // At API layer, we can't determine ownership without fetching the record
      // So we allow it through here and let RLS enforce
      return true

    default:
      return false
  }
}
