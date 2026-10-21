/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NotFoundError } from '@/domain/errors'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import {
  isRecordKeyShaped,
  type RecordKeyShape,
} from '@/domain/models/app/tables/record-id-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import { handleBatchRestoreError } from './error-helpers'
import { callerUnlistedRows } from './readable-table-gate'
import { stripUnwritableFields } from './upsert-helpers'
import type { App } from '@/domain/models/app'
import type { FieldWriter } from '@/domain/models/app/tables/field-write-permission-service'
import type { Context } from 'hono'

/**
 * Batch bodies naming a record id that no key of the table could hold.
 *
 * The single-record routes answer such an id (`abc`, `1.5`, an integer past
 * the key's range) exactly as a key no record holds, before any query runs
 * (`rejectNonKeyRecordId`). A batch body carries its ids in the body, where
 * that middleware cannot see them, and on PostgreSQL the key cast then failed
 * inside the query: a batch update answered 500 and a batch delete or restore
 * 400, where SQLite treated the same id as missing. These helpers give a batch
 * the answer it gives a missing id — a batch update skips it, a batch delete
 * or restore is refused whole as not found.
 */

/** The items of a batch update whose id could name a record of `table`. */
export const keyShapedBatchItems = <R extends { readonly id: string | number }>(
  app: App,
  table: RecordKeyShape | undefined,
  items: readonly R[]
): readonly R[] =>
  table === undefined
    ? items
    : items.filter((item) => isRecordKeyShaped(String(item.id), table, app.auth?.scopeTables))

/** The first id of a batch that no key of `table` could hold, or `undefined`. */
export const firstNonKeyBatchId = (
  app: App,
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): string | undefined =>
  table === undefined
    ? undefined
    : ids.map(String).find((id) => !isRecordKeyShaped(id, table, app.auth?.scopeTables))

/**
 * The batch-update items a write may address, as a filter: an item whose id
 * no key could hold, or that the caller's list of the table does not admit,
 * is skipped, as a missing id is.
 */
export const addressableBatchItems = async (
  c: Context,
  app: App,
  table: RecordKeyShape | undefined,
  records: readonly { readonly id: string }[]
) => {
  const ids = records.map((record) => record.id)
  const unlisted = new Set(await runDomainPromise(c, callerUnlistedRows(c, app, ids)))
  return <R extends { readonly id: string }>(items: readonly R[]): readonly R[] =>
    keyShapedBatchItems(app, table, items).filter((item) => !unlisted.has(String(item.id)))
}

/**
 * A batch delete naming an id the caller's list of the table does not admit:
 * refused whole, as a missing id is, and nothing is deleted.
 */
export const refuseUnlistedBatchIds = async (
  c: Context,
  app: App,
  ids: readonly (string | number)[]
): Promise<Response | undefined> =>
  (await runDomainPromise(c, callerUnlistedRows(c, app, ids))).length === 0
    ? undefined
    : toErrorResponse(c, new NotFoundError('Record not found'))

/**
 * The refusal of a batch delete's targets, in the order a missing id meets
 * them: a permanent delete is an admin-equivalent role's (anyone else gets its
 * `404` and nothing is destroyed), then an id the caller's list of the table
 * does not admit is refused as a missing id is.
 */
export const refuseBatchDeleteTargets = async (
  c: Context,
  app: App,
  input: {
    readonly ids: readonly (string | number)[]
    readonly permanent: boolean
    readonly role: string
  }
): Promise<Response | undefined> =>
  input.permanent && !isAdminEquivalent(input.role, app)
    ? notFound(c)
    : refuseUnlistedBatchIds(c, app, input.ids)

/** A batch delete naming an id no key could hold: refused as a missing id is. */
export const refuseNonKeyBatchDelete = (
  c: Context,
  app: App,
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): Response | undefined =>
  firstNonKeyBatchId(app, table, ids) === undefined
    ? undefined
    : toErrorResponse(c, new NotFoundError('Record not found'))

/** A batch restore naming an id no key could hold: refused as a missing id is. */
const refuseNonKeyBatchRestore = (
  c: Context,
  app: App,
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): Response | undefined => {
  const nonKeyId = firstNonKeyBatchId(app, table, ids)
  return nonKeyId === undefined
    ? undefined
    : handleBatchRestoreError(c, new NotFoundError('Record not found', nonKeyId))
}

/**
 * A batch restore naming an id the caller's list of the table does not admit:
 * refused whole as a missing id is, naming the first such id as the restore
 * names the first missing one. An id no record holds is never one her list
 * admits, so a missing id and one she may not list answer alike, and nothing
 * is restored. A caller whose list admits every row costs no further read.
 */
const refuseUnlistedBatchRestore = async (
  c: Context,
  app: App,
  ids: readonly string[]
): Promise<Response | undefined> => {
  const unlisted = new Set(await runDomainPromise(c, callerUnlistedRows(c, app, ids)))
  const named = ids.find((id) => unlisted.has(id))
  return named === undefined
    ? undefined
    : handleBatchRestoreError(c, new NotFoundError('Record not found', named))
}

/**
 * The refusal of a batch restore's ids, as a missing id is refused: one no
 * key could hold, then one the caller's list of the table does not admit.
 */
export const refuseBatchRestoreIds = async (
  c: Context,
  app: App,
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): Promise<Response | undefined> =>
  refuseNonKeyBatchRestore(c, app, table, ids) ??
  (await refuseUnlistedBatchRestore(c, app, ids.map(String)))

/**
 * The ids a batch update names, and the change it will make to each.
 *
 * A batch may name one record more than once and the write applies every entry
 * in order, so the change checked for a record is its entries MERGED in order —
 * keying by id alone let a later entry replace an earlier one before the
 * row-level check read it. The caller passes the entries as they will be
 * written (fields the role may not write already dropped).
 */
export const batchUpdateTargets = (
  app: App,
  tableName: string,
  writer: FieldWriter,
  records: readonly { readonly id: string; readonly fields?: Record<string, unknown> }[]
) => {
  const written = stripUnwritableFields(
    app,
    tableName,
    writer,
    records.map((r) => ({ id: r.id, fields: r.fields ?? {} }))
  )
  return {
    ids: written.map((r) => r.id),
    changes: written.reduce<ReadonlyMap<string, Readonly<Record<string, unknown>>>>(
      (merged, r) =>
        new Map([...merged, [String(r.id), { ...(merged.get(String(r.id)) ?? {}), ...r.fields }]]),
      new Map()
    ),
  }
}
