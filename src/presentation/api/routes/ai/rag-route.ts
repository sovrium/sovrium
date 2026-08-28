/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RAG HTTP routes — `/api/ai/rag/*` and `/api/ai/agents/:name/config`.
 *
 * Backs [internal ref] /
 * PER-AGENT-KNOWLEDGE:
 *  - `GET  /api/ai/rag/config`            — resolved RAG configuration.
 *  - `GET  /api/ai/rag/status`            — discovered knowledge documents.
 *  - `POST /api/ai/rag/search`            — pgvector similarity search.
 *  - `POST /api/ai/rag/rebuild`           — re-embed agent + document
 *                                           knowledge (admin).
 *  - `GET  /api/ai/agents/:name/config`   — agent knowledge config readback.
 *
 * Auth: `api-routes.ts` applies `authMiddleware` to `/api/ai/rag/REBUILD` and to
 * `/api/ai/agents/*` — NOT to `/api/ai/rag/*`. An older version of this comment
 * claimed the whole prefix was covered; it never was. `rebuild` carries its own
 * gate (`authorizeRebuild`: a session AND the admin role, [internal ref],
 * so the 404 is distinguishable from a 401 "not signed in"), and `search` now
 * carries the two in-file gates described below.
 *
 * SEARCH AUTHORIZATION, in two tiers:
 *
 *   Tier 1 — enforced here. A caller must be authenticated
 *     (`requireSearchSession`, 401) and a result must come from a table the
 *     caller may READ (`filterResultsByTableReadAccess`). Both only engage when
 *     the app configures `auth`. This was previously open: a hit's `content` is
 *     the concatenated field values of a source ROW and its `sourceRef`
 *     (`table:<name>:<recordId>:<chunk>`) names the row, so any anonymous caller
 *     read across every ingested table, `read: ['admin']` ones included. The
 *     anonymous contract used to be PINNED by ~30 sibling specs asserting
 * 200/400; those were re-authored first and the
 *     `src/` change follows them.
 *
 *   Tier 2 — NOT closable here, and deliberately not attempted. `content` is
 *     computed at INGEST, so a field the caller may not read is already inside
 *     the chunk text of a table they CAN read; a `salary` column that was
 *     embedded cannot be stripped retroactively by a route filter. Closing it
 *     needs ingest to partition chunks by field readability, which is a schema
 *     change, drafted as its own platform user story rather than smuggled into
 *     an authorization gate that could not honestly cover it.
 *
 * `config`, `status` and `agents/:name/config` remain reachable with no caller
 * identity. They are pure config readback and carry no record data.
 */

import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { resolveRagConfig } from '@/domain/services/rag/rag-config'
import { hasReadPermissionForRoles } from '@/domain/validators/permission-evaluators'
import {
  discoverDocuments,
  resolveKnowledgeDir,
  runSyncDocuments,
} from '@/infrastructure/ai/document-sync'
import { RagSyncLayer } from '@/infrastructure/ai/embed-pipeline'
import { runSyncKnowledge } from '@/infrastructure/ai/knowledge-sync'
import { AiLive } from '@/infrastructure/ai/layer'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'
import type { Hono, Context } from 'hono'

/** Build the knowledge-sync input for a list of RAG agents. */
const toSyncInput = (agents: ReadonlyArray<RagAgent>) =>
  agents
    .map((agent) => ({
      name: agent.name,
      tables: (agent.knowledge?.tables ?? []).map((t) => ({
        table: t.table,
        fields: t.fields,
        ...(t.filter !== undefined ? { filter: t.filter } : {}),
      })),
    }))
    .filter((agent) => agent.tables.length > 0)

/** `GET /api/ai/rag/config` — resolved RAG configuration. */
const handleConfig = async (c: Readonly<Context>): Promise<Response> => {
  const program = Effect.gen(function* () {
    const ai = yield* AiService
    return resolveRagConfig(process.env, ai.embeddingModel())
  }).pipe(Effect.provide(AiLive))
  const config = await runRequestEffect(c, program)
  return c.json(config)
}

