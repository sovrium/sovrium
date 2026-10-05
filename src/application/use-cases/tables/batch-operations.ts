/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  BatchRepository,
  type BatchValidationError,
} from '@/application/ports/repositories/tables/batch-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { ValidationError } from '@/domain/errors'
import { CONSTRAINT_MESSAGES } from '@/domain/errors/driver-failure'
import { isGuestSession, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  buildCreateAuthorshipOverrides,
  buildUpdateAuthorshipOverrides,
  buildCurrentUserDefaults,
  createdByFieldNames,
} from '@/domain/models/app/tables/authorship-fields'
import { normalizeDateValuesIn } from '@/domain/models/app/tables/empty-date-service'
import { omitFromWriteEchoWhenReturned } from './hidden-lookup-omission'
import { refuseUnreadableLinkTargets, type LinkTargetWrite } from './link-target-check'
import { getManyToManyFieldSpecs } from './many-to-many-fields'
import { announceRecordWrites } from './record-change-announcement'
import { splitManyToManyFields } from './record-link-enrichment'
import { transformRecords, type TransformedRecord } from './record-transformer'
import type { LinkReader } from './linked-row-visibility'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { NotFoundError, DatabaseError } from '@/domain/errors'
import type { BatchRestoreRecordsResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

/**
 * Judge every link the batch names before the batch writes anything, and answer
 * a refused one as the batch answers a reference to a missing row — the whole
 * batch refused, nothing written.
 */
const refuseBatchLinkTargets = (input: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App | undefined
  readonly writes: readonly LinkTargetWrite[]
  readonly reader: LinkReader | undefined
}): Effect.Effect<
  void,
  DatabaseError | ValidationError,
  TableRepository | DataSourceRepository | AuthRepository
> =>
  refuseUnreadableLinkTargets(input).pipe(
    Effect.catchTag('ForeignKeyViolationError', () =>
      Effect.fail(new ValidationError(CONSTRAINT_MESSAGES['foreign-key'], []))
    )
  )

/** A written row with an empty date read as "no date" (`null`), as a single write does. */
const emptyDatesAsNull = (
  fields: Readonly<Record<string, unknown>>,
  app: App | undefined,
  tableName: string
): Readonly<Record<string, unknown>> => normalizeDateValuesIn(app?.tables, tableName, fields)

/** A batch update entry whose fields read an empty date as `null`. */
const withDatedFields = <R extends { readonly fields?: Record<string, unknown> }>(
  record: R,
  app: App | undefined,
  tableName: string
): R =>
  record.fields === undefined
    ? record
    : { ...record, fields: { ...emptyDatesAsNull(record.fields, app, tableName) } }

/**
 * Create the batch's records and write their many-to-many links.
 *
 * A many-to-many field has no base column: each record's links are
 * split out of its INSERT and handed to the repository beside it, which writes
 * them to the junction once the record has its id, in the same transaction —
 * a link that cannot be written leaves no record behind.
 */
const createWithManyToManyLinks = (input: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App | undefined
  readonly recordsData: readonly Readonly<Record<string, unknown>>[]
}): Effect.Effect<
  readonly Record<string, unknown>[],
  DatabaseError | ValidationError,
  BatchRepository
> =>
  Effect.gen(function* () {
    const { session, tableName, app, recordsData } = input
    const batch = yield* BatchRepository
    const specs = getManyToManyFieldSpecs(app?.tables, tableName)
    const split = recordsData.map((fields) => splitManyToManyFields(fields, specs))
    return yield* batch.batchCreate(
      session,
      tableName,
      split.map((entry) => entry.baseFields),
      specs.length === 0 ? undefined : split.map((entry) => entry.links)
    )
  }).pipe(Effect.withSpan('tables.batch-create-with-links'))

