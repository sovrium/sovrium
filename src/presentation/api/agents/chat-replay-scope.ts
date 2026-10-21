/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The earlier exchanges a chat turn replays to the model, narrowed to what the
 * person chatting lists today.
 *
 * A conversation is stored whole, and stays so. What is REPLAYED of it is
 * judged on every turn: an exchange — a question and the answers that follow
 * it — whose answer read a table the reader no longer lists (her role changed,
 * a grant was withdrawn, her records list now admits her no row) is left out,
 * so the model is never handed what she can no longer read. The judgement is
 * by table, from the line each answer keeps per call (`StoredToolCall.table`):
 * an exchange naming no table is replayed as it is.
 */

import { logError } from '@/infrastructure/logging/logger'
import { passesChatTableGate, type ChatReader } from './chat-read-scope'
import { keepListedTables } from './chat-reader-rows'
import { projectAppTables } from './chat-table-projection'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** The parts of a stored message the replay judgement reads. */
interface JudgedMessage {
  readonly role: string
  readonly toolCalls?: ReadonlyArray<{ readonly table?: string | undefined }> | undefined
}

/** The messages cut into exchanges: each question with the answers that follow it. */
const exchangesOf = <M extends JudgedMessage>(
  messages: ReadonlyArray<M>
): ReadonlyArray<ReadonlyArray<M>> =>
  messages.reduce<ReadonlyArray<ReadonlyArray<M>>>((exchanges, message) => {
    const last = exchanges.at(-1)
    return message.role === 'user' || last === undefined
      ? [...exchanges, [message]]
      : [...exchanges.slice(0, -1), [...last, message]]
  }, [])

/** The tables an exchange's answers read. */
const tablesNamedBy = (exchange: ReadonlyArray<JudgedMessage>): ReadonlyArray<string> =>
  exchange.flatMap((message) =>
    (message.toolCalls ?? []).flatMap((call) => (call.table === undefined ? [] : [call.table]))
  )

/**
 * Which of `named` `reader` lists now: her read grant passes and her records
 * list admits her a row — the test every chat read applies. A table the app no
 * longer declares is listed by nobody.
 */
const listedOf = async (
  scope: ReplayScope,
  named: ReadonlySet<string>
): Promise<ReadonlySet<string>> => {
  const { services, app, reader } = scope
  const tables = projectAppTables(app)
  const candidates = tables.filter(
    (table) => named.has(table.name) && passesChatTableGate(app, tables, table, reader)
  )
  const listed = await keepListedTables(services, app, candidates, reader)
  return new Set(listed.map((table) => table.name))
}

/** What a replay is judged against: the app as it runs, and who is chatting. */
export interface ReplayScope {
  readonly services: DomainContext
  readonly app: App | undefined
  readonly reader: ChatReader
}

/**
 * `items` without every one naming a table `reader` does not list now, in
 * their order; an item naming no table is kept as it is. Fails closed: when
 * the judgement itself fails, the failure is logged with its cause and every
 * item naming a table is left out — an item that cannot be judged is never
 * handed back. `judged` names what is judged, for that log line.
 */
export const keepListedBy = async <T>(
  scope: ReplayScope,
  items: ReadonlyArray<T>,
  tablesOf: (item: T) => ReadonlyArray<string>,
  judged: string
): Promise<ReadonlyArray<T>> => {
  const named = new Set(items.flatMap(tablesOf))
  if (named.size === 0) return items
  const listed = await listedOf(scope, named).catch((cause: unknown) => {
    // Swallowed on purpose: the answer goes on without the items it could not judge.
    logError(`[ai-chat] judging ${judged} failed; items naming a table are left out`, cause)
    return new Set<string>()
  })
  return items.filter((item) => tablesOf(item).every((table) => listed.has(table)))
}

/**
 * `messages` without every exchange whose answer read a table `reader` does
 * not list now, in their order ({@link keepListedBy}, failing closed the same
 * way).
 */
export const keepListedExchanges = async <M extends JudgedMessage>(
  scope: ReplayScope,
  messages: ReadonlyArray<M>
): Promise<ReadonlyArray<M>> =>
  (await keepListedBy(scope, exchangesOf(messages), tablesNamedBy, 'the replayed history')).flat()
