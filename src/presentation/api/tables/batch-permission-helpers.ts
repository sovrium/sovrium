/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import {
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/middleware/validation'
import { payloadTooLarge, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { validateFieldWritePermissions } from '@/presentation/api/runtime/field-permission-validator'
import {
  validateAttachmentReferences,
  validateMultiSelectOptions,
  validateMultiSelectSelectionLimits,
  validateRelationshipLinkLimits,
} from '@/presentation/api/tables/validation'
import type {
  RecordFieldValue,
  FormattedFieldValue,
  TransformedRecord,
} from '@/application/use-cases/tables/record-transformer'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** A write a batch route performs, named as the table grant that admits it. */
export type BatchWriteOperation = 'create' | 'update' | 'delete'

const WRITE_EVALUATORS = {
  create: hasCreatePermissionForRoles,
  update: hasUpdatePermissionForRoles,
  delete: hasDeletePermissionForRoles,
} as const

/**
 * The early viewer refusal of the batch routes, asked BEFORE the body is read
 * so a viewer the table does not admit is answered the same 404 whatever she
 * sent (S1 anti-enumeration — the write boundary is not discoverable).
 *
 * It decides nothing on its own: it asks the table's own write evaluators
 * (`has{Create,Update,Delete}PermissionForRoles`), whose `writingRoles` is the
 * one place the viewer rule lives — the viewer role writes only where a table
 * names it (by name, or through `'all'` / `'authenticated'`), and a grant
 * reaching her through a group or an assignment is read-only. So a viewer a
 * table names writes by batch exactly as she writes one record at a time, and
 * the route's own gates then judge her as they judge anyone else. A viewer is
 * let through when ANY of `operations` admits her (an upsert may create or
 * update).
 */
export function checkViewerPermission(
  c: Context,
  app: App,
  operations: readonly BatchWriteOperation[]
): Response | undefined {
  const { tableName, userRole, userGroups } = getTableContext(c)
  if (userRole !== 'viewer') return undefined
  const table = app.tables?.find((t) => t.name === tableName)
  const roles = buildEffectiveRoles(userRole, userGroups)
  const admitted = operations.some((op) => WRITE_EVALUATORS[op](table, roles, app.tables))
  return admitted ? undefined : notFound(c)
}

/**
 * Check if request has more than 1000 records and return 413 if so
 */
export function checkRecordLimitExceeded(
  records: readonly unknown[],
  c: Context
): Response | undefined {
  if (records.length > 1000) {
    return payloadTooLarge(c, 'Batch size exceeds maximum of 1000 records')
  }
  return undefined
}

/**
 * Parameters for read-level field filtering
 */
interface ReadFilteringParams {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups: readonly string[]
}

/**
 * Apply read-level filtering to batch response records.
 *
 * Generic over the count property key (e.g. 'updated', 'created')
 * to eliminate duplication between batch create and batch update responses.
 */
export function applyBatchReadFiltering<K extends string>(
  response: { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] },
  params: ReadFilteringParams,
  countKey: K
): { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] } {
  if (!response.records) return response

  const filteredRecords: readonly TransformedRecord[] = response.records.map((record) => ({
    ...record,
    fields: filterReadableFields({
      app: params.app,
      tableName: params.tableName,
      caller: { role: params.userRole, groups: params.userGroups },
      record: record.fields,
    }) as Record<string, RecordFieldValue | FormattedFieldValue>,
  }))

  return {
    [countKey]: response[countKey],
    records: filteredRecords,
  } as { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] }
}

/**
 * The answer to a batch create: the created records filtered by field read
 * permission, or — for a caller who may not read the table — the count alone,
 * with no value of any record and no id to address one by.
 */
export const batchCreateAnswer =
  (readsTable: boolean, params: ReadFilteringParams) =>
  (response: {
    readonly created: number
    readonly records?: readonly TransformedRecord[]
  }): { readonly created: number; readonly records?: readonly TransformedRecord[] } =>
    readsTable
      ? applyBatchReadFiltering(response, params, 'created')
      : { created: response.created }

/**
 * Check field-level write permissions for batch records
 */
