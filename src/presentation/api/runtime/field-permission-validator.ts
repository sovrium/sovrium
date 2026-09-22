/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app'
import { hasPermission } from '@/domain/models/app/auth/permissions'
import type { App } from '@/domain/models/app'

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
  if (!table) {
    return []
  }

  // Admin-equivalent roles (the app's resolved top role + the built-in `admin`
  // when it is not out-ranked) are unrestricted: they bypass field-level WRITE
  // permissions (a field marked `write: ['engineer']` restricts LOWER roles; the
  // engineer/admin owns every field). Uses the same canonical `isAdminEquivalent`
  // predicate as the create-path bypass in field-rules.ts and the read-side
  // (`filterReadableFields`) / row-level (`row-level-guard`) bypass — so a role
  // bypasses writes exactly when it bypasses reads and row-level access.
  if (isAdminEquivalent(userRole, app)) {
    return []
  }

  // Check each field being updated using functional approach
  const forbiddenFields = Object.keys(fields)
    .map((fieldName) => {
      // Check explicit field permissions first
      const fieldPermission = table.permissions?.fields?.find((fp) => fp.field === fieldName)
      if (fieldPermission?.write) {
        if (!hasPermission(fieldPermission.write, userRole)) {
          return fieldName
        }
        return undefined
      }

      // No explicit field permission configured — field is writable by all roles
      return undefined
    })
    .filter((field): field is string => field !== undefined)

  return forbiddenFields
}
