/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Agent facts-memory routes:
 *
 *  - `POST /api/ai/agents/:name/chat`   — agent-bound chat turn that, when the
 *    agent declares `memory.facts.enabled: true`, extracts an atomic fact from
 *    the turn and persists it to `system.ai_facts` for the agent's namespace
 *.
 *  - `POST /api/ai/agents/:name/recall` — recall the facts the calling user
 *    has stored for the agent's namespace, oldest first. Per-user scoped so
 *    a caller never recalls another user's facts even within a shared
 * namespace.
 *
 * Fact extraction is gated on the per-agent schema flag (`memory.facts`): when
 * omitted or `false`, no fact is ever extracted or stored
 *. The `namespace` declared on the agent
 * isolates facts — an agent in namespace A never reads namespace B's facts
 *.
 *
 * Auth: the `/api/ai/agents/*` paths get the `authMiddleware` chain installed
 * in `api-routes.ts` when `app.auth` is configured, so the calling user's id
 * is available for per-user scoping.
 */

import { Effect } from 'effect'
import { extractAndStoreFact, recallAgentFacts } from '@/application/use-cases/ai/facts-memory'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { agentNotFound } from '@/presentation/api/routes/agents/agent-lookup'
import { checkTriggerPermission } from '@/presentation/api/routes/agents/agent-trigger-guard'
import { provideAiFactsRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import { runAgentBoundChatTurn } from '@/presentation/api/routes/ai-chat'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Hono, Context } from 'hono'

/** Default `maxFacts` cap when the agent omits it (mirrors the schema default). */
const DEFAULT_MAX_FACTS = 100

/** Resolve the authenticated user's id, or undefined when no session. */
const resolveUserId = (c: Readonly<Context>): string | undefined => {
  const session = getSessionContext(c as unknown as Context)
  return session?.userId
}

/**
 * Resolve the facts-memory namespace for an agent: the explicit
 * `memory.facts.namespace` when declared, otherwise the agent name (the
 * schema default).
 */
const resolveNamespace = (agent: Agent): string => agent.memory?.facts?.namespace ?? agent.name

/** Read `{ message, sessionId }` from an agent-chat request body. */
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

/**
 * Persist the assistant reply of a successful turn as an atomic fact for the
 * agent's namespace — but only when the agent declares `memory.facts.enabled`
 * and the calling user is known. Fact extraction is gated on the per-agent
 * schema flag: when `memory.facts` is omitted or `false`, no fact is ever
 * stored. Best-effort: a persistence failure
 * is swallowed so it never breaks the chat turn.
 */
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
    }).pipe(provideAiFactsRepoLive, Effect.result, Effect.asVoid)
  )
}

/**
 * `POST /api/ai/agents/:name/chat` — agent-bound chat turn with fact
 * extraction. Delegates the whole turn to {@link runAgentBoundChatTurn} — the
 * SAME dispatch `POST /api/ai/chat { agent }` uses — then, when the agent has
 * `memory.facts.enabled: true` and the turn succeeded, persists the assistant
 * reply as an atomic fact for the agent's namespace via {@link maybeStoreFact}.
 *
 * The reply is read back off a CLONE of the response: this route needs the text
 * for fact extraction, but the envelope belongs to the shared turn and is
 * returned untouched. Reading it here rather than owning a second provider call
 * is what keeps fact extraction on the same transport as every other agent
 * turn — it inherits tool calling and provider-aware routing for free.
 */
/**
 * Persist the assistant reply as an atomic fact when the turn succeeded and the
 * agent has memory enabled. Reads the reply off a CLONE so the envelope the
 * shared turn produced is returned untouched.
 */
const storeFactFromTurn = async (
  c: Readonly<Context>,
  agent: Agent,
  response: Response
): Promise<void> => {
  if (response.status !== 200) return
  const body = (await response
    .clone()
    .json()
    .catch(() => ({}))) as { readonly reply?: unknown }
  if (typeof body.reply !== 'string') return
  // eslint-disable-next-line functional/no-expression-statements -- best-effort fact-persistence side effect
  await maybeStoreFact(agent, resolveUserId(c), body.reply)
}

const handleFactsChat = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const agentName = c.req.param('name')
  if (typeof agentName !== 'string' || agentName.length === 0) {
    return c.json({ error: 'Agent name is required.' }, 400)
  }
  const agent = (app?.agents ?? []).find((a) => a.name === agentName)
  if (agent === undefined || app === undefined) {
    return agentNotFound(c)
  }

  // [internal ref]: this is the FOURTH per-agent invocation route, and
  // it sits under a different prefix (`/api/ai/agents/*`) from the other three.
  // That prefix also attaches `authMiddleware` without chaining `requireAuth()`,
  // so gating `/api/agents/*` alone would leave the agent reachable here.
  const triggerRefusal = await checkTriggerPermission(c, agent)
  if (triggerRefusal) return triggerRefusal

  const { message, sessionId } = await parseFactsChatBody(c)
  if (message.length === 0) {
    return c.json({ error: '`message` is required and must be a non-empty string.' }, 400)
  }

  const response = await runAgentBoundChatTurn(c, app, { message, sessionId, agentName })
  // eslint-disable-next-line functional/no-expression-statements -- best-effort fact-persistence side effect
  await storeFactFromTurn(c, agent, response)
  return response
}

/**
 * `POST /api/ai/agents/:name/recall` — recall the calling user's stored facts
 * for the agent's namespace. Returns `{ facts: [{ fact, createdAt }] }`,
 * oldest first. Per-user scoped.
 */
const handleFactsRecall = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const agentName = c.req.param('name')
  const agent = (app?.agents ?? []).find((a) => a.name === agentName)
  if (agent === undefined) {
    return agentNotFound(c)
  }
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const result = await runRequestEffect(
    c,
    recallAgentFacts({ namespace: resolveNamespace(agent), userId }).pipe(
      provideAiFactsRepoLive,
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    logError('[ai] recall-facts failed', result.failure)
    return c.json({ error: 'Failed to recall facts.' }, 500)
  }
  const facts = result.success.map((f) => ({
    fact: f.fact,
    createdAt: f.createdAt.toISOString(),
  }))
  return c.json({ facts }, 200)
}

/**
 * Chain the agent facts-memory routes onto the given Hono app. Always
 * registered — the handlers return 404 for agents not declared in
 * `app.agents`, keeping the API shape stable across configurations.
 */
export function chainAiFactsRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .post('/api/ai/agents/:name/chat', (c) =>
      handleFactsChat(c as unknown as Readonly<Context>, app)
    )
    .post('/api/ai/agents/:name/recall', (c) =>
      handleFactsRecall(c as unknown as Readonly<Context>, app)
    ) as unknown as T
}
