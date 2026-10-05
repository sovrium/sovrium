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
import { buildAiComputeProjections } from '@/application/use-cases/ai-compute/status-projection'
import { NotFoundError, ValidationError } from '@/domain/errors'
import { filterReadableFields } from '@/domain/models/app/tables/field-read-filter-service'
import { singleRecordAddressRefusal } from '@/domain/models/app/tables/single-record-address'
import { enrichRecordWithAttachmentUrls } from './attachment-url-enricher'
import { formatFieldForDisplay } from './display-formatter'
import {
  omitHiddenColumnLookups,
  omitHiddenLookups,
  omitHiddenRecordLookups,
} from './hidden-lookup-omission'
import { relatedReaderOf } from './linked-row-visibility'
import { processRecords, applyPagination } from './list-helpers'
import { lookupReadMasks } from './lookup-read-masks'
import { preserveIdType } from './preserve-id-type'
import {
  enrichRecordsWithRelatedLabels,
  mergeManyToManyFields,
  readManyToManyLinks,
} from './record-link-enrichment'
import { transformRecord } from './record-transformer'
import type { TransformedRecord } from './record-transformer'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { QueryFilter } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { ListRecordsResponse, GetRecordResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

interface ListTrashConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  /** The caller's groups: a field read grant may name a group. */
  readonly userGroups?: readonly string[]
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
): Effect.Effect<
  ListRecordsResponse,
  DatabaseError,
  TableRepository | DataSourceRepository | AuthRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, sort, limit, offset } = config

    // Query soft-deleted records with session context (RLS policies apply
    // automatically). A lookup through a linked row the reader may not read is
    // evaluated as empty wherever the filter or the sort names it.
    const reader = { session, role: userRole, groups: config.userGroups ?? [] }
    const lookupMasks = yield* lookupReadMasks(app, tableName, reader, { filter, sort })
    const trashed = yield* repo.listTrash({ session, tableName, filter, sort, lookupMasks })
    // A lookup through a link to a row the reader may not read is left out,
    // on the raw rows as the live list does.
    const records = yield* omitHiddenLookups(app, tableName, trashed, reader)

    // Process records (field-level filtering, transformations)
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
      userGroups: config.userGroups ?? [],
    })

    // Attach the deletedBy user from the joined query results. The id stays the
    // string `transformRecord` produced, as on every records-API response.
    const recordsWithDeletedBy = processedRecords.map((record) => {
      const rawRecord = records.find((r) => String(r.id) === String(record.id))
      const deletedBy = rawRecord ? extractDeletedByUserId(rawRecord) : undefined
      return deletedBy ? { ...record, deletedBy } : record
    })

    // Apply pagination
    const { paginatedRecords, pagination } = applyPagination(
      recordsWithDeletedBy,
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
  /** The caller's groups, which decide which fields and relationship labels they may read. */
  readonly userGroups?: readonly string[]
  /**
   * Whether the caller's row-level read rule admits the STORED row — asked
   * before any column she may not read is stripped, so a rule on such a column
   * judges the value the list judges in SQL. A row it refuses answers exactly
   * as a missing one.
   */
  readonly admits?: (stored: Readonly<Record<string, unknown>>) => boolean
}

/** What shaping a stored row needs to know about its reader — no address of its own. */
type RecordReaderConfig = Omit<GetRecordConfig, 'recordId' | 'includeDeleted' | 'admits'>

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
  config: RecordReaderConfig
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

/**
 * The raw row a single read answers from, with every lookup through a key
 * column to a row the reader may not read left out — judged here, before field
 * permissions can drop the key the lookup is judged by.
 */
const readRawRecord = (config: GetRecordConfig) =>
  Effect.gen(function* () {
    const { session, tableName, recordId, app, userRole, includeDeleted } = config
    const repo = yield* TableRepository
    const found = yield* repo.getRecord(session, tableName, recordId, includeDeleted)
    if (!found || config.admits?.(found) === false) {
      return yield* Effect.fail(new NotFoundError('Record not found'))
    }
    const [record = found] = yield* omitHiddenColumnLookups(app, tableName, [found], {
      session,
      role: userRole,
      groups: config.userGroups ?? [],
    })
    return record
  })

