/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { NotFoundError } from '@/domain/errors'
import {
  isRecordKeyShaped,
  type RecordKeyShape,
} from '@/domain/models/app/tables/record-id-service'
import { toErrorResponse } from '@/presentation/api/runtime/run-effect'
import { handleBatchRestoreError } from './error-helpers'
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
  table: RecordKeyShape | undefined,
  items: readonly R[]
): readonly R[] =>
  table === undefined ? items : items.filter((item) => isRecordKeyShaped(String(item.id), table))

/** The first id of a batch that no key of `table` could hold, or `undefined`. */
export const firstNonKeyBatchId = (
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): string | undefined =>
  table === undefined ? undefined : ids.map(String).find((id) => !isRecordKeyShaped(id, table))

/** A batch delete naming an id no key could hold: refused as a missing id is. */
export const refuseNonKeyBatchDelete = (
  c: Context,
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): Response | undefined =>
  firstNonKeyBatchId(table, ids) === undefined
    ? undefined
    : toErrorResponse(c, new NotFoundError('Record not found'))

/** A batch restore naming an id no key could hold: refused as a missing id is. */
export const refuseNonKeyBatchRestore = (
  c: Context,
  table: RecordKeyShape | undefined,
  ids: readonly (string | number)[]
): Response | undefined => {
  const nonKeyId = firstNonKeyBatchId(table, ids)
  return nonKeyId === undefined
    ? undefined
    : handleBatchRestoreError(c, new NotFoundError('Record not found', nonKeyId))
}

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
