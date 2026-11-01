/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RAG HTTP routes — `/api/ai/rag/*` and `/api/ai/agents/:name/config`.
 *
 * Backs the AI RAG embedding requirement / TABLE-KNOWLEDGE / DOCUMENT-KNOWLEDGE /
 * PER-AGENT-KNOWLEDGE:
 *  - `GET  /api/ai/rag/config`            — resolved RAG configuration.
 *  - `GET  /api/ai/rag/status`            — discovered knowledge documents.
 *  - `POST /api/ai/rag/search`            — pgvector similarity search.
 *  - `POST /api/ai/rag/rebuild`           — re-embed agent + document
 *                                           knowledge (admin).
 *  - `GET  /api/ai/agents/:name/config`   — agent knowledge config readback.
 *
 * Auth: `guardRagRoutes` in `compose-api-routes.ts` attaches the session with
 * `authMiddleware` on `rebuild`, `search`, `status` and `config` and on
 * `/api/ai/agents/*` — never on a `/api/ai/rag/*` wildcard — and chains
 * `requireAuth()` only on `status` and `config`. `rebuild` carries its own
 * gate (`authorizeRebuild`: a session AND the admin role, an AI RAG agent spec,
 * so the 404 is distinguishable from a 401 "not signed in"), and `search` now
 * carries the two in-file gates described below.
 *
 * SEARCH AUTHORIZATION, in two tiers:
 *
 *   Tier 1 — enforced here. A caller must be authenticated
 *     (`requireSearchSession`, 401) and a result must come from a table the
 *     caller may READ, narrowed to the rows the records API would show them
 *     (`filterResultsByReadAccess`). Both only engage when
 *     the app configures `auth`. Without it, the endpoint is a read primitive: a
 *     hit's `content` is the concatenated field values of a source ROW and its
 *     `sourceRef` (`table:<name>:<recordId>:<chunk>`) names the row, so any
 *     anonymous caller could read across every ingested table,
 *     `read: ['admin']` ones included.
 *
 *   Tier 2 — fields. `content` is computed at INGEST and cannot be masked
 *     here, so ingest partitions it instead: a record's knowledge fields are
 *     grouped by their effective read grant, each group embedded as its own
 *     chunk sequence, and every chunk records the names of its fields. A table
 *     chunk is then served only when the caller may read every field it names
 *     under the running config; a chunk naming none (written before chunks
 *     recorded them) or naming a field no longer declared is never served.
 *
 * DOCUMENTS. A knowledge document is not tied to a table, so it has no read
 *   grant of its own: it is read through the agents that may retrieve it. A
 *   document chunk (search) or a document path (status) is served only to a
 *   caller who may trigger at least one agent that may retrieve that document,
 *   by the rule a chat turn follows (`someAgentRetrievesDocument`). A document
 *   no agent may retrieve is served to no one.
 *
 * `config` and `status` require a session (`requireAuth`, 401) when the app
 * configures auth: they name the knowledge directory's files and the model. The agent
 * readback `agents/:name/config` takes the agent's trigger gate, as
 * `GET /api/agents/:name` does, refused exactly as an unknown name is.
 */

import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import {
  listKnowledgeDocuments,
  rebuildAgentKnowledge,
} from '@/application/use-cases/agents/agent-knowledge-index'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  agentKnowledgeConfigResponseSchema,
  ragConfigResponseSchema,
  ragRebuildResponseSchema,
  ragStatusResponseSchema,
} from '@/domain/models/api/ai/rag'
import { ragSearchResponseSchema } from '@/domain/models/api/ai/search'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  documentPathOf,
  someAgentRetrievesDocument,
} from '@/domain/models/app/agents/knowledge-citation-service'
import { resolveRagConfig } from '@/domain/models/app/agents/rag-config'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { judgeAgentTriggers } from '@/presentation/api/agents/agent-trigger-guard'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { resolveUserPrincipal } from './chat-read-scope'
import { withChatTurnReads } from './chat-reader-rows'
import { filterHitsThroughReadGate, filterServableHits } from './rag-search-read-gate'
import { providerNotConfigured, searchRateLimited } from './rag-search-refusals'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Hono, Context } from 'hono'