/**
 * `GET /api/ai/rag/status` — discovered knowledge documents.
 *
 * Lists every supported document file found in `AI_KNOWLEDGE_DIR`
 *. Unsupported extensions are excluded by
 * `discoverDocuments`. A missing directory yields an empty list.
 */
const handleStatus = async (c: Readonly<Context>): Promise<Response> => {
  const dir = resolveKnowledgeDir(process.env)
  const documents = await discoverDocuments(dir).catch((): ReadonlyArray<{ path: string }> => [])
  return c.json({ documents: documents.map((d) => ({ path: d.path })) })
}

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
const requireSearchSession = (c: Readonly<Context>, app: App | undefined): Response | undefined => {
  if (app?.auth === undefined) return undefined
  const session = getSessionContext(c as unknown as Context)
  if (session?.userId === undefined) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  return undefined
}

/**
 * The source table a chunk came from, or `undefined` for a non-table chunk.
 *
 * `sourceRef` is `table:<name>:<recordId>:<chunk>` for table-derived chunks and
 * a document path for knowledge-file chunks. Only the table form is gated —
 * knowledge files are operator-provided content with no per-table grant to
 * consult.
 */
const tableNameOfSourceRef = (sourceRef: string | null): string | undefined => {
  if (sourceRef === null) return undefined
  const [kind, name] = sourceRef.split(':')
  return kind === 'table' && name ? name : undefined
}

/**
 * Tier 1, second half: drop results whose source table the caller may not READ.
 *
 * Uses `hasReadPermissionForRoles` — the inheritance-aware, group-aware table
 * gate that `buildReadAccessPlan` uses — rather than a fresh comparison against
 * `permissions.read`, so a table declaring `inherit: 'parent'` or granting
 * `group:finance` resolves the same way here as it does on
 * `GET /api/tables/:t/records`. A third answer to "may this caller read this
 * table" is precisely what the read-plan consolidation exists to prevent.
 *
 * A chunk naming a table the app no longer declares is dropped: it is
 * unattributable, so no grant can vouch for it.
 *
 * KNOWN GAP — tier 2, deliberately NOT attempted here. `content` is computed at
 * INGEST, so a field the caller may not read is already inside the chunk text
 * of a table they CAN read. A route-level filter cannot strip it retroactively;
 * closing it needs ingest to partition chunks by field readability, which is a
 * schema change. It is drafted as its own platform user story
 * rather than smuggled in
 * here, where no honest assertion could cover it.
 */
const filterResultsByTableReadAccess = async <T extends { readonly sourceRef: string | null }>(
  c: Readonly<Context>,
  app: App | undefined,
  results: readonly T[]
): Promise<readonly T[]> => {
  if (app?.auth === undefined) return results

  const session = getSessionContext(c as unknown as Context)
  const userId = session?.userId
  if (userId === undefined) return []

  // Role AND group memberships, resolved the same way the records API resolves
  // them, so `permissions: { read: ['group:finance'] }` is honoured here too.
  const role = await getUserRole(userId).catch(() => 'member')
  const groups = await getUserGroups(userId).catch((): readonly string[] => [])
  const effectiveRoles = buildEffectiveRoles(role, groups)

  return results.filter((result) => {
    const tableName = tableNameOfSourceRef(result.sourceRef)
    if (tableName === undefined) return true
    const table = app.tables?.find((candidate) => candidate.name === tableName)
    if (table === undefined) return false
    return hasReadPermissionForRoles(table, effectiveRoles, app.tables)
  })
}

/** `POST /api/ai/rag/search` — pgvector cosine similarity search. */
const handleSearch = async (c: Readonly<Context>, app: App | undefined): Promise<Response> => {
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
    return c.json({ error: 'query is required' }, 400)
  }
  // RAG requires a configured AI provider to compute embeddings. When
  // `AI_PROVIDER` is unset/blank, refuse before attempting any embedding work
  // — a clear 503 rather than a silent empty result.
  if ((process.env.AI_PROVIDER?.trim() ?? '') === '') {
    return c.json(
      {
        error:
          'AI provider not configured. Set AI_PROVIDER (and AI_BASE_URL / AI_API_KEY) to enable RAG search.',
        code: 'AI_PROVIDER_NOT_CONFIGURED',
      },
      503
    )
  }
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
    // Single merged provide — `AiService` + `AiEmbeddingRepository` together.
    Effect.provide(RagSyncLayer),
    // A provider/DB failure yields an empty result set rather than a 5xx —
    // the search endpoint degrades gracefully.
    Effect.orElseSucceed(() => [])
  )
  const results = await runRequestEffect(c, program)
  const readable = await filterResultsByTableReadAccess(c, app, results)
  return c.json({
    results: readable.map((r) => ({
      agentName: r.agentName,
      sourceRef: r.sourceRef,
      content: r.content,
      similarity: r.similarity,
    })),
  })
}

