/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

type AggregateParams = {
  readonly count?: boolean
  readonly sum?: readonly string[]
  readonly avg?: readonly string[]
  readonly min?: readonly string[]
  readonly max?: readonly string[]
}

type FilterStructure =
  | {
      readonly and?: readonly {
        readonly field: string
        readonly operator: string
        readonly value: unknown
      }[]
    }
  | undefined

/**
 * Check if field is sensitive type (email, phone, currency)
 */
function isSensitiveFieldType(fieldType: string): boolean {
  const sensitiveTypes = new Set(['email', 'phone-number', 'currency'])
  return sensitiveTypes.has(fieldType)
}

/**
 * Check if field should be excluded for viewer role
 */
function shouldExcludeForViewer(fieldName: string, fieldType: string): boolean {
  const allowedFieldTypes = new Set(['single-line-text'])
  const allowedFieldNames = new Set(['name', 'title'])

  // Exclude sensitive field types
  if (isSensitiveFieldType(fieldType)) {
    return true
  }

  // Only allow specific field names or types
  if (!allowedFieldNames.has(fieldName) && !allowedFieldTypes.has(fieldType)) {
    return true
  }

  // For single-line-text, only allow if it's a name/title field
  if (fieldType === 'single-line-text' && !allowedFieldNames.has(fieldName)) {
    return true
  }

  return false
}

/**
 * Check if field should be excluded based on default permission rules
 * Matches logic from field-read-filter.ts
 */
export function shouldExcludeFieldByDefault(
  fieldName: string,
  userRole: string,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined
): boolean {
  // Admin role has full access
  if (userRole === 'admin') {
    return false
  }

  // Find field definition
  const field = table?.fields.find((f) => f.name === fieldName)
  if (!field) return false

  // Viewer role: most restrictive access
  if (userRole === 'viewer') {
    return shouldExcludeForViewer(fieldName, field.type)
  }

  // Member role: restrict sensitive financial data
  if (userRole === 'member') {
    return fieldName === 'salary' && field.type === 'currency'
  }

  return false
}

/**
 * Validate filter parameter - ensure user has permission to read filter fields
 */
export function validateFilterParam(
  filter: FilterStructure,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined,
  userRole: string,
  c: Context
) {
  if (!filter) return undefined

  // Extract field names from filter structure
  const filterFields = filter.and?.map((condition) => condition.field) ?? []

  // Check if user has permission to read each filter field using find instead of for loop
  const inaccessibleField = filterFields.find((fieldName) =>
    shouldExcludeFieldByDefault(fieldName, userRole, table)
  )

  if (inaccessibleField) {
    return c.json(
      {
        success: false,
        message: `You do not have permission to perform this action. Cannot filter by field '${inaccessibleField}'`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  return undefined
}

/**
 * Validate aggregate parameter - ensure user has permission to read aggregated fields
 */
export function validateAggregateParam(
  aggregate: AggregateParams | undefined,
  table:
    | { readonly fields: readonly { readonly name: string; readonly type: string }[] }
    | undefined,
  userRole: string,
  c: Context
) {
  if (!aggregate) return undefined

  // Extract all field names from aggregate operations
  const aggregateFields = [
    ...(aggregate.sum ?? []),
    ...(aggregate.avg ?? []),
    ...(aggregate.min ?? []),
    ...(aggregate.max ?? []),
  ]

  // Check if user has permission to read each aggregated field using find instead of for loop
  const inaccessibleField = aggregateFields.find((fieldName) =>
    shouldExcludeFieldByDefault(fieldName, userRole, table)
  )

  if (inaccessibleField) {
    return c.json(
      {
        success: false,
        message: `You do not have permission to perform this action. Cannot aggregate field '${inaccessibleField}'`,
        code: 'FORBIDDEN',
      },
      403
    )
  }

  return undefined
}
