/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read state on a relationship — the parent's per-reader unread counts and
 * `POST /api/tables/:table/records/:id/read`.
 *
 * A relationship declaring `readState` (a message's `channel`) makes its
 * parent's rows carry, for a signed-in reader, the number of children created
 * after her last-read position. The count is taken through the CHILD table's
 * own list — its table grant, the rows her list admits, its row-level read
 * rule — so a child she may not read is never counted (S1), and her own
 * children are left out. One grouped count per relationship answers a whole
 * page of parents. A reader without an account carries no count.
 */

import { Effect } from 'effect'
import { createListRecordsProgram } from '@/application/use-cases/tables/list-records-program'
import { rawGetRecordProgram } from '@/application/use-cases/tables/read-record-programs'
import {
  markParentReadProgram,
  readPositionsProgram,
} from '@/application/use-cases/tables/read-state-programs'
import { buildEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { markRecordReadResponseSchema } from '@/domain/models/api/tables/records'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { createdByFieldNames } from '@/domain/models/app/tables/authorship-fields'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import {
  groupedUnreadFilterOf,
  readStateCountsOf,
  type ReadStateCount,
  type UnreadParent,
} from '@/domain/models/app/tables/read-state-service'
import { logError } from '@/infrastructure/logging/logger'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
import { checkRecordReadGate } from './record-read-gate'
import { guardForTable } from './row-level-guard'
import { buildListFilter, NOT_FOUND_RESPONSE, type FilterNode } from './row-level-read-helpers'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/** The caller a count is taken for. */
interface Reader {
  readonly c: Context
  readonly app: App
}

/** The caller a field or table read is judged for. */
interface TableCaller {
  readonly role: string
  readonly groups: readonly string[]
}

/**
 * Whether the reader may count the children of `count` at all: she reads the
 * child table, and its link field — a per-parent count over a link she may not
 * read would tell her which parent each child she reads belongs to.
 */
const mayCount = (app: App, child: Table, count: ReadStateCount, reader: TableCaller): boolean =>
  hasReadPermissionForRoles(child, buildEffectiveRoles(reader.role, reader.groups), app) &&
  isFieldReadableByCaller(app, child.name, reader, count.linkField)

/**
 * How many children of each parent, linked through `count`, the reader has not
 * read, by parent id — ONE grouped count over the whole page, taken through
 * her list of the child table: its table grant, the rows her list admits, its
 * row-level read rule. A child table she may not read, or whose link field she
 * may not read, counts nothing for any parent.
 */
const countUnreadByParent = (
  reader: Reader,
  count: ReadStateCount,
  parents: readonly UnreadParent[]
) =>
  Effect.gen(function* () {
    const { app, c } = reader
    const { session, userRole, userGroups } = getTableContext(c)
    const child = app.tables?.find((table) => table.name === count.childTable)
    if (
      child === undefined ||
      !mayCount(app, child, count, { role: userRole, groups: userGroups })
    ) {
      return new Map<string, number>()
    }
    const guard = yield* guardForTable(session, { userRole, userGroups }, child, app)
    const unread = groupedUnreadFilterOf({
      linkField: count.linkField,
      childTable: child.name,
      authorField: createdByFieldNames([child], child.name)[0],
      userId: session.userId,
      parents,
    }) as readonly FilterNode[]
    const filter = buildListFilter(child, guard, undefined, { and: unread })
    if (filter === 'empty' || filter === 'reject') return new Map<string, number>()
    const page = yield* createListRecordsProgram({
      ...{ session, tableName: child.name, app, userRole, userGroups },
      filter,
      limit: 1,
      groupBy: count.linkField,
    })
    return new Map((page.groups ?? []).map((group) => [String(group.name), group.count] as const))
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[read-state] unread count failed; counting none', cause))
    ),
    // effect-swallow: a count that cannot be taken reads as nothing unread — it never reveals a row.
    Effect.orElseSucceed(() => new Map<string, number>())
  )

/**
 * The unread counts of the given parent rows for the caller, by record id —
 * empty for a table no `readState` relationship points at, and for a reader
 * without an account.
 */
export const unreadCountsOf = (reader: Reader, tableName: string, recordIds: readonly string[]) =>
  Effect.gen(function* () {
    const counts = readStateCountsOf(reader.app, tableName)
    const { session } = getTableContext(reader.c)
    if (counts.length === 0 || isGuestSession(session?.userId) || recordIds.length === 0) {
      return new Map<string, Readonly<Record<string, number>>>()
    }
    const positions = yield* readPositionsProgram({
      userId: session.userId,
      tableName,
      recordIds,
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[read-state] positions unreadable; counting from none', cause))
      ),
      // effect-swallow: without her positions every readable child counts as unread, never a hidden one.
      Effect.orElseSucceed(() => new Map<string, Date>())
    )
    const parents = recordIds.map((id) => ({ id, since: positions.get(id) }))
    const byCount = yield* Effect.forEach(counts, (count) =>
      countUnreadByParent(reader, count, parents).pipe(Effect.map((n) => [count.name, n] as const))
    )
    return new Map(
      recordIds.map(
        (recordId) =>
          [
            recordId,
            Object.fromEntries(byCount.map(([name, n]) => [name, n.get(recordId) ?? 0])),
          ] as const
      )
    )
  })

/** A record answer with the caller's unread counts merged into its `fields`. */
const withUnreadCounts = <R extends { readonly id: unknown; readonly fields: object }>(
  reader: Reader,
  tableName: string,
  records: readonly R[]
) =>
  unreadCountsOf(
    reader,
    tableName,
    records.map((record) => String(record.id))
  ).pipe(
    Effect.map((counts) =>
      records.map((record) => {
        const own = counts.get(String(record.id))
        return own === undefined ? record : { ...record, fields: { ...record.fields, ...own } }
      })
    )
  )

/** The reader of one table's rows. */
type TableReader = Reader & { readonly tableName: string }

/** Merge the caller's unread counts into a list answer's records. */
export const countsOnList =
  ({ tableName, ...reader }: TableReader) =>
  <
    A extends { readonly records: readonly { readonly id: unknown; readonly fields: object }[] },
    E,
    R,
  >(
    program: Effect.Effect<A, E, R>
  ) =>
    Effect.flatMap(program, (response) =>
      withUnreadCounts(reader, tableName, response.records).pipe(
        Effect.map((records) => ({ ...response, records }) as A)
      )
    )

/** Merge the caller's unread counts into one record's answer. */
export const countsOnRecord =
  ({ tableName, ...reader }: TableReader) =>
  <A extends { readonly id: unknown; readonly fields: object }, E, R>(
    program: Effect.Effect<A, E, R>
  ) =>
    Effect.flatMap(program, (record) =>
      withUnreadCounts(reader, tableName, [record]).pipe(
        Effect.map(([counted]) => counted ?? record)
      )
    )

/** The table a request names, by id or by name. */
const tableOf = (app: App, key: string): Table | undefined =>
  app.tables?.find((table) => String(table.id) === key || table.name === key)

/**
 * Handle `POST /api/tables/:tableId/records/:recordId/read`.
 *
 * Moves the caller's position on the record to now, then answers its counts
 * after the move. A record she may not read, a record that does not exist and
 * a table no `readState` relationship points at all answer the same 404 (S1).
 */
export async function handleMarkRecordRead(c: Context, app: App): Promise<Response> {
  const { session } = getTableContext(c)
  const recordId = c.req.param('recordId')!
  const table = tableOf(app, c.req.param('tableId')!)
  if (
    table === undefined ||
    readStateCountsOf(app, table.name).length === 0 ||
    isGuestSession(session?.userId)
  ) {
    return NOT_FOUND_RESPONSE(c)
  }
  const gateError = await checkRecordReadGate(c, app, table, recordId)
  if (gateError) return gateError

  return runHandlerEffect(
    c,
    Effect.gen(function* () {
      const record = yield* rawGetRecordProgram(session, table.name, recordId, app).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[read-state] parent unreadable; answering 404', cause))
        ),
        // effect-swallow: a parent that cannot be read is answered as one that does not exist.
        Effect.orElseSucceed(() => null)
      )
      if (record === null) return NOT_FOUND_RESPONSE(c)
      const program = markParentReadProgram({
        userId: session.userId,
        tableName: table.name,
        recordId,
      }).pipe(
        Effect.andThen(unreadCountsOf({ c, app }, table.name, [recordId])),
        Effect.map((counts) => ({ recordId, counts: counts.get(recordId) ?? {} }))
      )
      return yield* respondWith(c, program, markRecordReadResponseSchema)
    })
  )
}
