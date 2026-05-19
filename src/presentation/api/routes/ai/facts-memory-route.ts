/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { extractAndStoreFact, recallAgentFacts } from '@/application/use-cases/ai/facts-memory'
import { handleAgentChat } from '@/presentation/api/routes/agents/agent-chat'
import { provideAiFactsRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Hono, Context } from 'hono'

const DEFAULT_MAX_FACTS = 100

const resolveUserId = (c: Readonly<Context>): string | undefined => {
  const session = getSessionContext(c as unknown as Context)
  return session?.userId
}

const resolveNamespace = (agent: Agent): string => agent.memory?.facts?.namespace ?? agent.name

const parseFactsChatBody = async (
  c: Readonly<Context>
): Promise<{ readonly message: string; readonly sessionId: string }> => {
  const body = (await c.req.json().catch(() => ({}))) as {
    readonly message?: unknown
    readonly sessionId?: unknown
  }
  return {
    message: typeof body.message === 'string' ? body.message : '',
    sessionId: typeof body.sessionId === 'string' ? body.sessionId : 'default',
  }
}

const maybeStoreFact = async (
  agent: Agent,
  userId: string | undefined,
  reply: string
): Promise<void> => {
  const factsEnabled = agent.memory?.facts?.enabled === true
  if (!factsEnabled || userId === undefined || reply.length === 0) return
  return Effect.runPromise(
    extractAndStoreFact({
      namespace: resolveNamespace(agent),
      agentName: agent.name,
      userId,
      fact: reply,
      maxFacts: agent.memory?.facts?.maxFacts ?? DEFAULT_MAX_FACTS,
    }).pipe(provideAiFactsRepoLive, Effect.either, Effect.asVoid)
  )
}

const handleFactsChat = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const agentName = c.req.param('name')
  if (typeof agentName !== 'string' || agentName.length === 0) {
    return c.json({ error: 'Agent name is required.' }, 400)
  }
  const agent = (app?.agents ?? []).find((a) => a.name === agentName)
  if (agent === undefined || app === undefined) {
    return c.json({ error: `Agent '${agentName}' is not declared in the app schema.` }, 404)
  }

  const { message, sessionId } = await parseFactsChatBody(c)
  if (message.length === 0) {
    return c.json({ error: '`message` is required and must be a non-empty string.' }, 400)
  }

  const result = await handleAgentChat(app, { message, sessionId, agentName })
  const { reply } = result.body

  if (result.status === 200 && typeof reply === 'string') {
    await maybeStoreFact(agent, resolveUserId(c), reply)
  }

  return c.json(result.body, result.status)
}

const handleFactsRecall = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const agentName = c.req.param('name')
  const agent = (app?.agents ?? []).find((a) => a.name === agentName)
  if (agent === undefined) {
    return c.json({ error: `Agent '${agentName}' is not declared in the app schema.` }, 404)
  }
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const result = await Effect.runPromise(
    recallAgentFacts({ namespace: resolveNamespace(agent), userId }).pipe(
      provideAiFactsRepoLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to recall facts.' }, 500)
  }
  const facts = result.right.map((f) => ({
    fact: f.fact,
    createdAt: f.createdAt.toISOString(),
  }))
  return c.json({ facts }, 200)
}

export function chainAiFactsRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .post('/api/ai/agents/:name/chat', (c) =>
      handleFactsChat(c as unknown as Readonly<Context>, app)
    )
    .post('/api/ai/agents/:name/recall', (c) =>
      handleFactsRecall(c as unknown as Readonly<Context>, app)
    ) as unknown as T
}
