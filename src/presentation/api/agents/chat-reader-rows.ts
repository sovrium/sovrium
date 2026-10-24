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

import { Effect } from 'effect'
import {
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { readerRowsOf, type ReaderRows } from '@/application/use-cases/tables/row-read-admission'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** The parts of a chat reader the list's admission is asked about. */
export interface AdmissionReader {
  readonly role: string
  readonly groups: readonly string[]
  /** The signed-in user; absent for no one. */
  readonly userId?: string | undefined
  /** True for a declared agent, which reads under its declared role. */
  readonly agent?: boolean | undefined
  /** The person a declared agent answers, whose list narrows what it names. */
  readonly answering?: AdmissionReader | undefined
}

/** True for a visitor signed in to nothing: no role, no identity, not an agent. */
export const isSignedOut = (reader: AdmissionReader): boolean =>
  reader.role === '' && reader.agent !== true && reader.userId === undefined

/** One answer kept for the turn, with the config it was read under. */
interface TurnRows {
  readonly app: App | undefined
  readonly read: Promise<ReaderRows | undefined>
}

/**
 * The answers already read this turn, per reader and table. A turn builds its
 * reader once and hands that same object to every step — the context, the
 * tools, the query and write parsers, the history replay — so keying on it
 * reads her grants once per turn; the next turn builds a new reader and reads
 * them afresh, and a finished turn's answers go with its reader. A reader must
 * therefore never be shared between turns (`signedOutReader` is built per
 * call); as a second fence, an answer read under another config (a reload
 * mid-turn) is read again, and a failed read is never kept.
 */
const turnRows = new WeakMap<AdmissionReader, Map<string, TurnRows>>()

/**
 * The rows of `tableName` the records list admits `reader` and the grants
 * behind them — asked for a person, signed in or not, once per turn
 * ({@link turnRows}). A declared agent reads with the reach its config gives
 * it, so `undefined` (as for a reader with no identity at all).
 */
export const chatReaderRows = (
  services: DomainContext,
  app: App | undefined,
  tableName: string,
  reader: AdmissionReader
): Promise<ReaderRows | undefined> => {
  const known = turnRows.get(reader) ?? new Map<string, TurnRows>()
  const cached = known.get(tableName)
  if (cached !== undefined && cached.app === app) return cached.read
  const read = readChatReaderRows(services, app, tableName, reader)
  known.set(tableName, { app, read })
  turnRows.set(reader, known)
  read.catch(() => {
    if (known.get(tableName)?.read === read) known.delete(tableName)
  })
  return read
}

/** One read of {@link chatReaderRows}, uncached. */
const readChatReaderRows = async (
  services: DomainContext,
  app: App | undefined,
  tableName: string,
  reader: AdmissionReader
): Promise<ReaderRows | undefined> => {
  if (app === undefined || reader.agent === true) return undefined
  const signedOut = isSignedOut(reader)
  if (reader.userId === undefined && !signedOut) return undefined
  const session =
    reader.userId === undefined ? buildGuestSession() : buildSyntheticSession(reader.userId)
  const role = signedOut ? 'guest' : reader.role
  return Effect.runPromise(
    readerRowsOf(app, tableName, { session, role, groups: reader.groups }).pipe(
      Effect.provide(services)
    )
  )
}

/**
 * True unless the records list admits `reader` no row of `tableName` — or, for
 * an agent answering a person, admits her none. The chat names no such table:
 * not in its context, not among the tools it offers the model, since the list
 * answers her as one that does not exist.
 */
export const chatReaderListsTable = async (
  services: DomainContext,
  app: App | undefined,
  tableName: string,
  reader: AdmissionReader
): Promise<boolean> => {
  const rows = await chatReaderRows(services, app, tableName, reader)
  if (rows?.admission.kind === 'no-row') return false
  return (
    reader.answering === undefined ||
    chatReaderListsTable(services, app, tableName, reader.answering)
  )
}

/** The `tables` {@link chatReaderListsTable} keeps, in their order. */
export const keepListedTables = async <T extends { readonly name: string }>(
  services: DomainContext,
  app: App | undefined,
  tables: ReadonlyArray<T>,
  reader: AdmissionReader
): Promise<ReadonlyArray<T>> => {
  const listed = await Promise.all(
    tables.map((table) => chatReaderListsTable(services, app, table.name, reader))
  )
  return tables.filter((_, index) => listed[index] === true)
}
