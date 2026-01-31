/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Check if user can read a field (for sorting validation)
 */
export function canUserReadField(
  app: App,
  tableName: string,
  fieldName: string,
  userRole: string
): boolean {
  // Admin and owner have access to all fields
  if (userRole === 'admin' || userRole === 'owner') {
    return true
  }

  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields?.find((f) => f.name === fieldName)

  if (!field) {
    return false
  }

  // Member role: cannot read currency fields by default
  if (userRole === 'member') {
    const restrictedTypes = ['currency']
    return !restrictedTypes.includes(field.type)
  }

  // Viewer role: only name/title text fields
  if (userRole === 'viewer') {
    const allowedFieldTypes = ['single-line-text']
    const allowedFieldNames = ['name', 'title']
    return allowedFieldTypes.includes(field.type) && allowedFieldNames.includes(fieldName)
  }

  return true
}

/**
 * Validate sort parameter - check user has permission to sort by requested fields
 */
export function validateSortPermission(config: {
  readonly sort: string | undefined
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}) {
  const { sort, app, tableName, userRole, c } = config

  if (!sort) return undefined

  // Parse sort parameter (format: "field:dir" or "field1:dir1,field2:dir2")
  const sortFields = sort.split(',').map((s) => s.split(':')[0])

  // Check if user can read all sort fields
  const inaccessibleField = sortFields.find(
    (field) => !canUserReadField(app, tableName, field, userRole)
  )

  if (inaccessibleField) {
    return c.json(
      {
        success: false,
        message: `You do not have permission to perform this action. Cannot sort by field '${inaccessibleField}'`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  return undefined
}
