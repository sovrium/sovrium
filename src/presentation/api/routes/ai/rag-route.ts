/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { resolveRagConfig } from '@/domain/services/rag/rag-config'
import {
  discoverDocuments,
  resolveKnowledgeDir,
  runSyncDocuments,
} from '@/infrastructure/ai/document-sync'
import { RagSyncLayer } from '@/infrastructure/ai/embed-pipeline'
import { runSyncKnowledge } from '@/infrastructure/ai/knowledge-sync'
import { AiLive } from '@/infrastructure/ai/layer'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { RagAgent } from '@/infrastructure/ai/rag-agent-input'
import type { Hono, Context } from 'hono'

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

const handleConfig = async (c: Readonly<Context>): Promise<Response> => {
  const program = Effect.gen(function* () {
    const ai = yield* AiService
    return resolveRagConfig(process.env, ai.embeddingModel())
  }).pipe(Effect.provide(AiLive))
  const config = await Effect.runPromise(program)
  return c.json(config)
}

const handleStatus = async (c: Readonly<Context>): Promise<Response> => {
  const dir = resolveKnowledgeDir(process.env)
  const documents = await discoverDocuments(dir).catch((): ReadonlyArray<{ path: string }> => [])
  return c.json({ documents: documents.map((d) => ({ path: d.path })) })
}

const handleSearch = async (c: Readonly<Context>): Promise<Response> => {
  const body = (await c.req.json().catch(() => ({}))) as {
    query?: unknown
    agent?: unknown
  }
  const query = typeof body.query === 'string' ? body.query : ''
  const agentName = typeof body.agent === 'string' ? body.agent : undefined
  if (query.trim().length === 0) {
    return c.json({ error: 'query is required' }, 400)
  }
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
      query,
      agentName,
      minSimilarity: ragConfig.similarity,
      maxResults: ragConfig.maxResults,
    })
  }).pipe(
    Effect.provide(RagSyncLayer),
    Effect.catchAll(() => Effect.succeed([]))
  )
  const results = await Effect.runPromise(program)
  return c.json({
    results: results.map((r) => ({
      agentName: r.agentName,
      sourceRef: r.sourceRef,
      content: r.content,
      similarity: r.similarity,
    })),
  })
}

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
  if (role !== 'admin') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  return undefined
}

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

export function chainRagRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .get('/api/ai/rag/config', (c) => handleConfig(c as unknown as Readonly<Context>))
    .get('/api/ai/rag/status', (c) => handleStatus(c as unknown as Readonly<Context>))
    .post('/api/ai/rag/search', (c) => handleSearch(c as unknown as Readonly<Context>))
    .post('/api/ai/rag/rebuild', (c) => handleRebuild(c as unknown as Readonly<Context>, app))
    .get('/api/ai/agents/:name/config', (c) =>
      handleAgentConfig(c as unknown as Readonly<Context>, app)
    ) as unknown as T
}