/**
 * Authorize a rebuild request. Returns an HTTP error response when the
 * caller is not an admin (and `app.auth` is configured), or `undefined`
 * when the request may proceed.
 */
const authorizeRebuild = async (
  c: Readonly<Context>,
  app: App | undefined
): Promise<Response | undefined> => {
  if (app?.auth === undefined) return undefined
  const session = getSessionContext(c as unknown as Context)
  if (session?.userId === undefined) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  const role = await getUserRole(session.userId).catch(() => 'member')
  if (!isAdminRole(role)) {
    // S1 anti-enumeration: admin-role denial returns 404.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return undefined
}

/**
 * `POST /api/ai/rag/rebuild` — re-embed agent table-knowledge and document
 * knowledge.
 *
 * Admin-only when `app.auth` is configured. With no
 * `app.auth` the endpoint is open (no role model exists). An optional
 * `agent` body field scopes the table-knowledge rebuild to one agent;
 * document knowledge is global and always re-embedded.
 */
const handleRebuild = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const body = (await c.req.json().catch(() => ({}))) as { agent?: unknown }
  const agentFilter = typeof body.agent === 'string' ? body.agent : undefined

  const denied = await authorizeRebuild(c, app)
  if (denied !== undefined) return denied

  const allAgents = (app?.agents ?? []) as ReadonlyArray<RagAgent>
  const selected =
    agentFilter !== undefined ? allAgents.filter((a) => a.name === agentFilter) : allAgents
  const syncInput = toSyncInput(selected)

  const started = Date.now()
  const [statsByAgent, documentStats] = await Promise.all([
    runSyncKnowledge(syncInput).catch(() => ({})),
    runSyncDocuments(process.env).catch(() => ({ documents: {}, totalChunks: 0 })),
  ])
  const duration = Date.now() - started

  const tables = Object.values(statsByAgent).reduce<Record<string, number>>(
    (acc, agentStats) => ({ ...acc, ...agentStats.tables }),
    {}
  )
  const tableChunks = Object.values(statsByAgent).reduce(
    (sum, agentStats) => sum + agentStats.totalChunks,
    0
  )
  const totalChunks = tableChunks + documentStats.totalChunks

  return c.json({
    status: 'completed',
    ...(agentFilter !== undefined ? { agent: agentFilter } : {}),
    stats: { tables, documents: documentStats.documents, totalChunks, duration },
  })
}

/** `GET /api/ai/agents/:name/config` — agent knowledge configuration. */
const handleAgentConfig = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const name = c.req.param('name')
  const agent = (app?.agents ?? []).find((a) => a.name === name)
  if (agent === undefined) {
    return c.json({ error: 'Agent not found' }, 404)
  }
  return c.json({
    name: agent.name,
    knowledge: {
      tables: agent.knowledge?.tables ?? [],
      documents: agent.knowledge?.documents ?? [],
    },
  })
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
 * `config` / `status` / `agents/:name/config` are pure config readback.
 */
export function chainRagRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .get('/api/ai/rag/config', (c) => handleConfig(c as unknown as Readonly<Context>))
    .get('/api/ai/rag/status', (c) => handleStatus(c as unknown as Readonly<Context>))
    .post('/api/ai/rag/search', (c) => handleSearch(c as unknown as Readonly<Context>, app))
    .post('/api/ai/rag/rebuild', (c) => handleRebuild(c as unknown as Readonly<Context>, app))
    .get('/api/ai/agents/:name/config', (c) =>
      handleAgentConfig(c as unknown as Readonly<Context>, app)
    ) as unknown as T
}