export function checkBatchFieldPermissions(config: {
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
  readonly c: Context
}): Response | null {
  const { records, app, tableName, userRole, userGroups, c } = config
  const writer = { role: userRole, groups: userGroups }
  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, writer, record.fields))
    .filter((fields) => fields.length > 0)

  // S1 anti-enumeration: field-permission denial returns 404; field names dropped.
  if (allForbiddenFields.length > 0) {
    return notFound(c)
  }

  return null
}

/**
 * Validate stripped records have at least some writable fields
 */
export function validateStrippedRecordsNotEmpty(config: {
  readonly strippedRecords: readonly { readonly fields: Record<string, unknown> }[]
  readonly originalRecords: readonly { readonly fields: Record<string, unknown> }[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}): Response | null {
  const { strippedRecords, c } = config
  const hasWritableFields = strippedRecords.some((record) => Object.keys(record.fields).length > 0)
  // S1 anti-enumeration: stripped-all-fields means user tried to write only
  // protected fields — return 404 so the field-permission boundary is not
  // discoverable. Field names are dropped from the response envelope, so we
  // don't need `originalRecords`/`app`/`tableName`/`userRole` to enumerate
  // the offending fields — those config keys are kept on the type to keep
  // call-site signatures stable but are no longer destructured.
  if (!hasWritableFields) {
    return notFound(c)
  }

  return null
}

/**
 * Every per-VALUE rule the bulk write paths enforce, across every row — the
 * batch counterpart of {@link validateUpdateFieldValues}, and named to match
 * it. `multi-select` declared options, `multi-select` `maxSelections`, a
 * `relationship` column's `maxLinked` cap, and the attachment-reference
 * confinement (a bulk write naming a foreign or unreachable file is refused
 * exactly as a single-record write is).
 *
 * These rules live in the application layer for a reason the SQL generator
 * cannot work around: Postgres carries a member CHECK on a `multi-select`
 * column, but SQLite cannot express one — it prohibits subqueries inside CHECK,
 * and there is no subquery-free idiom for "every element of a JSON array is in
 * a fixed allowlist" (`validation/rules/multi-select-rules.ts` says so at
 * length). `maxLinked` is worse still: a `many-to-many` link set is rows in a
 * junction table rather than a column, so NEITHER engine has a CHECK that could
 * carry it. The API is therefore the ONLY seam where both engines can be held
 * to one contract.
 *
 * This seam has now been the missing half twice, which is why it is a single
 * aggregate call rather than a list the caller assembles. `validateRecordCreation`
 * wired `multi-select` to the single-record routes and nothing else, so batch
 * create, batch update and upsert reached the database unchecked: on Postgres
 * the CHECK still refused them with a sanitized 400 naming no column; on SQLite
 * — the shipped default — the row landed with an undeclared option. `maxLinked`
 * then repeated it exactly, reaching single create and single update while all
 * three bulk routes ignored it, so a cap the grid honoured was a suggestion to
 * anyone posting a batch.
 *
 * Every row is evaluated rather than short-circuiting at the first, so the
 * response names the first offending FIELD in table declaration order exactly
 * as the single-record path does. Every rule but the attachment one is pure and
 * in-memory; that one reads the storage catalog once per referenced key.
 *
 * Rule ORDER matches the create path (`record-rules.ts` steps 8b-8d) so the
 * three routes agree on which violation a row carrying two of them reports.
 *
 * @returns a formatted response for the first offending row — 422 for a
 *   membership violation, 400 for a cardinality one — or `undefined`
 */
export async function validateBulkFieldValues(
  c: Context,
  app: App,
  records: readonly { readonly fields: Record<string, unknown> }[]
): Promise<Response | undefined> {
  const { tableName, userRole, userGroups, session } = getTableContext(c)
  const layer = createValidationLayer(app, tableName, {
    role: userRole,
    groups: userGroups,
    signedOut: isGuestSession(session.userId),
  })

  const program = Effect.forEach(
    records,
    (record) =>
      Effect.gen(function* () {
        yield* validateMultiSelectOptions(record.fields)
        yield* validateMultiSelectSelectionLimits(record.fields)
        yield* validateRelationshipLinkLimits(record.fields)
        yield* validateAttachmentReferences(record.fields)
      }).pipe(Effect.result),
    { concurrency: 1 }
  ).pipe(Effect.provide(layer))

  const results = await runDomainPromise(c, program)
  const firstFailure = results.find((result) => result._tag === 'Failure')
  return firstFailure === undefined ? undefined : formatValidationError(firstFailure.failure, c)
}
