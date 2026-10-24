/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat read-query flow.
 *
 * Bridges the generic `/api/ai/chat` route to the {@link parseQueryIntent}
 * domain parser and the {@link runQuery} executor — the orchestration layer
 * for `[internal ref]`.
 *
 * A chat turn is a *query turn* when the user message parses to a recognised
 * read-query intent against a table the request may reach. `evaluateQueryTurn`
 * returns a {@link QueryTurnResult} describing how the route should respond; a
 * `kind: 'none'` result means the turn is a plain chat turn with no query, and
 * the route proceeds as before (or evaluates a mutation).
 *
 * Page scoping: when the request carries a
 * `pageContext.allowedTables`, the table list visible to the query is narrowed
 * to that allow-list before parsing — exactly the same narrowing the context
 * builder applies to the system prompt.
 *
 * Follow-up context: the last table queried on a
 * session is remembered in a module-level Map so a follow-up message that
 * names no table ("Now filter by high priority") resolves to it.
 */

import { parseQueryIntent } from '@/domain/models/app/agents/ai-chat-query-parser'
import { rowsGrantOpensField } from '@/domain/models/app/tables/row-read-admission-service'
import { runQuery, type QueryTableWithPerms } from './chat-query'
import { chatReadableColumns, type ChatReader } from './chat-read-scope'
import { chatReaderRows, isSignedOut } from './chat-reader-rows'
import { projectAppTables } from './chat-table-projection'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { ContextPageScope } from '@/domain/models/app/agents/ai-chat-context'
import type { QueryIntent } from '@/domain/models/app/agents/ai-chat-query-parser'
import type { DomainContext } from '@/infrastructure/logging/request-effect'

/** The route-facing result of evaluating a turn for a read query. */
export type QueryTurnResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'forbidden'; readonly message: string }
  | {
      readonly kind: 'answered'
      readonly action: ChatAction
      readonly reply: string
    }

/** Inputs for evaluating a chat turn against the read-query pipeline. */
export interface QueryTurnInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly app: App | undefined
  readonly message: string
  readonly sessionId: string
  /** Who the query reads as — see `ChatReader`. */
  readonly reader: ChatReader
  /** Optional page scope narrowing the visible table list (allowedTables). */
  readonly pageContext?: ContextPageScope | undefined
}

/**
 * Module-level per-session "last queried table" store. Same ephemeral-Map
 * discipline as the conversation store — a follow-up question reuses the
 * session's prior table when its own message names none.
 */
const lastQueriedTable = new Map<string, string>()

/**
 * Project `app.tables[]` onto the minimal query-table shape — the shared
 * {@link projectAppTables} projection. When `pageContext.allowedTables` is
 * present, only tables on that allow-list are kept.
 */
const toQueryTables = (
  app: App | undefined,
  pageContext: ContextPageScope | undefined
): ReadonlyArray<QueryTableWithPerms> =>
  projectAppTables(app, {
    ...(pageContext?.allowedTables !== undefined && {
      allowedTables: pageContext.allowedTables,
    }),
  })

/**
 * The fields of `table` a chat query may name for `reader` — filter on, sort
 * by, total or average: those she may read (`chatReadableColumns`), and those
 * a per-record grant shows her on at least one row her records list admits
 * (`rowsGrantOpensField`); a query naming one of those runs over the rows it
 * is shown on ({@link grantOpenedRowsOf}). A field she may not read narrows,
 * orders and sums nothing.
 */
const queryableFieldsOf = async (
  input: QueryTurnInput,
  table: QueryTableWithPerms
): Promise<QueryTableWithPerms> => {
  const opened = await grantOpenedFields(input, table)
  return { ...table, fields: table.fields.filter((field) => opened(field.name) !== undefined) }
}

/**
 * For each field of `table`: `'own-role'` when the reader reads it herself,
 * the rows a per-record grant shows it to her on otherwise (none: `undefined`).
 */
const grantOpenedFields = async (
  input: QueryTurnInput,
  table: QueryTableWithPerms
): Promise<(field: string) => 'own-role' | readonly string[] | undefined> => {
  const { app, reader } = input
  const readable = new Set(chatReadableColumns(app, table, reader).readableColumns)
  const rows =
    reader.answering === undefined
      ? await chatReaderRows(input.services, app, table.name, reader)
      : undefined
  const related = { role: reader.role, groups: reader.groups, signedOut: isSignedOut(reader) }
  return (field) => {
    if (readable.has(field)) return 'own-role'
    if (app === undefined || rows === undefined) return undefined
    const opened = rowsGrantOpensField({ app, tableName: table.name, reader: related }, rows, field)
    return opened === 'own-role' || opened.length > 0 ? opened : undefined
  }
}

/**
 * The rows a query over `intent` may run over when a per-record grant alone
 * opens a field it names: the rows every such field is shown on. `undefined`
 * when the reader reads each named field herself.
 */
const grantOpenedRowsOf = async (
  input: QueryTurnInput,
  table: QueryTableWithPerms,
  intent: QueryIntent
): Promise<readonly string[] | undefined> => {
  const opened = await grantOpenedFields(input, table)
  const named = [intent.aggregateColumn, intent.filter?.column, intent.sortColumn].filter(
    (field): field is string => field !== undefined
  )
  const lists = named
    .map(opened)
    .filter((rows): rows is readonly string[] => rows !== undefined && rows !== 'own-role')
  if (lists.length === 0) return undefined
  return lists.reduce((shared, rows) => shared.filter((id) => rows.includes(id)))
}

/**
 * Evaluate a chat turn for a read query.
 *
 * Resolution order:
 *  1. Parse the message for a query intent (using the session's prior table as
 *     a fallback for follow-up questions), over the fields of its table the
 *     reader may name ({@link queryableFieldsOf}).
 *  2. No query intent → `kind: 'none'` (plain / mutation turn).
 *  3. Run the query — a `forbidden` outcome maps to HTTP 403, an `answered`
 *     outcome carries the reply text and `type: 'query'` action.
 */
export const evaluateQueryTurn = async (input: QueryTurnInput): Promise<QueryTurnResult> => {
  const tables = toQueryTables(input.app, input.pageContext)
  if (tables.length === 0) return { kind: 'none' }

  // Fallback table for a message that names none: the session's prior table,
  // or — when a page scope narrows the visible list to exactly one table — that
  // sole table, so "Show all records" on a single-table page resolves
  const fallback =
    lastQueriedTable.get(input.sessionId) ?? (tables.length === 1 ? tables[0]?.name : undefined)
  const named = parseQueryIntent(input.message, tables, fallback)
  if (named === undefined) return { kind: 'none' }
  // The table is named by its name alone; the query is then read off the
  // fields its reader may name in it, so a field she may not read filters,
  // orders and sums nothing.
  const queryable = await Promise.all(
    tables.map((table) => (table.name === named.table ? queryableFieldsOf(input, table) : table))
  )
  const intent = parseQueryIntent(input.message, queryable, fallback)
  if (intent === undefined) return { kind: 'none' }

  const target = queryable.find((table) => table.name === intent.table)
  const outcome = await runQuery({
    services: input.services,
    intent,
    app: input.app,
    reader: input.reader,
    tables: queryable,
    fieldRows: target === undefined ? undefined : await grantOpenedRowsOf(input, target, intent),
  })
  if (outcome.status === 'forbidden') {
    return { kind: 'forbidden', message: outcome.message }
  }
  // Remember the table so a follow-up on this session can reuse it.
  lastQueriedTable.set(input.sessionId, intent.table)
  return { kind: 'answered', action: outcome.action, reply: outcome.reply }
}