/**
 * The rows a batch create writes, with what a single create adds to each
 * (`write-record-programs.ts`): an empty date sent as `NULL`, a `user` field
 * defaulting to `$currentUser` filled with the caller where the row leaves it
 * empty (a guest or the system actor is no person), and every
 * `created-by`/`updated-by`-typed field stamped BY NAME with the actor. The
 * infra fills only the literal `created_by`/`updated_by` columns, so without
 * the stamp a custom-named author column (NOT NULL under auth) refused every
 * batch row. A guest stamps nothing.
 */
const stampBatchCreateRows = (
  userId: string,
  app: App | undefined,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): readonly Record<string, unknown>[] => {
  const dated = recordsData.map((fields) => emptyDatesAsNull(fields, app, tableName))
  if (isGuestSession(userId)) return dated
  const overrides = buildCreateAuthorshipOverrides(app?.tables, tableName, userId)
  return dated.map((fields) => ({
    ...fields,
    ...(userId === SYSTEM_USER_ID
      ? {}
      : buildCurrentUserDefaults(app?.tables, tableName, userId, fields)),
    ...overrides,
  }))
}

/**
 * The rows a batch update writes, with what a single update adds to each: an
 * empty date sent as `NULL`, and every `updated-by`-typed field re-stamped BY
 * NAME with the actor. The infra re-stamps only the literal `updated_by`
 * column, so without it a custom-named editor column kept the previous
 * writer. A guest stamps nothing.
 */
const stampBatchUpdateRows = <R extends { readonly fields?: Record<string, unknown> }>(
  userId: string,
  app: App | undefined,
  tableName: string,
  recordsData: readonly R[]
): readonly R[] => {
  const dated = recordsData.map((record) => withDatedFields(record, app, tableName))
  if (isGuestSession(userId)) return dated
  const overrides = buildUpdateAuthorshipOverrides(app?.tables, tableName, userId)
  if (Object.keys(overrides).length === 0) return dated
  return dated.map((record) =>
    record.fields === undefined ? record : { ...record, fields: { ...record.fields, ...overrides } }
  )
}

export function batchCreateProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordsData: readonly Record<string, unknown>[]
  readonly returnRecords?: boolean
  readonly app?: App
  /** Whose read rules judge the rows the batch links to (none: existence only). */
  readonly linkReader?: LinkReader
}): Effect.Effect<
  { readonly created: number; readonly records?: readonly TransformedRecord[] },
  DatabaseError | ValidationError,
  BatchRepository | TableRepository | DataSourceRepository | AuthRepository
> {
  const { session, tableName, recordsData, returnRecords = false, app, linkReader } = config
  return Effect.gen(function* () {
    yield* refuseBatchLinkTargets({
      session,
      tableName,
      app,
      writes: recordsData.map((fields) => ({ fields })),
      reader: linkReader,
    })

    const stamped = stampBatchCreateRows(session.userId, app, tableName, recordsData)

    const createdRecords = yield* createWithManyToManyLinks({
      session,
      tableName,
      app,
      recordsData: stamped,
    })

    // The records handed back hold no more than the writer's own read of them.
    const echoed = yield* omitFromWriteEchoWhenReturned(returnRecords, {
      ...{ app, tableName, rows: createdRecords, reader: linkReader },
    })
    // Transform records to API format with app schema for numeric coercion
    const transformed = transformRecords(echoed, { app, tableName })

    // Use functional pattern to build response object
    const response: { readonly created: number; readonly records?: readonly TransformedRecord[] } =
      returnRecords
        ? {
            created: transformed.length,
            records: transformed as TransformedRecord[],
          }
        : {
            created: transformed.length,
          }

    return response
  }).pipe(announceRecordWrites(app), Effect.withSpan('tables.batch-create-program'))
}

