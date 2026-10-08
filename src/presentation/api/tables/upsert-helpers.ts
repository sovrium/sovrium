/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { tableEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import {
  hasCreatePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { findMissingRequiredFieldNames } from '@/domain/models/app/tables/required-fields-validation'
import { checkForExistingRecords } from '@/infrastructure/layers/table-layer'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { validateFieldWritePermissions } from '@/presentation/api/runtime/field-permission-validator'
import { forbiddenCreateResponse } from './response-helpers'
import { resolveAccessRolesFor } from './row-level-guard'
import { enforceUpsertRowGate, hiddenMatchesOf, unresolvableMergeField } from './upsert-row-gate'
import type { App } from '@/domain/models/app'
import type { FieldWriter } from '@/domain/models/app/tables/field-write-permission-service'
import type { Context } from 'hono'

/**
 * Validate required fields for upsert records
 * Records come from schema in nested format: { fields: {...} }
 *
 * The rule is the shared one (`domain/validators/required-fields`), NOT a local
 * copy, so this route gets the same `default` exemption `POST /records` has. A
 * local copy drifts: a field declared `required: true, default: 'draft'` would
 * create fine through one route and be rejected with `Required field is
 * missing` through this one.
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
  /** The caller's `user_access` roles, counted on a table with row-level rules. */
  readonly accessRoles: readonly string[]
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
  /** The matched rows the caller's read rule hides: none of them is a match. */
  readonly hiddenIds: readonly string[]
  readonly c: Context
}): Promise<{ allowed: true } | { allowed: false; response: Response }> {
  const { app, tableName, userRole, userGroups, accessRoles, records, fieldsToMergeOn, c } = config
  const table = app.tables?.find((t) => t.name === tableName)

  // Both gates below evaluate the caller's EFFECTIVE ROLES exactly as the
  // records route's create and update do — her account role, a `group:<name>`
  // entry per membership and, on a table with row-level rules, her assignment
  // roles — so an upsert admits whom a create and an update admit.
  const effectiveRoles = tableEffectiveRoles(table, {
    role: userRole,
    groups: userGroups,
    accessRoles,
  })

  const unresolvable = unresolvableMergeField(table, fieldsToMergeOn)

  // Check if any records will be updated. An unresolvable merge field skips the
  // query outright: its answer would be "no match" on SQLite and a rejected
  // promise on Postgres, and neither is evidence that no row matches.
  const hasExistingRecords =
    unresolvable !== undefined ||
    (await checkForExistingRecords(tableName, records, fieldsToMergeOn, config.hiddenIds))

  // If records will be updated, check update permission
  if (hasExistingRecords && !hasUpdatePermissionForRoles(table, effectiveRoles, app)) {
    return {
      allowed: false,
      response: notFound(c, 'Not found'),
    }
  }

  // Check table-level create permission (for new records)
  if (!hasCreatePermissionForRoles(table, effectiveRoles, app)) {
    return {
      allowed: false,
      response: forbiddenCreateResponse(c),
    }
  }

  // Both gates cleared, so the caller may already read and write this table and
  // naming the bad field reveals nothing they cannot see. Answering here also
  // keeps a caller's typo from reaching the database layer, which would blame
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
 * The intrinsic creation date is engine-owned over HTTP. A seed file may set it
 * (it is how an import keeps a row's real creation date), but a request body
 * never may: the insert would otherwise honour it. The intrinsic author needs no
 * refusal — the create half overwrites it with the session's user and the
 * update half never writes it, so a supplied value is ignored.
 */
const refuseIntrinsicCreatedAt = (
  records: readonly { fields: Record<string, unknown> }[],
  c: Context
) =>
  records.some((record) => 'created_at' in record.fields)
    ? c.json(
        {
          success: false,
          message: "Cannot write to readonly field 'created_at'",
          code: 'VALIDATION_ERROR',
        },
        400
      )
    : undefined

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

  const intrinsicGuard = refuseIntrinsicCreatedAt(records, c)
  if (intrinsicGuard) return intrinsicGuard

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
  writer: FieldWriter,
  records: readonly T[]
): T[] {
  return records.map((record) => {
    const forbiddenFields = validateFieldWritePermissions(app, tableName, writer, record.fields)
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
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups: readonly string[]
}): Effect.Effect<UpsertResponse, E, R> {
  const { program, app, tableName, userRole, userGroups } = config

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
              caller: { role: userRole, groups: userGroups },
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
  return notFound(c)
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
  readonly userGroups: readonly string[]
  readonly records: readonly { fields: Record<string, unknown> }[]
}): { success: true } | { success: false; response: Response } {
  const { c, app, tableName, userRole, userGroups, records } = config

  if (records.length !== 1) {
    return { success: true }
  }

  const allForbiddenFields = records
    .map((record) =>
      validateFieldWritePermissions(
        app,
        tableName,
        { role: userRole, groups: userGroups },
        record.fields
      )
    )
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
  readonly userGroups: readonly string[]
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly strippedRecords: ReadonlyArray<{ fields: Record<string, unknown> }>
}): { success: true } | { success: false; response: Response } {
  const { c, app, tableName, userRole, userGroups, records, strippedRecords } = config

  const hasWritableFields = strippedRecords.some((record) => Object.keys(record.fields).length > 0)
  if (hasWritableFields) {
    return { success: true }
  }

  // All fields were stripped
  const allForbiddenFields = records
    .map((record) =>
      validateFieldWritePermissions(
        app,
        tableName,
        { role: userRole, groups: userGroups },
        record.fields
      )
    )
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
  readonly session: Parameters<typeof enforceUpsertRowGate>[0]['session']
  readonly records: readonly { fields: Record<string, unknown> }[]
  readonly fieldsToMergeOn: readonly string[]
}) {
  const { c, app, tableName, userRole, userGroups, records, fieldsToMergeOn } = config
  const table = app.tables?.find((t) => t.name === tableName)

  // Single-record upsert: reject if ANY protected fields present
  const singleRecordCheck = checkSingleRecordProtectedFields(config)
  if (!singleRecordCheck.success) return singleRecordCheck

  // For multi-record upserts, strip unwritable fields
  const strippedRecords = stripUnwritableFields(
    app,
    tableName,
    { role: userRole, groups: userGroups },
    records
  )

  // Check if all fields were stripped
  const stripCheck = checkAllFieldsStripped({ ...config, strippedRecords })
  if (!stripCheck.success) return stripCheck

  const hiddenIds = await hiddenMatchesOf({ ...config, table, records: strippedRecords })

  // Check table-level permissions (create/update)
  const permissionCheck = await checkUpsertPermissionsWithUpdateCheck({
    app,
    tableName,
    userRole,
    userGroups,
    accessRoles: await resolveAccessRolesFor(c, config.session, table ? [table] : []),
    records: strippedRecords,
    fieldsToMergeOn,
    hiddenIds,
    c,
  })
  if (!permissionCheck.allowed) {
    return { success: false as const, response: permissionCheck.response }
  }

  // Validate required fields
  const requiredCheck = await checkRequiredFields(table, strippedRecords, c)
  if (!requiredCheck.success) return { success: false as const, response: requiredCheck.response }

  // Row-level rules: each row it merges onto is checked as it stands and as it
  // will be written, and each row it creates against `create.when`.
  const rowError = await enforceUpsertRowGate({
    ...config,
    table,
    records: strippedRecords,
    hiddenIds,
  })
  if (rowError) return { success: false as const, response: rowError }

  return { success: true as const, strippedRecords, hiddenIds }
}
