/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasCreatePermission } from '@/application/use-cases/tables/permissions/permissions'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Validate required fields for upsert records
 * Records come from schema in nested format: { fields: {...} }
 */
export async function validateUpsertRequiredFields(
  table: NonNullable<App['tables']>[number] | undefined,
  records: readonly { fields: Record<string, unknown> }[]
): Promise<Array<{ record: number; field: string; error: string }>> {
  const { validateRequiredFieldsForRecord } = await import('./create-record-helpers')

  return records.flatMap((record, index) => {
    // Extract fields from nested format
    const missingFields = validateRequiredFieldsForRecord(table, record.fields)
    return missingFields.map((field: string) => ({
      record: index,
      field,
      error: 'Required field is missing',
    }))
  })
}

/**
 * Check if any records exist in database based on merge fields
 */
export async function checkForExistingRecords(
  tableName: string,
  records: readonly { fields: Record<string, unknown> }[],
  fieldsToMergeOn: readonly string[]
): Promise<boolean> {
  const { db } = await import('@/infrastructure/database/drizzle')
  const { sql } = await import('drizzle-orm')

  // Build WHERE clause - skip records missing merge fields (will fail validation)
  const mergeConditions = records
    .filter((record) =>
      fieldsToMergeOn.every((fieldName) => record.fields[fieldName] !== undefined)
    )
    .map((record) => {
      const conditions = fieldsToMergeOn.map((fieldName) => {
        const value = record.fields[fieldName]
        return sql`${sql.identifier(fieldName)} = ${value}`
      })
      return conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=0`
    })

  // If no valid records to check, return false
  if (mergeConditions.length === 0) return false

  const whereClause = sql.join(mergeConditions, sql` OR `)
  const existingRecords = (await db.execute(
    sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)} WHERE ${whereClause}`
  )) as readonly Record<string, unknown>[]

  const firstRecord = existingRecords[0]
  return firstRecord !== undefined && Number(firstRecord.count) > 0
}

/**
 * Validate field-level write permissions for records
 */
export function checkFieldPermissions(config: {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly c: Context
}): { allowed: true } | { allowed: false; response: Response } {
  const { app, tableName, userRole, records, c } = config

  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    const firstForbiddenField = uniqueForbiddenFields[0]
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: `Cannot write to field '${firstForbiddenField}': insufficient permissions`,
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  return { allowed: true }
}

/**
 * Check upsert permissions including update permission check
 * This function determines if records will be created or updated, then checks appropriate permissions
 * Note: Field-level permissions should be checked separately before calling this function
 */

export async function checkUpsertPermissionsWithUpdateCheck(config: {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
  readonly c: Context
}): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const { app, tableName, userRole, records, fieldsToMergeOn, c } = config
  const table = app.tables?.find((t) => t.name === tableName)

  const { hasUpdatePermission } =
    await import('@/application/use-cases/tables/permissions/permissions')

  // Check if any records will be updated
  const hasExistingRecords = await checkForExistingRecords(tableName, records, fieldsToMergeOn)

  // If records will be updated, check update permission
  if (hasExistingRecords && !hasUpdatePermission(table, userRole, app.tables)) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'You do not have permission to update records in this table',
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  // Check table-level create permission (for new records)
  if (!hasCreatePermission(table, userRole, app.tables)) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'You do not have permission to create records in this table',
          code: 'FORBIDDEN',
        },
        403
      ),
    }
  }

  return { allowed: true }
}

/**
 * Check if a field type is readonly (cannot be set by users)
 */
export function isReadonlyFieldType(fieldType: string): boolean {
  const readonlyTypes = new Set(['created-at', 'updated-at', 'auto-number'])
  return readonlyTypes.has(fieldType)
}

/**
 * Validate that no readonly fields are being set
 * Returns error response if readonly fields detected, undefined otherwise
 */
