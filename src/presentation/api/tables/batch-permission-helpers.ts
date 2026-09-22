/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import {
  createValidationLayer,
  formatValidationError,
} from '@/presentation/api/middleware/validation'
import { payloadTooLarge } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { validateFieldWritePermissions } from '@/presentation/api/runtime/field-permission-validator'
import {
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

/**
 * Check if user is viewer and return 404 response if so (S1 anti-enumeration —
 * viewer-role denial is uniform across batch endpoints so the write boundary
 * is not discoverable). The `action` parameter is retained for call-site
 * readability but never emitted in the response.
 */
export function checkViewerPermission(
  userRole: string,
  c: Context,
  _action: string = 'perform this action'
): Response | undefined {
  if (userRole === 'viewer') {
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
      userRole: params.userRole,
      record: record.fields,
    }) as Record<string, RecordFieldValue | FormattedFieldValue>,
  }))

  return {
    [countKey]: response[countKey],
    records: filteredRecords,
  } as { readonly [P in K]: number } & { readonly records?: readonly TransformedRecord[] }
}

/**
 * Check field-level write permissions for batch records
 */
export function checkBatchFieldPermissions(config: {
  readonly records: readonly { readonly fields: Record<string, unknown> }[]
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly c: Context
}): Response | null {
  const { records, app, tableName, userRole, c } = config
  const allForbiddenFields = records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record.fields))
    .filter((fields) => fields.length > 0)

  // S1 anti-enumeration: field-permission denial returns 404; field names dropped.
  if (allForbiddenFields.length > 0) {
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // eslint-disable-next-line unicorn/no-null -- null indicates no permission error
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
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // eslint-disable-next-line unicorn/no-null -- null indicates no error
  return null
}

/**
 * Every per-VALUE rule the bulk write paths enforce, across every row — the
 * batch counterpart of {@link validateUpdateFieldValues}, and named to match
 * it. `multi-select` declared options, `multi-select` `maxSelections`, and a
 * `relationship` column's `maxLinked` cap.
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
 * as the single-record path does. Validation is pure and in-memory, so the full
 * pass costs nothing worth optimizing.
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
  const { tableName, userRole } = getTableContext(c)
  const layer = createValidationLayer(app, tableName, userRole)

  const program = Effect.forEach(
    records,
    (record) =>
      Effect.gen(function* () {
        yield* validateMultiSelectOptions(record.fields)
        yield* validateMultiSelectSelectionLimits(record.fields)
        yield* validateRelationshipLinkLimits(record.fields)
      }).pipe(Effect.result),
    { concurrency: 1 }
  ).pipe(Effect.provide(layer))

  const results = await Effect.runPromise(program)
  const firstFailure = results.find((result) => result._tag === 'Failure')
  return firstFailure === undefined ? undefined : formatValidationError(firstFailure.failure, c)
}
