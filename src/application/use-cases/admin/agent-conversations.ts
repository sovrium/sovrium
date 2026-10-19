/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the **Agents Conversations** admin read endpoint family
 * (`GET /api/admin/agents/:name/conversations` + `.../:id`).
 *
 * The application layer owns ALL pure logic:
 *   - the opaque cursor encode/decode pair (base64 of `{ value, id }`, where
 *     `value` is the last row's `updatedAt` ISO — the `(updatedAt, id)` tuple the
 *     newest-first scan + cursor seek on),
 *   - conversation list-item + transcript-message building (dialect-native
 *     `updatedAt` / `createdAt` → ISO 8601 coercion),
 *   - deriving `hasMore` / `nextCursor` from the `limit + 1` fetch,
 *   - the agent-ownership 404 (the detail use case maps a `getConversation`
 *     miss to `NotFound`),
 *   - assembling + response-schema-validating both bodies.
 *
 * Only the raw `ai_conversations` / `ai_messages` reads live in the
 * infrastructure repository, accessed via {@link AdminAgentConversationsRepository}.
 * The audit emits (`agent.conversation.{list|detail}.queried`) stay in the route
 * after a successful read.
 */

import { Effect } from 'effect'
import {
  AdminAgentConversationsRepository,
  type AdminAgentConversationRow,
  type AdminAgentMessageRow,
  type AdminAgentConversationsDatabaseError,
  type AdminAgentConversationsListFilters,
} from '@/application/ports/repositories/agents/admin-agent-conversations-repository'
import {
  agentConversationsListResponseSchema,
  agentConversationDetailResponseSchema,
  type AgentConversationListItem,
  type AgentConversationMessage,
  type AgentConversationHeader,
} from '@/domain/models/api/admin/agents/conversations'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { withTableLabels } from '@/domain/models/app/agents/stored-tool-call-service'
import { serverNow } from '@/domain/models/process-env/dev-clock'

/** A declared table's label as the console prints it, or `undefined` for an undeclared one. */
export type TableLabelOf = (table: string) => string | undefined

// ─── Pure coercion helpers ───────────────────────────────────────────────────

/** Coerce a dialect-native timestamp to an ISO 8601 string. */
function toIso(raw: Readonly<Date> | string): string {
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

/**
 * Build a canonical conversation list item from a raw row. Pure — the row is
 * supplied by the caller (sourced via the repository). Names the owner by id
 * and display name; omits their email, `agentId` and `metadata` by
 * construction (the row never carried them — S4).
 */
function buildConversationItem(row: AdminAgentConversationRow): AgentConversationListItem {
  return {
    id: row.id,
    title: row.title,
    sessionId: row.sessionId,
    userId: row.userId,
    userName: row.userName,
    messageCount: row.messageCount,
    lastActivityAt: toIso(row.updatedAt),
    createdAt: toIso(row.createdAt),
  }
}

/**
 * Build the conversation header echoed in the detail response — a subset of the
 * list item (no `messageCount`).
 */
function buildConversationHeader(row: AdminAgentConversationRow): AgentConversationHeader {
  return {
    id: row.id,
    title: row.title,
    sessionId: row.sessionId,
    userId: row.userId,
    userName: row.userName,
    createdAt: toIso(row.createdAt),
    lastActivityAt: toIso(row.updatedAt),
  }
}

/**
 * Build a canonical transcript message from a raw row. The role + status come
 * from the store verbatim (validated by the response schema's closed enums);
 * `model` / `tokenCount` / `toolCalls` are nullable. Omits `conversationId` by
 * construction (it is the request path segment — never a response field).
 */
function buildMessage(row: AdminAgentMessageRow, labelOf: TableLabelOf): AgentConversationMessage {
  return {
    id: row.id,
    role: row.role as AgentConversationMessage['role'],
    content: row.content,
    status: row.status as AgentConversationMessage['status'],
    model: row.model,
    tokenCount: row.tokenCount,
    // A stored call naming a table reads by that table's label as declared NOW.
    toolCalls: withTableLabels(row.toolCalls ?? null, labelOf),
    createdAt: toIso(row.createdAt),
  }
}

// ─── Conversation-list cursor (opaque base64 of `{ value, id }`) ─────────────

/**
 * Encode a conversation-list cursor — opaque base64 of `{ value, id }`. `value`
 * is the last row's `updatedAt` ISO (the `lastActivityAt` the scan orders on);
 * `id` is the row id tie-breaker.
 */
export function encodeConversationsCursor(value: string, id: string): string {
  return Buffer.from(JSON.stringify({ value, id }), 'utf8').toString('base64')
}

/**
 * Decode a conversation-list cursor. Returns `null` (the use case maps that to
 * "ignore the cursor", restarting from the head) when the payload is malformed.
 */
export function decodeConversationsCursor(
  cursor: string
): { readonly value: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly value?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.value !== 'string' || typeof decoded.id !== 'string') return null
    return { value: decoded.value, id: decoded.id }
  } catch {
    return null
  }
}

