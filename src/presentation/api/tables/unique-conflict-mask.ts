/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One answer for a write refused over a taken `unique` value.
 *
 * A `unique` value is unique across the whole table, records the caller may not
 * read included. The `409` naming the clash is kept for a caller who could read
 * the value on every record holding it — the very read `GET /records/:id` of
 * that record would grant: the table's read gate, its row-level read rule, and
 * the field-level read of the unique field. Anyone else is answered the `404` a
 * write out of her reach gets, body for body, and nothing is written (the write
 * was refused before this runs). A batch is answered whole: one holder out of
 * reach and the whole batch gets the `404`.
 *
 * Every records road that writes a unique column hands its answer through
 * {@link maskUnreadableUniqueConflict}: create, update (JSON and form), batch
 * create and update, upsert, import, single and batch restore. The decision is
 * the pure `decideUniqueCollisionAnswer`; this module only gathers its inputs,
 * and does so only when the answer is a unique conflict.
 */

import { Effect } from 'effect'
import {
  recordsByIdProgram,
  uniqueConflictAnswerProgram,
  type UniqueWrite,
} from '@/application/use-cases/tables/unique-conflict-answer-program'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { isUniqueConflictAnswer } from '@/presentation/api/runtime/unique-conflict-answer'
import { RESTORE_UNIQUE_CONFLICT_PREFIX } from './error-handlers'
import { guardForTable } from './row-level-guard'
import { readRuleAdmits } from './row-level-read-helpers'
import { callerReadsTable } from './table-read-gate'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/** Whether a response is the conflict a taken unique value answers. */
const isUniqueConflict = (response: Response) =>
  Effect.gen(function* () {
    if (response.status !== 409) return false
    // effect-promise: total -- an unreadable body is caught here and read as none.
    const read = yield* Effect.promise(() =>
      response
        .clone()
        .json()
        .catch(() => undefined)
    )
    const body = read as { readonly code?: unknown; readonly message?: unknown } | undefined
    if (body?.code !== 'CONFLICT' || typeof body.message !== 'string') return false
    return (
      isUniqueConflictAnswer({ code: body.code, message: body.message }) ||
      body.message.startsWith(RESTORE_UNIQUE_CONFLICT_PREFIX)
    )
  })

/** Whether the conflict may be answered to this caller as it stands. */
const callerMaySeeConflict = (c: Context, app: App, table: Table, write: UniqueWrite) =>
  Effect.gen(function* () {
    const { session, userRole, userGroups } = getTableContext(c)
    const guard = yield* guardForTable(session, { userRole, userGroups }, table, app)
    const readRule =
      guard?.current.isUnrestricted === true ? undefined : readRuleAdmits(guard, table)
    const reader = {
      role: userRole,
      groups: userGroups,
      readsTable: yield* callerReadsTable(c, app, table),
      rowReadable: readRule,
    }
    const answer = yield* Effect.result(
      uniqueConflictAnswerProgram({ session, app, table, write, reader })
    )
    return answer._tag === 'Success' && answer.success === 'conflict'
  })

/**
 * The response a write answers, with a unique conflict the caller may not see
 * replaced by the out-of-reach `404`. Any other response passes unchanged, and
 * costs nothing. `write` may be given as a program, for a road that must read
 * the written values back (a restore).
 */
export const maskUnreadableUniqueConflict = <R = never>(
  c: Context,
  app: App,
  write: UniqueWrite | Effect.Effect<UniqueWrite, never, R>,
  response: Response
) =>
  Effect.gen(function* () {
    if (!(yield* isUniqueConflict(response))) return response
    const table = app.tables?.find((t) => t.name === getTableContext(c).tableName)
    if (table === undefined) return notFound(c)
    const resolved = Effect.isEffect(write) ? yield* write : write
    return (yield* callerMaySeeConflict(c, app, table, resolved)) ? response : notFound(c)
  })

/** What restoring `ids` would write back: the stored values of the trashed records. */
export const restoredWrite = (c: Context, ids: readonly string[]) => {
  const { session, tableName } = getTableContext(c)
  return Effect.match(recordsByIdProgram({ session, tableName, ids }), {
    onFailure: (): UniqueWrite => ({ written: [], excludeIds: ids }),
    onSuccess: (written): UniqueWrite => ({ written, excludeIds: ids }),
  })
}

/** What a batch update writes: each item's fields, over the records it names. */
export const updatedWrite = (
  items: readonly { readonly id: unknown; readonly fields: Readonly<Record<string, unknown>> }[]
): UniqueWrite => ({
  written: items.map((item) => item.fields),
  excludeIds: items.map((item) => String(item.id)),
})
