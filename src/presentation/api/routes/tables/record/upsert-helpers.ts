/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { isResolvableColumnName } from '@/domain/models/shared/system-fields'
import { filterReadableFields } from '@/domain/validators/field-read-filter'
import {
  hasCreatePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/validators/permission-evaluators'
import { findMissingRequiredFieldNames } from '@/domain/validators/required-fields'
import { checkForExistingRecords } from '@/infrastructure/layers/table-layer'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { forbiddenCreateResponse } from '../response-helpers'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * Validate required fields for upsert records
 * Records come from schema in nested format: { fields: {...} }
 *
 * The rule is the shared one (`domain/validators/required-fields`), NOT a local
 * copy: this route used to carry its own, which never received the `default`
 * exemption `POST /records` has. A field declared `required: true,
 * default: 'draft'` therefore created fine through one route and was rejected
 * with `Required field is missing` through this one.
 */
export async function validateUpsertRequiredFields(
  table: NonNullable<App['tables']>[number] | undefined,
  records: readonly { fields: Record<string, unknown> }[]
): Promise<Array<{ record: number; field: string; error: string }>> {
  return records.flatMap((record, index) => {
    // Extract fields from nested format
    const missingFields = findMissingRequiredFieldNames(table, record.fields)
    return missingFields.map((field: string) => ({
      record: index,
      field,
      error: 'Required field is missing',
    }))
  })
}

/**
 * The first merge field that resolves to no column of `table`, or undefined when
 * every one of them does — including when the table itself is unknown, which is
 * the TABLE lookup's verdict to give, not this one's.
 *
 * System columns (`id`, the timestamps, the authorship columns) exist without
 * appearing in `fields[]`, so the shared `isResolvableColumnName` predicate is
 * used rather than a bare `fields[]` lookup — the same predicate both halves of
 * the record-filter field check already share, so the two cannot come to
 * opposite verdicts about one name.
 */
function unresolvableMergeField(
  table: NonNullable<App['tables']>[number] | undefined,
  fieldsToMergeOn: readonly string[]
): string | undefined {
  if (!table) return undefined
  const declaredFieldNames = new Set(table.fields.map((f) => f.name))
  return fieldsToMergeOn.find((name) => !isResolvableColumnName(declaredFieldNames, name))
}

/**
 * Check upsert permissions including update permission check
 * This function determines if records will be created or updated, then checks appropriate permissions
 * Note: Field-level permissions should be checked separately before calling this function
 *
 * The create-vs-update decision is made by asking the database whether the merge
 * fields already match a row, and BOTH of that question's "no match" answers
 * used to be reachable by a merge field naming no column — the caller supplies
 * `fieldsToMergeOn` under a bare `z.array(z.string())`. A name absent from the
 * record drops it out of the WHERE-clause builder, so the helper answers "no
 * match" without issuing any SQL; a name present in the record reaches SQL as an
 * identifier, and SQLite — the zero-config default engine — resolves a
 * double-quoted name matching no column to a string LITERAL, so the comparison
 * counts zero rows. Either way the update gate was skipped.
 *
 * The gate now fails CLOSED: a merge field that cannot be shown to name a column
 * cannot be shown not to match a row either, so the stricter permission is
 * demanded. The caller-visible effect is what makes it a security fix rather
 * than tidying — a correctly-spelled merge field earned a 404 (S1
 * anti-enumeration) while a misspelled one earned a 500 out of the database
 * layer, so the pair told an unauthorised caller which names are real columns.
 * The two are now indistinguishable.
 */

export async function checkUpsertPermissionsWithUpdateCheck(config: {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** Group names the caller belongs to (un-prefixed) — group-aware RBAC. */
  readonly userGroups: readonly string[]
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
  readonly c: Context
}): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const { app, tableName, userRole, userGroups, records, fieldsToMergeOn, c } = config
  const table = app.tables?.find((t) => t.name === tableName)

  // Both gates below evaluate the caller's EFFECTIVE ROLES — their global role
  // plus a `group:<name>` entry per membership — not a bare role string. A bare
  // string can never match a `group:` permission entry, because that overlay
  // exists only in the set `buildEffectiveRoles` produces. The create branch is
  // the sharper miss of the two: its batch-create sibling
  // (`batch/batch-routes.ts:225`) was already group-aware, and upsert was simply
  // missed by that sweep.
  const effectiveRoles = buildEffectiveRoles(userRole, userGroups)

  const unresolvable = unresolvableMergeField(table, fieldsToMergeOn)

  // Check if any records will be updated. An unresolvable merge field skips the
  // query outright: its answer would be "no match" on SQLite and a rejected
  // promise on Postgres, and neither is evidence that no row matches.
  const hasExistingRecords =
    unresolvable !== undefined ||
    (await checkForExistingRecords(tableName, records, fieldsToMergeOn))

  // If records will be updated, check update permission
  if (hasExistingRecords && !hasUpdatePermissionForRoles(table, effectiveRoles, app.tables)) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: 'Not found',
          code: 'NOT_FOUND',
        },
        404
      ),
    }
  }

  // Check table-level create permission (for new records)
  if (!hasCreatePermissionForRoles(table, effectiveRoles, app.tables)) {
    return {
      allowed: false,
      response: forbiddenCreateResponse(c),
    }
  }

  // Both gates cleared, so the caller may already read and write this table and
  // naming the bad field reveals nothing they cannot see. Answering here also
  // keeps a caller's typo from reaching the database layer, which used to blame
  // the operator for it with a 500.
  if (unresolvable !== undefined) {
    return {
      allowed: false,
      response: c.json(
        {
          success: false,
          message: `Merge field '${unresolvable}' does not exist in table '${tableName}'`,
          code: 'VALIDATION_ERROR',
        },
        400
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
): T[] {
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
export function applyReadFiltering<E, R>(config: {
  readonly program: Effect.Effect<UpsertResponse, E, R>
  readonly app: App
  readonly tableName: string
  readonly userRole: string
}): Effect.Effect<UpsertResponse, E, R> {
  const { program, app, tableName, userRole } = config

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
 * Create 404 response for protected field write attempt (S1 anti-enumeration —
 * field-permission boundary is not discoverable; field name is dropped). The
 * `_forbiddenField` parameter is retained for call-site readability.
 */
function createForbiddenFieldResponse(c: Context, _forbiddenField: string): Response {
  return c.json(
    {
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND',
    },
    404
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
  readonly userGroups: readonly string[]
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
}) {
  const { c, app, tableName, userRole, userGroups, records, fieldsToMergeOn } = config
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
    userGroups,
    records: strippedRecords,
    fieldsToMergeOn,
    c,
  })
  if (!permissionCheck.allowed) {
    return { success: false as const, response: permissionCheck.response }
  }

  // Validate required fields
  const requiredCheck = await checkRequiredFields(table, strippedRecords, c)
  if (!requiredCheck.success) return { success: false as const, response: requiredCheck.response }

  return { success: true as const, strippedRecords }
}