// ─── List use case ────────────────────────────────────────────────────────────

/**
 * Validated conversation-list inputs, parsed by the route from the canonical
 * query schema. The cursor stays opaque here — the use case decodes it (so the
 * encode/decode pair stays co-located with the rest of the pure logic).
 */
export interface AgentConversationsListInput {
  readonly agentName: string
  readonly from?: string | undefined
  readonly to?: string | undefined
  /**
   * The operator's free-text term over `title` + `sessionId`, already trimmed
   * and length-checked by `searchTermSchema`. `undefined` means "no search".
   */
  readonly q?: string | undefined
  /** Exact account id narrowing the list to that account's conversations. */
  readonly userId?: string | undefined
  /** A relative window on the last activity, counted back from the server's now. */
  readonly period?: ConversationsPeriod | undefined
  readonly cursor?: string | undefined
  readonly limit: number
}

/** The relative windows the list takes (`?period`). */
export type ConversationsPeriod = '7d' | '30d' | '90d'

const PERIOD_DAYS: Readonly<Record<ConversationsPeriod, number>> = { '7d': 7, '30d': 30, '90d': 90 }

/**
 * The lower bound of the list's window: the later of `from` and the start of
 * `period`, counted back from the server's now — the pinned instant on a
 * development host, so a pinned host answers on its pinned day. The browser
 * computes no date.
 */
function windowStart(input: Readonly<AgentConversationsListInput>): string | undefined {
  if (input.period === undefined) return input.from
  const start = serverNow().getTime() - PERIOD_DAYS[input.period] * 86_400_000
  const from = input.from === undefined ? Number.NEGATIVE_INFINITY : Date.parse(input.from)
  return new Date(Math.max(start, from)).toISOString()
}

/**
 * Assemble the repository's WHERE/ORDER inputs from the parsed query and the
 * decoded cursor.
 *
 * Every optional knob is spread conditionally rather than passed as `undefined`,
 * so an absent knob is genuinely absent — which is what lets the repository
 * distinguish "no search" from "search for nothing".
 */
function buildListFilters(
  input: Readonly<AgentConversationsListInput>,
  decoded: { readonly value: string; readonly id: string } | null
): AdminAgentConversationsListFilters {
  const from = windowStart(input)
  return {
    agentName: input.agentName,
    ...(from !== undefined ? { from } : {}),
    ...(input.to !== undefined ? { to: input.to } : {}),
    ...(input.q !== undefined ? { q: input.q } : {}),
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(decoded !== null ? { cursor: decoded } : {}),
    limit: input.limit,
  }
}

/**
 * Outcome of the conversation-list build. `Ok` carries the response-schema-
 * validated body; `ValidationFailed` signals the assembled body failed the
 * response gate (the route maps this to a 500 + logs the schema decode error).
 */
export type AgentConversationsListOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly items: readonly AgentConversationListItem[]
        readonly nextCursor: string | null
        readonly appliedQuery: string | null
      }
    }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the cursor-paginated conversation-list body.
 *
 * Pagination semantics: fetch `limit + 1` rows ordered by the `(updatedAt, id)`
 * tuple descending (newest-first); the page is the first `limit` rows;
 * `nextCursor` is non-null only when a `limit + 1`-th row existed.
 *
 * `q` composes INTO that seek rather than beside it, which is what changes the
 * viewer's cap from "matches among the 200 most recent" to "200 MATCHES". The
 * island loads at most 200 threads per agent and never follows the cursor, so
 * before this, conversation 201 was reported as not existing.
 */