/**
 * Refuse a search from a caller with no session, when the app configures auth.
 *
 * An app WITHOUT `auth` has no identity to check and stays open, matching
 * `authorizeRebuild`'s first line — a deployment that declared no auth has not
 * asked for one.
 *
 * 401 rather than 404: `/api/ai/rag/search` is a fixed documented route, so
 * there is no object id to enumerate and the S1 anti-enumeration rule does not
 * apply. Same status the sibling `authorizeRebuild` already answers, rather
 * than inventing a second convention in one file.
 */
const requireSearchSession = (c: Context, app: App | undefined): Response | undefined => {
  if (app?.auth === undefined) return undefined
  const session = getSessionContext(c)
  if (session?.userId === undefined) {
    return c.json(
      errorBody({ error: 'Authentication required', code: ApiErrorCode.UNAUTHORIZED }),
      401
    )
  }
  return undefined
}

/** `GET /api/ai/rag/config` — resolved RAG configuration. */
const handleConfig = (c: Context): Promise<Response> =>
  runHandlerEffect(
    c,
    Effect.gen(function* () {
      const ai = yield* AiService
      return shapedJson(
        c,
        resolveRagConfig(process.env, ai.embeddingModel()),
        ragConfigResponseSchema
      )
    })
  )

/** The declared agents this request's caller may trigger, with one role lookup. */
const reachableAgents = (c: Context, app: App | undefined) => {
  const agents = app?.agents ?? []
  if (agents.length === 0) return Effect.succeed<readonly Agent[]>([])
  return Effect.map(judgeAgentTriggers(c, agents, app), (verdicts) =>
    agents.filter((_, index) => verdicts[index] === true)
  )
}

/**
 * Keep a document chunk only when one of `agents` may retrieve its document;
 * a table chunk is left to the table read gate.
 */
const withinAgentReach = <T extends { readonly sourceRef: string | null }>(
  agents: readonly Agent[],
  results: readonly T[]
): readonly T[] =>
  results.filter((result) => {
    const path = documentPathOf(result.sourceRef)
    return path === undefined || someAgentRetrievesDocument(agents, path)
  })

/**
 * `GET /api/ai/rag/status` — the knowledge documents the caller may read.
 *
 * Lists the supported document files found in `AI_KNOWLEDGE_DIR` that an agent
 * the caller may trigger may retrieve. Unsupported extensions are excluded by
 * `discoverDocuments`. A missing directory yields an empty list.
 */
const handleStatus = (c: Context, app: App | undefined): Promise<Response> =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const paths = yield* listKnowledgeDocuments()
        const agents = yield* reachableAgents(c, app)
        const readable = paths.filter((path) => someAgentRetrievesDocument(agents, path))
        return shapedJson(
          c,
          { documents: readable.map((path) => ({ path })) },
          ragStatusResponseSchema
        )
      })
    )
  )

/**
 * Tier 1, second half: keep only the hits the records API would show the
 * caller — the records read gate, asked as a chat read asks it
 * ({@link filterHitsThroughReadGate}): the table's read grant over her
 * effective roles (assignment roles included), her row-level read rule, and
 * the live rows only. A hit whose row is hidden from her, in the trash, or
 * gone is dropped.
 *
 * Tier 2 rides the same gate: a table chunk is kept only when the caller may
 * read every field it records. With no `auth` there is no caller to judge, but
 * a chunk that records no fields, or names a table or field the config no
 * longer declares, is still never served ({@link filterServableHits}).
 */
const filterResultsByReadAccess = <
  T extends {
    readonly sourceRef: string | null
    readonly fields?: ReadonlyArray<string> | undefined
  },
