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

import { parseQueryIntent } from '@/domain/services/ai-chat/ai-chat-query-parser'
import { runQuery, type QueryTableWithPerms } from './chat-query'
import { projectAppTables } from './chat-table-projection'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { ContextPageScope } from '@/domain/services/ai-chat/ai-chat-context'

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
  readonly app: App | undefined
  readonly message: string
  readonly sessionId: string
  /** The acting user's role — drives table-level read RBAC. */
  readonly userRole: string
  /** Role + `group:<name>` overlay the read gate is actually evaluated against. */
  readonly effectiveRoles: readonly string[]
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
 * Evaluate a chat turn for a read query.
 *
 * Resolution order:
 *  1. Parse the message for a query intent (using the session's prior table as
 *     a fallback for follow-up questions).
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
  //.
  const fallback =
    lastQueriedTable.get(input.sessionId) ?? (tables.length === 1 ? tables[0]?.name : undefined)
  const intent = parseQueryIntent(input.message, tables, fallback)
  if (intent === undefined) return { kind: 'none' }

  const outcome = await runQuery({
    intent,
    userRole: input.userRole,
    effectiveRoles: input.effectiveRoles,
    tables,
  })
  if (outcome.status === 'forbidden') {
    return { kind: 'forbidden', message: outcome.message }
  }
  // Remember the table so a follow-up on this session can reuse it.
  // eslint-disable-next-line functional/no-expression-statements, functional/immutable-data -- module-local mutable Map, mirrors conversation store
  lastQueriedTable.set(input.sessionId, intent.table)
  return { kind: 'answered', action: outcome.action, reply: outcome.reply }
}
