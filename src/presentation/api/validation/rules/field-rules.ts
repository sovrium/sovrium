/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasPermission } from '@/domain/models/app/table/permissions'
import { ValidationError, PermissionError, ValidationContext } from '../../middleware/validation'

/**
 * Validate that 'id' field is not in the request (readonly)
 */
export function validateReadonlyIdField(
  fields: Record<string, unknown>
): Effect.Effect<void, ValidationError, never> {
  if ('id' in fields) {
    return Effect.fail(new ValidationError("Cannot write to readonly field 'id'", 'id'))
  }
  return Effect.void
}

/**
 * Validate that fields with default values are not in the request (system-managed)
 */
export function validateDefaultFields(
  fields: Record<string, unknown>
): Effect.Effect<void, ValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    const fieldsWithDefaults =
      table?.fields?.filter((f) => 'default' in f && f.default !== undefined) ?? []

    const attemptedDefaultField = fieldsWithDefaults.find((f) => f.name in fields)

    if (attemptedDefaultField) {
      return yield* Effect.fail(
        new ValidationError(
          `Cannot write to readonly field '${attemptedDefaultField.name}'`,
          attemptedDefaultField.name
        )
      )
    }
  })
}

/**
 * Validate required fields are present
 */
export function validateRequiredFields(
  fields: Record<string, unknown>
): Effect.Effect<void, ValidationError, ValidationContext> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    if (!table) return

    // Get primary key field names to exclude from validation
    const primaryKeyFields = new Set(
      table.primaryKey?.fields ?? (table.primaryKey?.field ? [table.primaryKey.field] : [])
    )

    // Auto-injected fields that should be excluded from required field validation
    const autoInjectedFields = new Set<string>([])

    const missingRequiredFields = table.fields
      .filter(
        (field) =>
          field.required &&
          !(field.name in fields) &&
          !primaryKeyFields.has(field.name) &&
          !autoInjectedFields.has(field.name)
      )
      .map((field) => field.name)

    if (missingRequiredFields.length > 0) {
      return yield* Effect.fail(
        new ValidationError(
          'Missing required fields',
          missingRequiredFields[0] // Report first missing field
        )
      )
    }
  })
}

/**
 * Check if a field permission restricts writing based on user role
 */
function hasWriteRoleRestriction(
  fieldPermission: { write?: 'all' | 'authenticated' | readonly string[] } | null | undefined,
  userRole: string
): boolean {
  const writePermission = fieldPermission?.write
  if (writePermission === undefined) return false
  return !hasPermission(writePermission, userRole)
}

/**
 * Filter fields based on write permissions
 * Returns only fields the user is allowed to write
 */
export function filterAllowedFields(
  fields: Record<string, unknown>
): Effect.Effect<
  { allowedData: Record<string, unknown>; forbiddenFields: readonly string[] },
  never,
  ValidationContext
> {
  return Effect.gen(function* () {
    const ctx = yield* ValidationContext
    const table = ctx.app.tables?.find((t) => t.name === ctx.tableName)

    // System-protected fields that cannot be modified
    const SYSTEM_PROTECTED_FIELDS = new Set(['user_id'])

    // Get forbidden fields based on field-level permissions (functional filter pattern)
    const forbiddenFields: readonly string[] = Object.keys(fields).filter((fieldName) => {
      const field = table?.fields?.find((f) => f.name === fieldName)
      if (!field) return false

      const fieldPermission = table?.permissions?.fields?.find((fp) => fp.field === fieldName)
      return hasWriteRoleRestriction(fieldPermission, ctx.userRole)
    })

    // Filter out forbidden and system-protected fields
    const allowedData = Object.fromEntries(
      Object.entries(fields).filter(
        ([fieldName]) =>
          !forbiddenFields.includes(fieldName) && !SYSTEM_PROTECTED_FIELDS.has(fieldName)
      )
    )

    return { allowedData, forbiddenFields }
  })
}

/**
 * Validate field write permissions - fails if any forbidden fields found
 */
export function validateFieldWritePermissions(
  forbiddenFields: readonly string[]
): Effect.Effect<void, PermissionError, never> {
  if (forbiddenFields.length > 0) {
    const firstForbiddenField = forbiddenFields[0]
    return Effect.fail(
      new PermissionError(
        `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
        firstForbiddenField
      )
    )
  }
  return Effect.void
}
