/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a table the records list admits the person a chat read answers
 * to (`readerRowsOf`, the list's own answer): every row, the rows a grant
 * admits on a table whose fields her role may not read, or none at all. A chat
 * count, total, list or tool reads those rows and no other, so it agrees with
 * the list she would be served.
 */

import { Context, Effect } from 'effect'
import {
  admitChatReaderRows,
  type AdmissionReader,
} from '@/application/use-cases/agents/chat-turn/reader-rows'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { ReaderRows } from '@/application/use-cases/tables/row-read-admission'
import type { App } from '@/domain/models/app'

/** One answer kept for the turn, with the config it was read under. */
interface TurnRows {
  readonly app: App | undefined
  readonly read: Effect.Effect<ReaderRows | undefined, never, DataSourceRepository>
}

/** The answers one turn already read, per reader and table. */
type TurnReads = Map<AdmissionReader, Map<string, TurnRows>>

/**
 * The answers already read in the running turn, per reader and table — none
 * outside a turn, where every read is made afresh. A turn hands one reader
 * object to every step — the context, the tools, the query and write parsers,
 * the history replay — so keying on it reads her grants once per turn; the
 * store goes with the turn's program ({@link withChatTurnReads}). As a second
 * fence, an answer read under another config (a reload mid-turn) is read
 * again, and a failed read is never kept.
 */
const ChatTurnReads = Context.Reference<TurnReads | undefined>('sovrium/ChatTurnReads', {
  defaultValue: () => undefined,
})

/** Run `program` as one turn: the rows each reader is admitted are read once in it. */
export const withChatTurnReads = <A, E, R>(
  program: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.suspend(() => Effect.provideService(program, ChatTurnReads, new Map()))

/** One read of {@link chatReaderRows}, kept in the turn's store until it fails. */
const keptRead = (
  reads: TurnReads,
  input: {
    readonly app: App | undefined
    readonly tableName: string
    readonly reader: AdmissionReader
  }
): Effect.Effect<ReaderRows | undefined, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const known = reads.get(input.reader) ?? new Map<string, TurnRows>()
    const cached = known.get(input.tableName)
    if (cached !== undefined && cached.app === input.app) return yield* cached.read
    const shared = yield* Effect.cached(admitChatReaderRows(input))
    const read: TurnRows['read'] = shared.pipe(
      Effect.onError(() =>
        Effect.sync(() => {
          if (known.get(input.tableName)?.read === read) known.delete(input.tableName)
        })
      )
    )
    known.set(input.tableName, { app: input.app, read })
    reads.set(input.reader, known)
    return yield* read
  })

/**
 * The rows of `tableName` the records list admits `reader` and the grants
 * behind them — asked for a person, signed in or not, once per turn
 * ({@link withChatTurnReads}). A declared agent reads with the reach its
 * config gives it, so `undefined` (as for a reader with no identity at all).
 */
export const chatReaderRows = (
  app: App | undefined,
  tableName: string,
  reader: AdmissionReader
): Effect.Effect<ReaderRows | undefined, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const reads = yield* ChatTurnReads
    return yield* reads === undefined
      ? admitChatReaderRows({ app, tableName, reader })
      : keptRead(reads, { app, tableName, reader })
  })

/**
 * True unless the records list admits `reader` no row of `tableName` — or, for
 * an agent answering a person, admits her none. The chat names no such table:
 * not in its context, not among the tools it offers the model, since the list
 * answers her as one that does not exist.
 */
export const chatReaderListsTable = (
  app: App | undefined,
  tableName: string,
  reader: AdmissionReader
): Effect.Effect<boolean, never, DataSourceRepository> =>
  Effect.gen(function* () {
    const rows = yield* chatReaderRows(app, tableName, reader)
    if (rows?.admission.kind === 'no-row') return false
    return (
      reader.answering === undefined ||
      (yield* chatReaderListsTable(app, tableName, reader.answering))
    )
  })

/** The `tables` {@link chatReaderListsTable} keeps, in their order. */
export const keepListedTables = <T extends { readonly name: string }>(
  app: App | undefined,
  tables: ReadonlyArray<T>,
  reader: AdmissionReader
): Effect.Effect<ReadonlyArray<T>, never, DataSourceRepository> =>
  Effect.forEach(tables, (table) => chatReaderListsTable(app, table.name, reader), {
    concurrency: 'unbounded',
  }).pipe(Effect.map((listed) => tables.filter((_, index) => listed[index] === true)))
