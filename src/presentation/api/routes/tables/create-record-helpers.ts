/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/**
 * Validate required fields for record creation
 * Returns error response if required fields are missing, undefined otherwise
 */
export function validateRequiredFields(
  table:
    | {
        readonly name: string
        readonly fields: ReadonlyArray<{
          readonly name: string
          readonly required?: boolean
        }>
        readonly primaryKey?: {
          readonly type: string
          readonly fields?: ReadonlyArray<string>
          readonly field?: string
        }
      }
    | undefined,
  fields: Record<string, unknown>,
  c: Context
) {
  if (!table) return undefined

  // Get primary key field names to exclude from validation
  const primaryKeyFields = new Set(
    table.primaryKey?.fields ?? (table.primaryKey?.field ? [table.primaryKey.field] : [])
  )

  // Auto-injected fields that should be excluded from required field validation
  const autoInjectedFields = new Set(['owner_id'])

  const missingRequiredFields = table.fields
    .filter(
      (field) =>
        field.required &&
        !(field.name in fields) &&
        !primaryKeyFields.has(field.name) && // Skip primary key fields
        !autoInjectedFields.has(field.name) // Skip auto-injected fields
    )
    .map((field) => field.name)

  if (missingRequiredFields.length > 0) {
    return c.json(
      { success: false, message: 'Missing required fields', code: 'VALIDATION_ERROR' },
      400
    )
  }

  return undefined
}

/**
 * Check if user is trying to set readonly 'id' field
 */
export function checkReadonlyIdField(requestedFields: Record<string, unknown>, c: Context) {
  if ('id' in requestedFields) {
    return c.json(
      {
        success: false,
        message: "Cannot write to readonly field 'id'",
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

/**
 * Check if user is trying to set fields with default values (system-managed)
 */
export function checkDefaultFields(
  table:
    | {
        readonly fields?: ReadonlyArray<{
          readonly name: string
          readonly default?: unknown
        }>
      }
    | undefined,
  requestedFields: Record<string, unknown>,
  c: Context
) {
  const fieldsWithDefaults =
    table?.fields?.filter((f) => 'default' in f && f.default !== undefined) ?? []
  const attemptedDefaultField = fieldsWithDefaults.find((f) => f.name in requestedFields)

  if (attemptedDefaultField) {
    return c.json(
      {
        success: false,
        message: `Cannot write to readonly field '${attemptedDefaultField.name}'`,
        code: 'FORBIDDEN',
      },
      403
    )
  }
  return undefined
}

/**
 * Check field-level write permissions and return forbidden field error if needed
 */
export function checkFieldWritePermissions(forbiddenFields: readonly string[], c: Context) {
  if (forbiddenFields.length > 0) {
    const firstForbiddenField = forbiddenFields[0]
    return c.json(
      {
        success: false,
        message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        code: 'FORBIDDEN',
        field: firstForbiddenField,
      },
      403
    )
  }
  return undefined
}
