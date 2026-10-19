/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a write refused over a taken `unique` value may answer its caller.
 *
 * Gathers the inputs of the pure `decideUniqueCollisionAnswer` — the stored
 * records holding the written values, read without any read rule, each judged
 * by the caller's own row-level read rule — and asks it. Nothing read here is
 * answered to the caller: only whether she could read it.
 *
 * Both transports that write records ask it: the records API
 * (`unique-conflict-mask.ts`) and the agent tools (`mcp/write-calls.ts`). Each
 * passes the judgements only it can make — whether the caller passes the
 * table's read gate, and how the row-level read rule reads a stored row for her.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import {
  collidingFieldsOf,
  decideUniqueCollisionAnswer,
  requestRepeatsUniqueValue,
  singleUniqueFieldsOf,
  uniqueCollisionNeedsHolders,
  uniqueInvolvedFieldsOf,
  uniqueProbesOf,
  type UniqueCollisionAnswer,
  type UniqueProbe,
} from '@/domain/models/app/tables/unique-collision-visibility-service'
import { logError } from '@/infrastructure/logging/logger'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'

/** What a refused write wrote, as far as uniqueness goes. */
export interface UniqueWrite {
  /** The field values of every record the request writes. */
  readonly written: readonly Readonly<Record<string, unknown>>[]
  /** The stored records the request itself addresses (an update, a restore). */
  readonly excludeIds?: readonly string[]
}

/** Who made the refused write, as the transport judged her. */
export interface UniqueConflictReader {
  readonly role: string
  readonly groups: readonly string[]
  /** She passes the table's read gate. */
  readonly readsTable: boolean
  /**
   * The row-level read rule as it reads a stored row for her, or `undefined`
   * when no rule narrows what she reads.
   */
  readonly rowReadable: ((row: Readonly<Record<string, unknown>>) => boolean) | undefined
}

/** The live records holding one of the probed values, less the ones the write addresses. */
const holdersOf = (
  session: Readonly<UserSession>,
  tableName: string,
  lookup: { readonly probes: readonly UniqueProbe[]; readonly excludeIds: readonly string[] }
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const { probes, excludeIds } = lookup
    if (probes.length === 0) return []
    const repo = yield* TableRepository
    const held: QueryFilterNode = {
      or: probes.map((probe) => ({ field: probe.field, operator: 'in', value: probe.values })),
    }
    const others: readonly QueryFilterNode[] =
      excludeIds.length === 0 ? [] : [{ field: 'id', operator: 'notIn', value: excludeIds }]
    return yield* repo.listRecords({ session, tableName, filter: { and: [held, ...others] } })
  })

/** The holders a decision needs, or `undefined` when none is needed. */
const holdersWhenNeeded = (
  input: {
    readonly session: Readonly<UserSession>
    readonly table: Table
    readonly write: UniqueWrite
  },
  lookup: { readonly needed: boolean; readonly probes: readonly UniqueProbe[] }
): Effect.Effect<readonly Record<string, unknown>[] | undefined, never, TableRepository> => {
  if (!lookup.needed) return Effect.undefined
  return holdersOf(input.session, input.table.name, {
    probes: lookup.probes,
    excludeIds: input.write.excludeIds ?? [],
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[records] the records holding a refused unique value could not be read', cause)
      )
    ),
    // effect-swallow: a lookup that fails cannot place the collision, which answers as one that found nothing — the out-of-reach refusal, never the conflict.
    Effect.orElseSucceed((): readonly Record<string, unknown>[] => [])
  )
}

/** The answer `reader` gets for a write to `table` refused over a taken unique value. */
export const uniqueConflictAnswerProgram = (input: {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly table: Table
  readonly write: UniqueWrite
  readonly reader: UniqueConflictReader
}): Effect.Effect<UniqueCollisionAnswer, never, TableRepository> =>
  Effect.gen(function* () {
    const { app, table, write, reader } = input
    const fieldReadable = (field: string) =>
      isFieldReadableByCaller(app, table.name, { role: reader.role, groups: reader.groups }, field)
    const uniqueFields = singleUniqueFieldsOf(table)
    const probes = uniqueProbesOf(uniqueFields, write.written)
    const needed = uniqueCollisionNeedsHolders({
      rowScoped: reader.rowReadable !== undefined,
      involvedFields: uniqueInvolvedFieldsOf(table).filter((field) =>
        write.written.some((record) => field in record)
      ),
      fieldReadable,
    })
    const rows = yield* holdersWhenNeeded(input, { needed, probes })
    const rowReadable = reader.rowReadable ?? (() => true)
    return decideUniqueCollisionAnswer({
      callerReadsEverything: isAdminEquivalent(reader.role, app),
      tableReadable: reader.readsTable,
      probes,
      fieldReadable,
      holders: rows?.map((row) => ({
        rowReadable: rowReadable(row),
        fields: collidingFieldsOf(row, probes),
      })),
      requestRepeats: requestRepeatsUniqueValue(uniqueFields, write.written),
    })
  }).pipe(Effect.withSpan('tables.unique-conflict-answer-program'))

/** The stored rows of `ids`, trashed ones included — what a restore would bring back. */
export const recordsByIdProgram = (input: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly ids: readonly string[]
}): Effect.Effect<readonly Record<string, unknown>[], DatabaseError, TableRepository> =>
  Effect.gen(function* () {
    const { session, tableName, ids } = input
    if (ids.length === 0) return []
    const repo = yield* TableRepository
    return yield* repo.listRecords({
      session,
      tableName,
      includeDeleted: true,
      filter: { and: [{ field: 'id', operator: 'in', value: ids }] },
    })
  }).pipe(Effect.withSpan('tables.records-by-id-program'))