export function batchUpdateProgram(config: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordsData: readonly {
    readonly id: string
    readonly fields?: Record<string, unknown>
  }[]
  readonly returnRecords?: boolean
  readonly app?: App
  /** Whose read rules judge the rows the batch links to (none: existence only). */
  readonly linkReader?: LinkReader
}): Effect.Effect<
  { readonly updated: number; readonly records?: readonly TransformedRecord[] },
  DatabaseError | ValidationError,
  BatchRepository | TableRepository | DataSourceRepository | AuthRepository
> {
  const { session, tableName, recordsData, returnRecords = false, app, linkReader } = config
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const repo = yield* TableRepository
    // A many-to-one key a record already holds is not a new link.
    yield* refuseBatchLinkTargets({
      session,
      tableName,
      app,
      writes: recordsData.map((record) => ({
        fields: record.fields ?? {},
        held: repo.getRecord(session, tableName, record.id),
      })),
      reader: linkReader,
    })
    const dated = stampBatchUpdateRows(session.userId, app, tableName, recordsData)
    const updatedRecords = yield* batch.batchUpdate(session, tableName, dated)

    // The records handed back hold no more than the writer's own read of them.
    const echoed = yield* omitFromWriteEchoWhenReturned(returnRecords, {
      ...{ app, tableName, rows: updatedRecords, reader: linkReader },
    })
    // Transform records to API format with app schema for numeric coercion
    const transformed = transformRecords(echoed, { app, tableName })

    // Use functional pattern to build response object
    const response: { readonly updated: number; readonly records?: readonly TransformedRecord[] } =
      returnRecords
        ? {
            updated: transformed.length,
            records: transformed as TransformedRecord[],
          }
        : {
            updated: transformed.length,
          }

    return response
  }).pipe(announceRecordWrites(app), Effect.withSpan('tables.batch-update-program'))
}

export function batchDeleteProgram(
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[],
  options: { readonly permanent?: boolean; readonly app?: App } = {}
): Effect.Effect<{ deleted: number }, DatabaseError, BatchRepository> {
  const { permanent = false, app } = options
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const deletedCount = yield* batch.batchDelete(session, tableName, ids, permanent)
    return {
      deleted: deletedCount,
    }
  }).pipe(announceRecordWrites(app), Effect.withSpan('tables.batch-delete-program'))
}

export function batchRestoreProgram(
  session: Readonly<UserSession>,
  tableName: string,
  ids: readonly string[],
  app?: App
): Effect.Effect<BatchRestoreRecordsResponse, DatabaseError | NotFoundError, BatchRepository> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    const restored = yield* batch.batchRestore(session, tableName, ids)
    return {
      success: true as const,
      restored,
    }
  }).pipe(announceRecordWrites(app), Effect.withSpan('tables.batch-restore-program'))
}

/**
 * The `$currentUser` defaults an upsert may write as insert-only: those no row
 * of the batch supplies itself. Empty for a guest or the system actor, who is
 * no person.
 *
 * Insert-only is what makes a default fill the rows the upsert CREATES and never
 * the rows it updates, so a matched row keeps the person it already names. A
 * default some row supplies explicitly is left to the rows as written, because
 * insert-only is batch-wide and would drop that row's own value from its update.
 */
const upsertCurrentUserDefaults = (
  userId: string,
  tables: App['tables'],
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): Readonly<Record<string, string>> => {
  if (isGuestSession(userId) || userId === SYSTEM_USER_ID) return {}
  const defaults = buildCurrentUserDefaults(tables, tableName, userId, {})
  return Object.fromEntries(
    Object.entries(defaults).filter(([name]) =>
      recordsData.every(
        (fields) => fields[name] === undefined || fields[name] === null || fields[name] === ''
      )
    )
  )
}

/**
 * One upsert record as the link check sees it, holding the row it would update
 * — the one its merge fields match — read only when the check needs it (a many-to-one value it would refuse), so
 * an upsert whose links are all readable reads nothing more. A record that
 * lacks a merge value, or matches no row, is a create and holds nothing.
 */
