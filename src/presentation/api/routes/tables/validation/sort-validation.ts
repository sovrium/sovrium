/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * System fields that exist in every table but are not in `app.tables[].fields`.
 *
 * Must stay in step with `SYSTEM_FIELDS` in
 * `application/use-cases/tables/utils/field-read-filter.ts`. This list used to
 * omit the three authorship columns and — worse — was declared but never
 * consulted, so a sort on any system column fell through to the
 * "not found in table.fields" branch below and was rejected. `?sort=created_by`
 * therefore returned 400 for every non-admin role.
 */
const SYSTEM_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
  'deleted_by',
  'deleted_at',
])

/**
 * Check if user can read a field (for sorting validation)
 */
export function canUserReadField(
  app: App,
  tableName: string,
  fieldName: string,
  userRole: string
): boolean {
  // The app's resolved TOP role is admin-EQUIVALENT and must behave like the
  // built-in `admin`. A literal `userRole === 'admin'` denied a custom top-tier
  // role (e.g. an `engineer` at the highest level) the sort access it already has
  // on the response-filter path — see the warning on `isAdminEquivalent` in
  // `domain/models/app/auth/roles`.
  if (isAdminEquivalent(userRole, app)) {
    return true
  }

  // System columns are readable by any role that can read the table at all. They
  // are not declared in `table.fields`, so they must be admitted before the
  // lookup below rejects them as unknown.
  if (SYSTEM_FIELDS.has(fieldName)) {
    return true
  }

  const table = app.tables?.find((t) => t.name === tableName)
  const field = table?.fields?.find((f) => f.name === fieldName)

  // Unknown field: still rejected. Deliberate — it keeps `?sort=<garbage>` from
  // reaching SQL generation.
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
  const sortFields = sort
    .split(',')
    .map((s) => s.split(':')[0])
    .filter((field): field is string => field !== undefined && field !== '')

  const table = app.tables?.find((t) => t.name === tableName)

  // First: check field existence (400 for non-existent fields)
  const nonExistentField = sortFields.find(
    (field) => !SYSTEM_FIELDS.has(field) && !table?.fields?.find((f) => f.name === field)
  )

  if (nonExistentField) {
    return c.json(
      {
        success: false,
        message: `Invalid sort field: '${nonExistentField}'`,
        code: 'VALIDATION_ERROR',
        errors: [{ field: 'sort', message: `Invalid sort field: '${nonExistentField}'` }],
      },
      400
    )
  }

  // S1 anti-enumeration: hide the field-permission boundary by returning 404.
  const inaccessibleField = sortFields.find(
    (field) => !canUserReadField(app, tableName, field, userRole)
  )

  if (inaccessibleField) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  return undefined
}
