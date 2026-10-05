/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The records read gate, applied to the hits of a RAG search.
 *
 * A hit drawn from a table names its row (`table:<name>:<recordId>:<chunk>`)
 * and carries that row's text, so it answers to the gate a records-API read of
 * the row answers to — asked exactly as a chat read asks it, never re-derived:
 *
 *  - the table, through {@link passesChatTableGate}: the effective roles the
 *    records route builds — account role, `group:` memberships and, on a table
 *    with row-level rules, every role an assignment (`user_access`) gives her;
 *  - the rows, through {@link resolveChatRowScope} and {@link readScopeOf}: her
 *    row-level read rule over the live rows. The hits' rows are read back
 *    through that scope, and a hit whose row does not come back is dropped —
 *    hidden by the rule, moved to the trash, or gone.
 *
 * The two halves ship together: the assignment roles open a table to a caller
 * the account role alone never admitted, and only the row rule keeps that
 * caller to her own rows.
 *
 *  - the fields, through {@link chatReadableColumns}: a table chunk records the
 *    names of the fields whose values it holds (ingest cuts one chunk sequence
 *    per group of fields sharing one read grant), and it is served only when
 *    the reader may read EVERY one of them under the running config. A chunk's
 *    text is fixed at ingest and cannot be masked here, so the whole chunk goes.
 *
 * A chunk with no table (an operator knowledge document) carries no record and
 * passes. A chunk naming a table the app no longer declares is unattributable
 * and is dropped. A table chunk that records no fields — every chunk written
 * before chunks recorded them — or names a field the table no longer declares
 * is unreadable to everyone, and is dropped too: the boot rebuild replaces it.
 */

import { Effect } from 'effect'
import { listDynamicRecords } from '@/application/use-cases/ai/dynamic-record-query'
import {
  chunkHoldsOnlyReadable,
  rowOfSourceRef,
} from '@/domain/models/app/agents/rag-chunk-read-gate'
import { logError } from '@/infrastructure/logging/logger'
import {
  chatReadableColumns,
  passesChatTableGate,
  readScopeOf,
  resolveChatRowScope,
  type ChatReader,
} from './chat-read-scope'
import { projectAppTables } from './chat-table-projection'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** What a reader may be served of one table: its rows, by id, and its fields. */
interface ReadableSlice {
  readonly recordIds: ReadonlySet<string>
  readonly fields: ReadonlySet<string>
}

const NOTHING_READABLE: ReadableSlice = { recordIds: new Set(), fields: new Set() }

/**
 * The fields of `tableName` the reader may read, as the records API answers
 * her: her effective roles, groups and assignment roles over the field grants.
 */
const readableFields = (app: App, tableName: string, reader: ChatReader): ReadonlySet<string> => {
  const projected = projectAppTables(app, { allowedTables: [tableName] })[0]
  return projected === undefined
    ? new Set()
    : new Set(chatReadableColumns(app, projected, reader).readableColumns)
}

/**
 * The ids, among `recordIds`, of the rows of `tableName` the reader may read
 * (empty when the table is refused her, or her rule admits no row), and the
 * fields of that table she may read.
 */
const readableSlice = async (input: {
  readonly services: DomainContext
  readonly app: App
  readonly reader: ChatReader
  readonly tableName: string
  readonly recordIds: readonly string[]
}): Promise<ReadableSlice> => {
  const { app, reader, tableName } = input
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined || !passesChatTableGate(app, app.tables ?? [], table, reader)) {
    return NOTHING_READABLE
  }
  return {
    recordIds: await readableRecordIds(input),
    fields: readableFields(app, tableName, reader),
  }
}

/** The ids, among `recordIds`, of the rows of `tableName` the reader may read. */
const readableRecordIds = async (input: {
  readonly services: DomainContext
  readonly app: App
  readonly reader: ChatReader
  readonly tableName: string
  readonly recordIds: readonly string[]
}): Promise<ReadonlySet<string>> => {
  const { services, app, reader, tableName, recordIds } = input
  const scope = await resolveChatRowScope(services, app, tableName, reader)
  if (scope.kind === 'refused' || scope.kind === 'nothing') return new Set()
  const rows = await Effect.runPromise(
    listDynamicRecords({
      table: tableName,
      columns: ['id'],
      conditions: [{ column: 'id', operator: 'in', value: recordIds }],
      limit: recordIds.length,
      ...readScopeOf(scope),
    }).pipe(
      Effect.provide(services),
      // A scope that cannot be read back refuses the hits, as the records API
      // refuses a read it cannot judge: logged, never guessed (E6).
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[ai-rag] reading the hits back through the read gate failed', cause, {
            table: tableName,
          })
        })
      ),
      Effect.orElseSucceed((): ReadonlyArray<Record<string, unknown>> => [])
    )
  )
  return new Set(rows.map((row) => String(row['id'])))
}

/**
 * A table chunk is served only when it names the fields it holds and every one
 * of them is in `fields`. A chunk that names none is unreadable.
 */
const holdsOnly = (
  chunkFields: ReadonlyArray<string> | undefined,
  fields: ReadonlySet<string>
): boolean => chunkHoldsOnlyReadable(chunkFields, (field) => fields.has(field))

/**
 * Keep the hits a table chunk could be served from at all, judged by the
 * running config alone: its table is declared and it names fields that table
 * declares. Applied where no caller is judged (an app with no `auth`), so a
 * chunk written before chunks recorded their fields is never served there
 * either.
 */
export const filterServableHits = <
  T extends {
    readonly sourceRef: string | null
    readonly fields?: ReadonlyArray<string> | undefined
  },
>(
  app: App | undefined,
  results: readonly T[]
): readonly T[] =>
  results.filter((result) => {
    const row = rowOfSourceRef(result.sourceRef)
    if (row === undefined) return true
    const table = app?.tables?.find((candidate) => candidate.name === row.table)
    return (
      table !== undefined &&
      holdsOnly(result.fields, new Set(table.fields.map((field) => field.name)))
    )
  })

/**
 * Keep the hits whose row `reader` may read through the records read gate, and
 * whose every recorded field she may read.
 */
export const filterHitsThroughReadGate = async <
  T extends {
    readonly sourceRef: string | null
    readonly fields?: ReadonlyArray<string> | undefined
  },
>(input: {
  readonly services: DomainContext
  readonly app: App
  readonly reader: ChatReader
  readonly results: readonly T[]
}): Promise<readonly T[]> => {
  const { services, app, reader, results } = input
  const rowsByTable = results
    .map((result) => rowOfSourceRef(result.sourceRef))
    .filter((row) => row !== undefined)
    .reduce<Readonly<Record<string, readonly string[]>>>(
      (acc, row) => ({ ...acc, [row.table]: [...(acc[row.table] ?? []), row.recordId] }),
      {}
    )
  const admitted = Object.fromEntries(
    await Promise.all(
      Object.entries(rowsByTable).map(
        async ([tableName, recordIds]) =>
          [
            tableName,
            await readableSlice({
              services,
              app,
              reader,
              tableName,
              recordIds: [...new Set(recordIds)],
            }),
          ] as const
      )
    )
  )
  return results.filter((result) => {
    const row = rowOfSourceRef(result.sourceRef)
    if (row === undefined) return true
    const slice = admitted[row.table]
    return (
      slice !== undefined &&
      slice.recordIds.has(row.recordId) &&
      holdsOnly(result.fields, slice.fields)
    )
  })
}