/** One stored row, filtered to its reader's fields and transformed — the pure half of the shape. */
const transformForReader = (
  config: RecordReaderConfig,
  record: Readonly<Record<string, unknown>>
) => {
  const { tableName, app, userRole } = config
  const caller = { role: userRole, groups: config.userGroups ?? [] }
  const filteredRecord = filterReadableFields({ app, tableName, caller, record })
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
  // Preserve TEXT primary keys (e.g. scope tables in `auth.scopeTables`) as
  // strings; only coerce when the value *looks* numeric. Avoids NaN for opaque
  // string ids.
  return { transformed, fields, id: preserveIdType(record['id'] as string | number) }
}

/** Assemble one records-API single-record answer from its already-read parts. */
const toGetRecordResponse = (parts: {
  readonly id: string | number
  readonly transformed: TransformedRecord
  readonly fields: Readonly<TransformedRecord['fields']>
  readonly aiCompute: unknown
  readonly display: unknown
}): GetRecordResponse => {
  const { id, transformed, fields, aiCompute, display } = parts
  // Fields at the root as flat aliases too (the same pattern as
  // `createRecordProgram`), so `record.fieldName` reads as `record.fields.fieldName`.
  return {
    ...fields,
    // A record id reads as a string on every records-API response.
    id: String(id),
    fields,
    createdAt: transformed.createdAt,
    updatedAt: transformed.updatedAt,
    ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
    ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
    ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    ...(aiCompute ? { _aiCompute: aiCompute } : {}),
    ...(display === undefined ? {} : { _display: display }),
  }
}

/**
 * The records API's single-record answer for each stored row, as `config`'s
 * reader sees it: the fields they may read, transformed and flattened to the
 * top level as well as under `fields`, their many-to-many links (narrowed to
 * the linked rows they may read, without the lookups through a link they may
 * not read — [internal ref]), the `_display` labels and the timestamps. The
 * rows are expected to have been judged already — their row-level rule and
 * their lookups through a key column.
 *
 * Shared by `GET /records/:id` (one row) and the automation read and list
 * steps (every row a step returns), which hand a run each record exactly as
 * this route would answer the run's caller. The reads behind the links, the
 * lookups, the labels and the AI-compute block are each ONE query for the
 * whole set, never one per row: a list step of N records costs what a list
 * route page of N records costs.
 */
export const shapeRecordsForReader = (
  config: RecordReaderConfig,
  records: readonly Readonly<Record<string, unknown>>[]
): Effect.Effect<
  readonly GetRecordResponse[],
  DatabaseError,
  TableRepository | AuthRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    if (records.length === 0) return []
    const { app, tableName } = config
    const reader = {
      session: config.session,
      role: config.userRole,
      groups: config.userGroups ?? [],
    }
    const shaped = records.map((record) => transformForReader(config, record))
    const ids = shaped.map(({ id }) => id)

    const links = yield* readManyToManyLinks(app, tableName, ids, { reader })
    const linked = shaped.map(({ id, fields }) => ({
      id,
      fields: mergeManyToManyFields(fields, id, links),
    }))
    // A lookup through a many-to-many link to a row the reader may not read is
    // left out; one through a key column was judged on the raw row.
    const narrowed = yield* omitHiddenRecordLookups(app, tableName, linked, reader)
    const enriched = narrowed.map(({ fields }) => fields as TransformedRecord['fields'])

    // [internal ref] Phase 2: the gated top-level `_aiCompute` block — omitted for
    // non-AI tables (no read) and for records with no status rows yet.
    const aiCompute = yield* buildAiComputeProjections(app, tableName, ids)
    const labelled = yield* enrichRecordsWithRelatedLabels(
      app,
      tableName,
      ids.map((id, index) => ({
        id: String(id),
        fields: enriched[index] ?? {},
        createdAt: '',
        updatedAt: '',
      })),
      { reader: relatedReaderOf(reader), linkReader: reader }
    )

    return shaped.map(({ transformed, id }, index) =>
      toGetRecordResponse({
        id,
        transformed,
        fields: enriched[index] ?? {},
        aiCompute: aiCompute.get(String(id)),
        display: (labelled[index] as { readonly _display?: unknown } | undefined)?._display,
      })
    )
  }).pipe(Effect.withSpan('tables.shape-records-for-reader'))

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<
  GetRecordResponse,
  DatabaseError | NotFoundError | ValidationError,
  TableRepository | AuthRepository | DataSourceRepository
> {
  return Effect.gen(function* () {
    yield* refuseWhenNoSingleIdAddress(config.app, config.tableName)
    const record = yield* readRawRecord(config)
    const [shaped] = yield* shapeRecordsForReader(config, [record])
    // One row in, one record out — `shapeRecordsForReader` maps row for row.
    if (shaped === undefined) return yield* Effect.fail(new NotFoundError('Record not found'))
    return shaped
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
