/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single-record reads, and the trash listing that shares their shape.
 *
 * Three programs: `GET /records/:recordId` (permission-filtered, enriched, and
 * optionally collapsed to display strings), the same read WITHOUT any filtering
 * for internal callers, and the soft-deleted listing. The trash listing sits
 * here rather than beside the live listing because it is a different question —
 * it joins `deleted_by_user` and pages in memory, and it shares none of the
 * pushdown / aggregation / grouping machinery `list-records-program.ts` exists
 * to reconcile.
 *
 * ## This module owns the single-record ADDRESS rule
 * {@link refuseWhenNoSingleIdAddress} is exported rather than private, and it is
 * the one promotion this package makes on purpose. `/records/:recordId` spends
 * one path segment on identity, so EVERY verb below it — read, update, restore,
 * delete — has to refuse a table that has no single-value address, and refuse it
 * identically on both engines. Five programs across three modules call it. One
 * definition is what makes the two engines agree; a second copy is how they stop
 * agreeing, silently, with a 500 on one and a 400 on the other.
 *
 * It opens a span, which a guard doing no I/O otherwise would not earn.
 * `Effect Span Census` fails any Effect-returning export under
 * `src/application/use-cases/**` that opens none, and it is right to: an export
 * is reachable, and a reachable Effect nobody can see in a trace is where time
 * goes missing. The alternative it offers — "stop exporting it" — is the one
 * thing this helper cannot do, because the three modules that raise the refusal
 * are exactly what the split created. The span is cheap and it is not useless:
 * when a composite-keyed table refuses, the trace now says so instead of
 * showing a 400 with no cause.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { buildAiComputeProjection } from '@/application/use-cases/ai-compute/status-projection'
import { NotFoundError, ValidationError } from '@/domain/errors'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { singleRecordAddressRefusal } from '@/domain/models/app/tables/single-record-address'
import { enrichRecordWithAttachmentUrls } from './attachment-url-enricher'
import { formatFieldForDisplay } from './display-formatter'
import { processRecords, applyPagination } from './list-helpers'
import { preserveIdType } from './preserve-id-type'
import { readManyToManyLinks, mergeManyToManyFields } from './record-link-enrichment'
import { transformRecord } from './record-transformer'
import type { TransformedRecord } from './record-transformer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { ListRecordsResponse, GetRecordResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

interface ListTrashConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  readonly filter?: QueryFilter
  readonly sort?: string
  readonly limit?: number
  readonly offset?: number
}

/**
 * Extract deletedBy user ID from a raw trash record.
 * The listTrash query joins auth.user and returns deleted_by_user object.
 * We extract only the user ID string to match the flat authorship format.
 */
function extractDeletedByUserId(rawRecord: Readonly<Record<string, unknown>>): string | undefined {
  const deletedByUser = rawRecord['deleted_by_user']
  if (!deletedByUser || typeof deletedByUser !== 'object') return undefined
  const userObj = deletedByUser as Record<string, unknown>
  if (!userObj['id']) return undefined
  return String(userObj['id'])
}

export function createListTrashProgram(
  config: ListTrashConfig
): Effect.Effect<ListRecordsResponse, DatabaseError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, sort, limit, offset } = config

    // Query soft-deleted records with session context (RLS policies apply automatically)
    const records = yield* repo.listTrash({ session, tableName, filter, sort })

    // Process records (field-level filtering, transformations)
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
    })

    // Preserve numeric IDs and attach deletedBy user object from joined query results
    const recordsWithPreservedIds = processedRecords.map((record) => {
      // Try to parse ID as number if it's a numeric string, otherwise keep as-is
      const rawRecord = records.find((r) => String(r.id) === String(record.id))
      const originalId = rawRecord?.id
      const id = typeof originalId === 'number' ? originalId : record.id

      // Extract deletedBy user ID from the raw record's join result
      const deletedBy = rawRecord ? extractDeletedByUserId(rawRecord) : undefined

      return {
        ...record,
        id,
        ...(deletedBy ? { deletedBy } : {}),
      }
    })

    // Apply pagination
    const { paginatedRecords, pagination } = applyPagination(
      recordsWithPreservedIds,
      records.length,
      limit,
      offset
    )

    return {
      records: [...paginatedRecords] as TransformedRecord[],
      pagination,
    }
  }).pipe(Effect.withSpan('tables.create-list-trash-program'))
}

interface GetRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userRole: string
  readonly includeDeleted?: boolean
  readonly format?: 'display'
  /** See `ListRecordsConfig.timezone` in `list-records-program.ts`. */
  readonly timezone?: string
  /** See `ListRecordsConfig.origin` in `list-records-program.ts`. */
  readonly origin?: string
}

/**
 * Collapse the single-record read's fields to FLAT display strings.
 *
 * The list route keeps the `{ value, displayValue, timezone }` object; this
 * route deliberately does not, and nine sibling `format=display` specs read
 * `fields.X` as a string. Changing that here would silently re-spec a contract
 * they pin, so the collapse stays.
 *
 * Two paths reach a display string, and BOTH need the caller's zone.
 * `transformRecord` has already formatted every field it recognised, leaving an
 * object to unwrap; anything it passed through unformatted is formatted here
 * instead. Passing the override to only one of them made the rendered clock
 * depend on which branch a field happened to take.
 */