export function validateReadonlyFields(
  table:
    | {
        readonly fields: ReadonlyArray<{
          readonly name: string
          readonly type: string
        }>
      }
    | undefined,
  records: readonly { fields: Record<string, unknown> }[],
  c: Context
) {
  // Check for 'id' field (always readonly)
  const recordWithId = records.find((record) => 'id' in record.fields)
  if (recordWithId) {
    return c.json(
      {
        success: false,
        message: "Cannot write to readonly field 'id'",
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }

  // Check for readonly field types (created-at, updated-at, auto-number)
  if (table) {
    const readonlyFieldNames = new Set(
      table.fields.filter((field) => isReadonlyFieldType(field.type)).map((field) => field.name)
    )

    const attemptedReadonlyField = records
      .flatMap((record) => Object.keys(record.fields))
      .find((fieldName) => readonlyFieldNames.has(fieldName))

    if (attemptedReadonlyField) {
      return c.json(
        {
          success: false,
          message: `Cannot write to readonly field '${attemptedReadonlyField}'`,
          code: 'VALIDATION_ERROR',
        },
        400
      )
    }
  }

  return undefined
}

/**
 * Strip protected fields that user cannot write from records
 * This prevents 403 errors for fields user doesn't have write access to
 */
export function stripUnwritableFields<T extends { fields: Record<string, unknown> }>(
  app: App,
  tableName: string,
  userRole: string,
  records: readonly T[]
): Array<T> {
  return records.map((record) => {
    const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, record.fields)
    if (forbiddenFields.length === 0) {
      return record
    }

    // Remove forbidden fields from the record
    const filteredFields = Object.keys(record.fields).reduce<Record<string, unknown>>(
      (acc, key) => {
        if (!forbiddenFields.includes(key)) {
          return { ...acc, [key]: record.fields[key] }
        }
        return acc
      },
      {}
    )

    return { ...record, fields: filteredFields } as T
  })
}

type UpsertResponse = {
  readonly created: number
  readonly updated: number
  readonly records?: ReadonlyArray<{ readonly fields: Record<string, unknown> }>
}

/**
 * Apply field-level read filtering to upsert response
 */
export async function applyReadFiltering<E, R>(config: {
  readonly program: Effect.Effect<UpsertResponse, E, R>
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userId: string
}): Promise<Effect.Effect<UpsertResponse, E, R>> {
  const { program, app, tableName, userRole, userId } = config
  const { filterReadableFields } =
    await import('@/application/use-cases/tables/utils/field-read-filter')

  return program.pipe(
    Effect.map((response) => {
      if (!response.records) return response

      const filteredRecords = response.records.map(
        (record) =>
          ({
            ...record,
            fields: filterReadableFields({
              app,
              tableName,
              userRole,
              userId,
              record: record.fields,
            }),
          }) as { readonly fields: Record<string, unknown> }
      )

      return {
        created: response.created,
        updated: response.updated,
        records: filteredRecords as ReadonlyArray<{ readonly fields: Record<string, unknown> }>,
      }
    })
  )
}

/**
 * Create 403 response for protected field write attempt
 */
function createForbiddenFieldResponse(c: Context, forbiddenField: string): Response {
  return c.json(
    {
      success: false,
      message: `Cannot write to field '${forbiddenField}': insufficient permissions`,
      code: 'FORBIDDEN',
    },
    403
  )
}

/**
 * Check if single-record upsert contains protected fields
 * Single-record upserts reject if ANY protected fields present
 */
function checkSingleRecordProtectedFields(config: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
}): { success: true } | { success: false; response: Response } {
  const { c, app, tableName, userRole, records } = config

  if (records.length !== 1) {
    return { success: true }
  }

  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    const firstForbiddenField = uniqueForbiddenFields[0]
    return {
      success: false,
      response: createForbiddenFieldResponse(c, firstForbiddenField!),
    }
  }

  return { success: true }
}

/**
 * Check if all fields were stripped from records (user tried to write only protected fields)
 */
function checkAllFieldsStripped(config: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly strippedRecords: ReadonlyArray<{ fields: Record<string, unknown> }>
}): { success: true } | { success: false; response: Response } {
  const { c, app, tableName, userRole, records, strippedRecords } = config

  const hasWritableFields = strippedRecords.some((record) => Object.keys(record.fields).length > 0)
  if (hasWritableFields) {
    return { success: true }
  }

  // All fields were stripped
  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)
  const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
  const firstForbiddenField = uniqueForbiddenFields[0]

  return {
    success: false,
    response: createForbiddenFieldResponse(c, firstForbiddenField!),
  }
}

/**
 * Check required field validation
 */
async function checkRequiredFields(
  table: NonNullable<App['tables']>[number] | undefined,
  strippedRecords: ReadonlyArray<{ fields: Record<string, unknown> }>,
  c: Context
): Promise<{ success: true } | { success: false; response: Response }> {
  const validationErrors = await validateUpsertRequiredFields(table, strippedRecords)
  if (validationErrors.length === 0) {
    return { success: true }
  }

  return {
    success: false,
    response: c.json(
      {
        success: false,
        message: 'Validation failed: one or more records have invalid data',
        code: 'VALIDATION_ERROR',
        details: validationErrors,
      },
      400
    ),
  }
}

/**
 * Validate upsert request (permissions and required fields)
 *
 * Upsert behavior for protected fields:
 * - Single-record upserts: Reject with 403 if ANY protected fields present
 * - Multi-record upserts (batch): Strip protected fields, succeed if any writable fields remain
 * - Filter protected fields from response
 */
export async function validateUpsertRequest(config: {
  readonly c: Context
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
}) {
  const { c, app, tableName, userRole, records, fieldsToMergeOn } = config
  const table = app.tables?.find((t) => t.name === tableName)

  // Single-record upsert: reject if ANY protected fields present
  const singleRecordCheck = checkSingleRecordProtectedFields({
    c,
    app,
    tableName,
    userRole,
    records,
  })
  if (!singleRecordCheck.success) {
    return singleRecordCheck
  }

  // For multi-record upserts, strip unwritable fields
  const strippedRecords = stripUnwritableFields(app, tableName, userRole, records)

  // Check if all fields were stripped
  const stripCheck = checkAllFieldsStripped({
    c,
    app,
    tableName,
    userRole,
    records,
    strippedRecords,
  })
  if (!stripCheck.success) {
    return stripCheck
  }

  // Check table-level permissions (create/update)
  const permissionCheck = await checkUpsertPermissionsWithUpdateCheck({
    app,
    tableName,
    userRole,
    records: strippedRecords,
    fieldsToMergeOn,
    c,
  })
  if (!permissionCheck.allowed) {
    return { success: false as const, response: permissionCheck.response }
  }

  // Validate required fields
  const requiredCheck = await checkRequiredFields(table, strippedRecords, c)
  if (!requiredCheck.success) {
    return { success: false as const, response: requiredCheck.response }
  }

  return { success: true as const, strippedRecords }
}