const upsertWrite =
  (
    repo: TableRepository['Service'],
    session: Readonly<UserSession>,
    tableName: string,
    fieldsToMergeOn: readonly string[]
  ) =>
  (fields: Readonly<Record<string, unknown>>): LinkTargetWrite =>
    fieldsToMergeOn.some((name) => fields[name] === undefined || fields[name] === null)
      ? { fields }
      : {
          fields,
          held: repo
            .listRecords({
              session,
              tableName,
              filter: {
                and: fieldsToMergeOn.map((name) => ({
                  field: name,
                  operator: 'equals',
                  value: fields[name],
                })),
              },
            })
            .pipe(Effect.map((rows) => rows[0])),
        }

/** Judge every link an upsert names, each update branch holding its matched row. */
const refuseUpsertLinkTargets = (
  session: Readonly<UserSession>,
  tableName: string,
  params: {
    readonly recordsData: readonly Readonly<Record<string, unknown>>[]
    readonly fieldsToMergeOn: readonly string[]
    readonly app?: App
    readonly linkReader?: LinkReader
  }
) =>
  Effect.gen(function* () {
    const toWrite = upsertWrite(yield* TableRepository, session, tableName, params.fieldsToMergeOn)
    yield* refuseBatchLinkTargets({
      ...{ session, tableName, app: params.app, reader: params.linkReader },
      writes: params.recordsData.map(toWrite),
    })
  })

export function upsertProgram(
  session: Readonly<UserSession>,
  tableName: string,
  params: {
    readonly recordsData: readonly Record<string, unknown>[]
    readonly fieldsToMergeOn: readonly string[]
    readonly returnRecords: boolean
    readonly app?: App
    /** Whose read rules judge the rows the upsert links to (none: existence only). */
    readonly linkReader?: LinkReader
  }
): Effect.Effect<
  {
    readonly records: readonly TransformedRecord[]
    readonly created: number
    readonly updated: number
  },
  DatabaseError | ValidationError | BatchValidationError,
  BatchRepository | TableRepository | DataSourceRepository | AuthRepository
> {
  return Effect.gen(function* () {
    const batch = yield* BatchRepository
    // Both branches are judged before either writes; a matched row is held, as on PATCH.
    yield* refuseUpsertLinkTargets(session, tableName, params)
    const { app } = params
    // Stamp every `created-by`/`updated-by`-typed field BY NAME, as the
    // single-record create does (`write-record-programs.ts`): the infra only
    // fills the literal `created_by`/`updated_by` columns, and the create half
    // of an upsert must satisfy a NOT NULL author column like any other create.
    // The created-by names, plus the intrinsic `created_at`/`created_by`, are
    // insert-only: a matched row keeps its original author and creation date.
    const tables = app?.tables
    const overrides = isGuestSession(session.userId)
      ? {}
      : buildCreateAuthorshipOverrides(tables, tableName, session.userId)
    const rows = params.recordsData.map((fields) => emptyDatesAsNull(fields, app, tableName))
    const defaults = upsertCurrentUserDefaults(session.userId, tables, tableName, rows)
    const recordsData = rows.map((fields) => ({ ...fields, ...overrides, ...defaults }))
    const insertOnlyFields = [
      'created_at',
      'created_by',
      ...createdByFieldNames(tables, tableName),
      ...Object.keys(defaults),
    ]
    const result = yield* batch.upsert(session, tableName, recordsData, {
      fieldsToMergeOn: params.fieldsToMergeOn,
      insertOnlyFields,
    })

    // The records handed back hold no more than the writer's own read of them.
    const echoed = yield* omitFromWriteEchoWhenReturned(params.returnRecords, {
      ...{ app, tableName, rows: result.records, reader: params.linkReader },
    })
    const records = transformRecords(echoed, { app: params.app, tableName })
    return { records, created: result.created, updated: result.updated }
  }).pipe(announceRecordWrites(params.app), Effect.withSpan('tables.upsert-program'))
}