const toDisplayFields = (
  fields: Readonly<TransformedRecord['fields']>,
  config: GetRecordConfig
): Readonly<TransformedRecord['fields']> =>
  Object.fromEntries(
    Object.entries(fields).map(
      ([key, value]): readonly [string, TransformedRecord['fields'][string]] => {
        const isObj = typeof value === 'object' && value !== null && !Array.isArray(value)
        if (isObj && 'displayValue' in (value as object)) {
          return [key, (value as { displayValue: string }).displayValue]
        }
        const formatted = formatFieldForDisplay({
          fieldName: key,
          value,
          app: config.app,
          tableName: config.tableName,
          timezoneOverride: config.timezone,
        })
        return [key, formatted ? formatted.displayValue : value]
      }
    )
  )

/**
 * Refuse a single-record verb whose table has no single-value record address.
 *
 * `/records/:recordId` spends one path segment on identity and every verb below
 * resolves it as `WHERE id = :recordId`, but a table keyed on a composite of
 * its own columns has no `id` column at all — so the statement names a column
 * that is not there, and the two engines then fail it differently (SQLite a
 * hard `no such column` surfaced as 500; PostgreSQL SQLSTATE 42703, sanitized
 * into a 400 that blames the caller for a column the server chose).
 *
 * Raised from the declared config BEFORE any statement is built, which is what
 * makes the answer identical on both engines: they agree by never reaching the
 * database, rather than by two sanitizers phrasing a driver error alike.
 *
 * A caller that supplies no `app` — every automation-driven write — gets no
 * refusal and behaves exactly as before. The rule itself lives in the domain
 * and delegates its decision to `tableHasIdColumn`, the mirror of the DDL
 * layer's `needsAutomaticIdColumn`, so it is not a fresh copy of the rule.
 */
export const refuseWhenNoSingleIdAddress = (
  app: App | undefined,
  tableName: string
): Effect.Effect<void, ValidationError> => {
  const refusal = singleRecordAddressRefusal(app, tableName)
  return (refusal ? Effect.fail(new ValidationError(refusal)) : Effect.void).pipe(
    Effect.withSpan('tables.refuse-when-no-single-id-address')
  )
}

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<
  GetRecordResponse,
  DatabaseError | NotFoundError | ValidationError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, recordId, app, userRole, includeDeleted } = config

    yield* refuseWhenNoSingleIdAddress(app, tableName)

    const record = yield* repo.getRecord(session, tableName, recordId, includeDeleted)
    if (!record) return yield* Effect.fail(new NotFoundError('Record not found'))

    const filteredRecord = filterReadableFields({ app, tableName, userRole, record })
    const transformedRaw = transformRecord(filteredRecord, {
      app,
      tableName,
      format: config.format,
      timezone: config.timezone,
    })
    // B-01: same attachment-URL enrichment as the list path.
    const transformed = enrichRecordWithAttachmentUrls(transformedRaw, {
      app,
      tableName,
      origin: config.origin ?? '',
    })

    const fields =
      config.format === 'display' ? toDisplayFields(transformed.fields, config) : transformed.fields

    // Preserve TEXT primary keys (e.g. scope tables in `auth.scopeTables`)
    // as strings; only coerce when the value *looks* numeric. Avoids NaN
    // for opaque string ids.
    const id = preserveIdType(record.id)

    // [internal ref]: resolve many-to-many relationship fields from their junction
    // tables (they have no base column, so `SELECT *` never returns them). A
    // record with no links leaves the field absent — no empty-array injection.
    const m2mLinks = yield* readManyToManyLinks(app, tableName, [id])
    const enrichedFields = mergeManyToManyFields(fields, id, m2mLinks)

    // [internal ref] Phase 2: surface the AI-compute refinement signal as a gated
    // top-level `_aiCompute` block. `undefined` (omitted) for non-AI tables
    // and for records with no status rows yet — non-AI tables skip the read.
    const aiCompute = yield* buildAiComputeProjection(app, tableName, id)

    // Spread fields at root level as flat aliases (same pattern as createRecordProgram).
    // Lets callers access record.fieldName in addition to record.fields.fieldName.
    return {
      ...enrichedFields,
      id,
      fields: enrichedFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
      ...(aiCompute ? { _aiCompute: aiCompute } : {}),
    }
  }).pipe(Effect.withSpan('tables.create-get-record-program'))
}

/**
 * Raw record retrieval (no permission filtering) — used for internal checks.
 *
 * `app` is optional and buys ONE thing: the single-value-address refusal above.
 * It matters because the delete routes pre-fetch the row through this program
 * to build the delete-event trigger payload, so on a composite-keyed table this
 * read — not the delete itself — is the first statement to name the missing
 * `id` column, and it would answer 500 before the delete program could refuse.
 * Callers with no config in scope pass nothing and are unchanged.
 */
export function rawGetRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  app?: App
): Effect.Effect<Record<string, unknown> | null, DatabaseError | ValidationError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    yield* refuseWhenNoSingleIdAddress(app, tableName)
    return yield* repo.getRecord(session, tableName, recordId)
  }).pipe(Effect.withSpan('tables.raw-get-record-program'))
}