>(
  c: Context,
  app: App | undefined,
  results: readonly T[]
) => {
  if (app?.auth === undefined) return Effect.succeed(filterServableHits(app, results))
  if (getSessionContext(c)?.userId === undefined) return Effect.succeed<readonly T[]>([])
  return Effect.flatMap(resolveUserPrincipal(c), ({ reader }) =>
    filterHitsThroughReadGate({ app, reader, results })
  )
}

/** `POST /api/ai/rag/search` — pgvector cosine similarity search. */
const handleSearch = async (c: Context, app: App | undefined): Promise<Response> => {
  // Tier 1, first half: authenticate BEFORE anything else runs. A hit's
  // `content` is the concatenated field values of a source ROW and its
  // `sourceRef` names that row, so an anonymous caller previously read across
  // every ingested table, `read: ['admin']` ones included.
  //
  // Ahead of the empty-query and `AI_PROVIDER` checks deliberately: an
  // unauthenticated caller must not be able to tell a configured instance from
  // an unconfigured one, and must not reach any embedding work.
  const unauthorized = requireSearchSession(c, app)
  if (unauthorized) return unauthorized

  const body = (await c.req.json().catch(() => ({}))) as {
    query?: unknown
    agent?: unknown
  }
  const query = typeof body.query === 'string' ? body.query : ''
  const agentName = typeof body.agent === 'string' ? body.agent : undefined
  if (query.trim().length === 0) {
    return c.json(errorBody({ error: 'query is required', code: ApiErrorCode.BAD_REQUEST }), 400)
  }
  // RAG requires a configured AI provider to compute embeddings. When
  // `AI_PROVIDER` is unset/blank, refuse before attempting any embedding work
  // — a clear 503 rather than a silent empty result.
  if ((process.env.AI_PROVIDER?.trim() ?? '') === '') return providerNotConfigured(c)
  const limited = searchRateLimited(c)
  if (limited) return limited
  const ragConfig = resolveRagConfig(process.env, 'text-embedding-3-small')
  const program = Effect.gen(function* () {
    const ai = yield* AiService
    const repo = yield* AiEmbeddingRepository
    const reply = yield* ai.embed({ text: query })
    return yield* repo.search({
      embedding: reply.embedding,
      // `query` powers the opt-in SQLite FTS5 lexical-hybrid path; the dense and
      // pgvector paths ignore it.
      query,
      agentName,
      minSimilarity: ragConfig.similarity,
      maxResults: ragConfig.maxResults,
    })
  }).pipe(
    // effect-swallow: a provider or database failure yields an empty result set rather than a 5xx — an unavailable knowledge index is indistinguishable, to this endpoint, from a query that matched nothing.
    Effect.orElseSucceed(() => [])
  )
  // `AiService` and `AiEmbeddingRepository` are the ones the domain runtime
  // resolved at boot, read off THIS request rather than rebuilt per search.
  const answered = Effect.gen(function* () {
    const results = yield* program
    const gated = yield* filterResultsByReadAccess(c, app, results)
    const readable = withinAgentReach(yield* reachableAgents(c, app), gated)
    return shapedJson(
      c,
      {
        results: readable.map((r) => ({
          agentName: r.agentName,
          sourceRef: r.sourceRef,
          content: r.content,
          similarity: r.similarity,
        })),
      },
      ragSearchResponseSchema
    )
  })
  return runHandlerEffect(c, answerFailures(c, answered.pipe(withChatTurnReads)))
}

/**
 * Authorize a rebuild request. Returns an HTTP error response when the
 * caller is not an admin, or `undefined` when the request may proceed.
 *
 * With no `app.auth` nobody can be an administrator, so every caller gets the
 * standard 404, as for a route the app does not have.
 */