export const BuildAgentConversations = (
  input: AgentConversationsListInput
): Effect.Effect<
  AgentConversationsListOutcome,
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAgentConversationsRepository

    const decoded = input.cursor ? decodeConversationsCursor(input.cursor) : null

    const rows = yield* repo.listConversations(buildListFilters(input, decoded))

    const pageRows = rows.slice(0, input.limit)
    const items = pageRows.map((row) => buildConversationItem(row))
    const lastItem = items[items.length - 1]
    const nextCursor =
      rows.length > input.limit && lastItem !== undefined
        ? encodeConversationsCursor(lastItem.lastActivityAt, lastItem.id)
        : null

    const body = { items, nextCursor, appliedQuery: input.q ?? null }
    const parsed = decodeSafe(agentConversationsListResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: {
        items: parsed.data.items,
        nextCursor: parsed.data.nextCursor,
        // Echoed on EVERY response (`null` when no term was applied) so the
        // reader knows the narrowing already happened and must not repeat it.
        appliedQuery: parsed.data.appliedQuery ?? null,
      },
    } as const
  }).pipe(Effect.withSpan('admin.build-agent-conversations'))

// ─── Detail use case ──────────────────────────────────────────────────────────

/**
 * Outcome of the conversation-detail build. `Ok` carries the response-schema-
 * validated body; `NotFound` signals the conversation does not belong to the
 * agent (the route maps this to the anti-enum 404); `ValidationFailed` signals
 * the assembled body failed the response gate (route → 500).
 */
export type AgentConversationDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: {
        readonly conversation: AgentConversationHeader
        readonly messages: readonly AgentConversationMessage[]
      }
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Build the conversation-detail body for a single `(agentName, conversationId)`
 * pair. The header is fetched agent-scoped — a miss (conversation belongs to a
 * different agent, or does not exist) resolves to `NotFound`. On a hit, every
 * message is loaded chronologically and shaped into the canonical transcript.
 */
export const BuildAgentConversationDetail = (
  agentName: string,
  conversationId: string,
  labelOf: TableLabelOf = () => undefined
): Effect.Effect<
  AgentConversationDetailOutcome,
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAgentConversationsRepository

    const conversationRow = yield* repo.getConversation(agentName, conversationId)
    if (conversationRow === undefined) {
      return { _tag: 'NotFound' } as const
    }

    const messageRows = yield* repo.listMessages(conversationId)
    const body = {
      conversation: buildConversationHeader(conversationRow),
      messages: messageRows.map((row) => buildMessage(row, labelOf)),
    }

    const parsed = decodeSafe(agentConversationDetailResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { conversation: parsed.data.conversation, messages: parsed.data.messages },
    } as const
  }).pipe(Effect.withSpan('admin.build-agent-conversation-detail'))

// ─── Every match (the CSV export) ─────────────────────────────────────────────

/** The page size the export walks the list in. */
const EXPORT_PAGE = 200

/**
 * Every conversation the list's filters match, newest first — not one page:
 * the export walks the same `(updatedAt, id)` seek the cursor does until the
 * match stream ends.
 */
export const ListAllAgentConversations = (
  input: Omit<AgentConversationsListInput, 'cursor' | 'limit'>
): Effect.Effect<
  ReadonlyArray<AgentConversationListItem>,
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminAgentConversationsRepository
    const walk = (
      cursor: { readonly value: string; readonly id: string } | null,
      found: ReadonlyArray<AgentConversationListItem>
    ): Effect.Effect<
      ReadonlyArray<AgentConversationListItem>,
      AdminAgentConversationsDatabaseError
    > =>
      Effect.flatMap(
        repo.listConversations(buildListFilters({ ...input, limit: EXPORT_PAGE }, cursor)),
        (rows) => {
          const items = [...found, ...rows.slice(0, EXPORT_PAGE).map(buildConversationItem)]
          const last = items.at(-1)
          return rows.length > EXPORT_PAGE && last !== undefined
            ? walk({ value: last.lastActivityAt, id: last.id }, items)
            : Effect.succeed(items)
        }
      )
    return yield* walk(null, [])
  }).pipe(Effect.withSpan('admin.list-all-agent-conversations'))
