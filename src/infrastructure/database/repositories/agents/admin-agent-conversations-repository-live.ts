/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, asc, count, desc, eq, gte, isNull, lt, lte, or, type SQL } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AdminAgentConversationsDatabaseError,
  AdminAgentConversationsRepository,
  type AdminAgentConversationRow,
  type AdminAgentMessageRow,
  type AdminAgentConversationsListFilters,
} from '@/application/ports/repositories/agents/admin-agent-conversations-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { isDefaultAgentName } from '@/domain/models/app/agents/agent-identity'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  aiConversations as aiConversationsPg,
  aiMessages as aiMessagesPg,
} from '@/infrastructure/database/drizzle/schema/ai'
import {
  aiConversations as aiConversationsSqlite,
  aiMessages as aiMessagesSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/ai'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { searchAnyColumn } from '@/infrastructure/database/sql/dialect-sql-helpers'

/** Wrap a DB promise, adapting failures to AdminAgentConversationsDatabaseError. */
const wrap = makeDbWrap((cause) => new AdminAgentConversationsDatabaseError({ cause }))

/**
 * Dialect-correct Drizzle table objects, resolved once at module-init. The PG
 * variant generates `system.ai_conversations` / `system.ai_messages`; the SQLite
 * variant maps the flat `system_*` names. Column property names are identical
 * across both mirrors so the query builder stays dialect-agnostic.
 */
const aiConversations = resolveDialectSchema(aiConversationsPg, aiConversationsSqlite)
const aiMessages = resolveDialectSchema(aiMessagesPg, aiMessagesSqlite)

/**
 * Build the agent-scope predicate for a conversation-source name.
 *
 * The reserved {@link DEFAULT_AGENT_NAME} is the general-purpose agent, whose
 * view is the `agent_name IS NULL` set — the conversations no declared agent
 * claimed (every `/api/ai/chat` write path stores NULL; see
 * `src/domain/models/app/agents/agent-identity.ts`). Equality can never reach those rows:
 * `agent_name = 'default'` is NULL-vs-value, which SQL evaluates to NULL and
 * therefore never true, so before this the whole set was unreachable from the
 * console rather than merely mis-scoped.
 *
 * Expressed with Drizzle's {@link isNull} rather than hand-written SQL so both
 * dialects render the same `"agent_name" is null` — the one place PG and
 * SQLite could have been made to differ by an `= NULL` spelling.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- Drizzle's `SQL` condition type is intrinsically mutable; the sibling `build*Conditions` helpers hand back the same shape inside a ReadonlyArray
const agentScopeCondition = (agentName: string): SQL =>
  isDefaultAgentName(agentName)
    ? isNull(aiConversations.agentName)
    : eq(aiConversations.agentName, agentName)

/**
 * Build the optional `from`/`to` date-window conditions on the conversation
 * `updatedAt` (`lastActivityAt`) column. Bounds are inclusive. The use case
 * passes raw ISO strings; coerce them to `Date` so the bound parameter matches
 * the column's native type on both dialects (S3 — Drizzle binds the value).
 */
const buildDateWindowConditions = (
  filters: AdminAgentConversationsListFilters
): ReadonlyArray<SQL> => {
  const fromCond =
    filters.from !== undefined ? gte(aiConversations.updatedAt, new Date(filters.from)) : undefined
  const toCond =
    filters.to !== undefined ? lte(aiConversations.updatedAt, new Date(filters.to)) : undefined
  return [fromCond, toCond].filter((cond): cond is SQL => cond !== undefined)
}

/**
 * Build the optional `?q=` free-text predicate: the term occurs in `title` OR
 * `sessionId` — exactly the two fields the viewer island already matched on, so
 * moving the search to the server grows its REACH without quietly changing what
 * the box means. Message `content` stays out of scope.
 *
 * {@link searchAnyColumn} carries the portable spelling the contract mandates:
 * `lower(col) LIKE lower(pattern)` (bare `LIKE` is case-SENSITIVE on Postgres
 * and case-INSENSITIVE on SQLite; `ILIKE` does not exist on SQLite), with `%`
 * and `_` escaped so an operator's metacharacter stays a character, and an
 * absent term contributing no condition at all.
 *
 * Both columns are NULLABLE. `LIKE` against NULL yields NULL, so an untitled or
 * session-less thread simply does not match — the correct answer, and it needs
 * no COALESCE.
 *
 * This belongs in WHERE rather than HAVING: both columns live on the outer
 * `ai_conversations` table, not on the joined `ai_messages`, so the predicate is
 * evaluable before the GROUP BY and filters rows rather than groups.
 */
const buildSearchConditions = (filters: AdminAgentConversationsListFilters): ReadonlyArray<SQL> =>
  searchAnyColumn(filters.q, aiConversations.title, aiConversations.sessionId)

/**
 * Build the deterministic newest-first cursor-seek predicate for the
 * `(updatedAt, id)` tuple. A row is strictly "after" the cursor (i.e. older, in
 * descending order) when `updatedAt < value OR (updatedAt = value AND id < id)`.
 * The cursor `value` is an ISO string coerced to `Date` to match the column.
 * Returns an empty list when no cursor is set (first page).
 */
const buildCursorConditions = (filters: AdminAgentConversationsListFilters): ReadonlyArray<SQL> => {
  if (filters.cursor === undefined) return []
  const { value, id } = filters.cursor
  const sortValue: Readonly<Date> = new Date(value)
  const seek = or(
    lt(aiConversations.updatedAt, sortValue),
    and(eq(aiConversations.updatedAt, sortValue), lt(aiConversations.id, id))
  )
  return seek !== undefined ? [seek] : []
}

/**
 * The conversation-projection select map shared by the list + detail reads. Each
 * row is annotated with its `messageCount` via a LEFT JOIN + GROUP BY on
 * `ai_messages` (`count(ai_messages.id)` counts 0 for a conversation with no
 * messages, since the join nulls). A LEFT JOIN keeps the cross-dialect query a
 * single well-typed query-builder call (no raw correlated subquery — which does
 * not render the outer-table correlation portably). The GROUP BY enumerates
 * every projected conversation column so both dialects accept the aggregate.
 */
const conversationSelect = {
  id: aiConversations.id,
  title: aiConversations.title,
  sessionId: aiConversations.sessionId,
  messageCount: count(aiMessages.id),
  updatedAt: aiConversations.updatedAt,
  createdAt: aiConversations.createdAt,
}

const conversationGroupBy = [
  aiConversations.id,
  aiConversations.title,
  aiConversations.sessionId,
  aiConversations.updatedAt,
  aiConversations.createdAt,
]

/** Coerce a raw conversation-projection row into the port's row type. */
const toConversationRow = (row: {
  readonly id: string
  readonly title: string | null
  readonly sessionId: string | null
  readonly messageCount: number
  readonly updatedAt: Date | string
  readonly createdAt: Date | string
}): AdminAgentConversationRow => ({
  id: row.id,
  title: row.title,
  sessionId: row.sessionId,
  messageCount: toFiniteCount(row.messageCount),
  updatedAt: row.updatedAt,
  createdAt: row.createdAt,
})

/**
 * Drizzle implementation for {@link AdminAgentConversationsRepository.listConversations}.
 * Pulled out of the `wrap()` callback so the latter stays under the complexity
 * cap. Fetches `limit + 1` rows ordered by the `(updatedAt, id)` tuple descending
 * (newest first) so the use case can derive `hasMore` / `nextCursor`.
 */
const listConversationsImpl = async (
  filters: AdminAgentConversationsListFilters
): Promise<ReadonlyArray<AdminAgentConversationRow>> => {
  // Every knob ANDs. The search sits INSIDE the same WHERE as the agent scope,
  // the date window and the cursor seek, which is what makes the `limit + 1`
  // overfetch an overfetch of MATCHES — so `nextCursor` walks the match stream
  // and terminates on it, and search can never widen past the agent in the path.
  const conditions = [
    agentScopeCondition(filters.agentName),
    ...buildDateWindowConditions(filters),
    ...buildSearchConditions(filters),
    ...buildCursorConditions(filters),
  ]

  // `id` is the deterministic tie-breaker — same (descending) direction as the
  // primary sort key so the `(updatedAt, id)` tuple is strictly monotonic and
  // the cursor never revisits a row.
  const rows = await db
    .select(conversationSelect)
    .from(aiConversations)
    .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
    .where(and(...conditions))
    .groupBy(...conversationGroupBy)
    .orderBy(desc(aiConversations.updatedAt), desc(aiConversations.id))
    .limit(filters.limit + 1)

  return rows.map((row) => toConversationRow(row))
}

/**
 * Drizzle implementation for {@link AdminAgentConversationsRepository.getConversation}.
 * Agent-scoped: the WHERE binds BOTH the agent scope and the `id`, so a
 * conversation belonging to a DIFFERENT agent resolves to `undefined` — the use
 * case maps that to the anti-enum 404.
 *
 * The scope comes from {@link agentScopeCondition}, so it cuts BOTH ways: an
 * unclaimed (`agent_name IS NULL`) conversation is invisible under a declared
 * agent, and a claimed one is invisible under the reserved `default`. Reading
 * an unclaimed conversation is no longer an impossibility — it is the default
 * agent's ordinary case.
 */
const getConversationImpl = async (
  agentName: string,
  conversationId: string
): Promise<AdminAgentConversationRow | undefined> => {
  const rows = await db
    .select(conversationSelect)
    .from(aiConversations)
    .leftJoin(aiMessages, eq(aiMessages.conversationId, aiConversations.id))
    .where(and(agentScopeCondition(agentName), eq(aiConversations.id, conversationId)))
    .groupBy(...conversationGroupBy)
    .limit(1)

  const row = rows[0]
  return row === undefined ? undefined : toConversationRow(row)
}

/**
 * Drizzle implementation for {@link AdminAgentConversationsRepository.listMessages}.
 * Every message of a conversation, ordered chronologically by `created_at`.
 *
 * `id ASC` trails it as a STABILITY tie-break only — it makes repeated reads of
 * the same rows agree with each other, and nothing more. It is emphatically not
 * a chronological fallback: `ai_messages.id` is a random UUID on both dialects
 * (`crypto.randomUUID()` / `gen_random_uuid()`), so two same-instant rows sort
 * by coin flip. Chronology is the writer's job, and `recordTurn` does it by
 * stamping the two turns of a round-trip one millisecond apart instead of
 * letting the column default collapse them onto one instant.
 */
const listMessagesImpl = async (
  conversationId: string
): Promise<ReadonlyArray<AdminAgentMessageRow>> => {
  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      content: aiMessages.content,
      status: aiMessages.status,
      model: aiMessages.model,
      tokenCount: aiMessages.tokenCount,
      toolCalls: aiMessages.toolCalls,
      createdAt: aiMessages.createdAt,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))

  return rows as ReadonlyArray<AdminAgentMessageRow>
}

/**
 * Admin Agent Conversations Repository Implementation (Drizzle).
 *
 * Three dialect-aware reads over `system.ai_conversations` + `system.ai_messages`
 * backing the admin conversation-history viewer. All projection / cursor /
 * pagination / ISO-normalization logic lives in the `agent-conversations` use
 * case; this layer emits only raw queries. Dialect resolution is handled by the
 * module-init `resolveDialectSchema` selectors.
 *
 * The reads are CROSS-USER (no `user_id` predicate) and AGENT-SCOPED (by
 * `agent_name`). `user_id`, `agent_id`, and `metadata` are deliberately NOT
 * projected so the use case cannot leak them (S4).
 */
export const AdminAgentConversationsRepositoryLive = Layer.succeed(
  AdminAgentConversationsRepository,
  {
    listConversations: (filters) => wrap(async () => listConversationsImpl(filters)),
    getConversation: (agentName, conversationId) =>
      wrap(async () => getConversationImpl(agentName, conversationId)),
    listMessages: (conversationId) => wrap(async () => listMessagesImpl(conversationId)),
  }
)