const authorizeRebuild = (c: Context, app: App | undefined) =>
  Effect.gen(function* () {
    if (app?.auth === undefined) return notFound(c, 'Resource not found')
    const session = getSessionContext(c)
    if (session?.userId === undefined) {
      return c.json(
        errorBody({ error: 'Authentication required', code: ApiErrorCode.UNAUTHORIZED }),
        401
      )
    }
    const role = yield* getUserRole(session.userId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[ai-rag] reading the rebuild caller role failed', cause))
      ),
      // effect-swallow: a role that cannot be read is the least one, which is refused the rebuild; logged above.
      Effect.orElseSucceed(() => 'member')
    )
    // S1 anti-enumeration: a caller who is not admin-equivalent (the built-in
    // `admin` or the app's top role) gets 404.
    return isAdminEquivalent(role, app) ? undefined : notFound(c, 'Resource not found')
  })

/**
 * `POST /api/ai/rag/rebuild` — re-embed agent table-knowledge and document
 * knowledge.
 *
 * Admin-only. With no `app.auth` it answers 404 to everyone, since no
 * visitor can be an administrator. An optional
 * `agent` body field scopes the table-knowledge rebuild to one agent;
 * document knowledge is global and always re-embedded.
 */
const handleRebuild = async (c: Context, app?: App): Promise<Response> => {
  const body = (await c.req.json().catch(() => ({}))) as { agent?: unknown }
  const agentFilter = typeof body.agent === 'string' ? body.agent : undefined

  const program = Effect.gen(function* () {
    const denied = yield* authorizeRebuild(c, app)
    if (denied !== undefined) return denied
    // `authorizeRebuild` answered 404 to every caller of an app without `auth`,
    // so `app` is set here.
    if (app === undefined) return notFound(c, 'Resource not found')
    const started = Date.now()
    const rebuilt = yield* rebuildAgentKnowledge(app, agentFilter)
    return shapedJson(
      c,
      {
        status: 'completed',
        ...(agentFilter !== undefined ? { agent: agentFilter } : {}),
        stats: { ...rebuilt, duration: Date.now() - started },
      },
      ragRebuildResponseSchema
    )
  })
  return runHandlerEffect(c, answerFailures(c, program))
}

/** `GET /api/ai/agents/:name/config` — agent knowledge configuration. */
const handleAgentConfig = (c: Context, app?: App): Promise<Response> => {
  const name = c.req.param('name')
  const agent = (app?.agents ?? []).find((a) => a.name === name)
  // A caller who may not reach the agent is answered exactly as for an unknown name.
  if (agent === undefined) return Promise.resolve(notFound(c, 'Agent not found'))
  const program = Effect.map(judgeAgentTriggers(c, [agent], app), ([may]) =>
    may === true
      ? shapedJson(
          c,
          {
            name: agent.name,
            knowledge: {
              tables: agent.knowledge?.tables ?? [],
              documents: agent.knowledge?.documents ?? [],
            },
          },
          agentKnowledgeConfigResponseSchema
        )
      : notFound(c, 'Agent not found')
  )
  return runHandlerEffect(c, answerFailures(c, program))
}

/**
 * Chain the RAG routes onto the given Hono app. Always registered — the
 * handlers degrade gracefully when no agents / no AI provider are configured.
 *
 * `search` and `rebuild` work on BOTH runtimes: Postgres uses the
 * pgvector `<=>` operator, SQLite stores embeddings as Float32Array BLOBs and
 * computes cosine similarity in application code (see
 * `ai-embedding-repository-live.ts (SQLite impl)`). The former Postgres-only
 * `501 requires-postgres` gate is gone, and so is the runtime-gating helper it
 * was built on — no route gates on the database engine any more. The
 * `AI_PROVIDER` gate in `handleSearch`
 * is dialect-independent and still fires (`503`) when no provider is configured.
 * `config` / `status` require a session; `agents/:name/config` the trigger gate.
 */
export function chainRagRoutes(honoApp: Hono, app?: App): Hono {
  return honoApp
    .get('/api/ai/rag/config', (c) => handleConfig(c))
    .get('/api/ai/rag/status', (c) => handleStatus(c, app))
    .post('/api/ai/rag/search', (c) => handleSearch(c, app))
    .post('/api/ai/rag/rebuild', (c) => handleRebuild(c, app))
    .get('/api/ai/agents/:name/config', (c) => handleAgentConfig(c, app))
}
