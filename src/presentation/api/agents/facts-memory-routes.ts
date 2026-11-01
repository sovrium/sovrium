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
 *    (an AI memory facts memory spec).
 *  - `POST /api/ai/agents/:name/recall` — recall the facts the calling user
 *    has stored for the agent's namespace, oldest first. Per-user scoped so
 *    a caller never recalls another user's facts even within a shared
 *    namespace.
 *
 * Fact extraction is gated on the per-agent schema flag (`memory.facts`): when
 * omitted or `false`, no fact is ever extracted or stored
 * The `namespace` declared on the agent
 * isolates facts — an agent in namespace A never reads namespace B's facts.
 *
 * Auth: the `/api/ai/agents/*` paths get the `authMiddleware` chain installed
 * in `compose-api-routes.ts` (`guardRagRoutes`) when `app.auth` is configured, so the calling user's id
 * is available for per-user scoping.
 */

import { Effect } from 'effect'
import { extractAndStoreFact, recallAgentFacts } from '@/application/use-cases/ai/facts-memory'
import { agentFactsRecallResponseSchema } from '@/domain/models/api/ai/agents'
import { ApiErrorCode } from '@/domain/models/api/error'
import { logError } from '@/infrastructure/logging/logger'
import { checkTriggerPermission } from '@/presentation/api/agents/agent-trigger-guard'
import { resolveUserPrincipal } from '@/presentation/api/agents/chat-read-scope'
import { withChatTurnReads } from '@/presentation/api/agents/chat-reader-rows'
import { keepListedBy } from '@/presentation/api/agents/chat-replay-scope'
import { agentBoundChatTurn } from '@/presentation/api/agents/chat-routes'
import { agentNotFound } from '@/presentation/api/runtime/agent-lookup'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Hono, Context } from 'hono'

/** Default `maxFacts` cap when the agent omits it (mirrors the schema default). */
const DEFAULT_MAX_FACTS = 100

/** Resolve the authenticated user's id, or undefined when no session. */
const resolveUserId = (c: Context): string | undefined => {
  const session = getSessionContext(c)
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
  c: Context
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
const maybeStoreFact = (
  agent: Agent,
  userId: string | undefined,
  learned: { readonly reply: string; readonly tables: ReadonlyArray<string> }
) => {
  const factsEnabled = agent.memory?.facts?.enabled === true
  if (!factsEnabled || userId === undefined || learned.reply.length === 0) return Effect.void
  return extractAndStoreFact({
    namespace: resolveNamespace(agent),
    agentName: agent.name,
    userId,
    fact: learned.reply,
    maxFacts: agent.memory?.facts?.maxFacts ?? DEFAULT_MAX_FACTS,
    tables: learned.tables,
  }).pipe(Effect.result, Effect.asVoid)
}

/**
 * `POST /api/ai/agents/:name/chat` — agent-bound chat turn with fact
 * extraction. Delegates the whole turn to {@link agentBoundChatTurn} — the
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
/** The distinct tables the envelope's actions name, in their order. */
const tablesOfActions = (actions: unknown): ReadonlyArray<string> =>
  Array.isArray(actions)
    ? [
        ...new Set(
          actions.flatMap((action: unknown) => {
            const table =
              typeof action === 'object' && action !== null
                ? (action as { readonly table?: unknown }).table
                : undefined
            return typeof table === 'string' ? [table] : []
          })
        ),
      ]
    : []

/**
 * Persist the assistant reply as an atomic fact when the turn succeeded and the
 * agent has memory enabled, with the tables the turn read — one action per
 * call that ran, naming its table — so recall can judge it against what the
 * user lists then. Reads the reply off a CLONE so the envelope the shared turn
 * produced is returned untouched.
 */
const storeFactFromTurn = (c: Context, agent: Agent, response: Response) =>
  Effect.gen(function* () {
    if (response.status !== 200) return
    const read = () =>
      response
        .clone()
        .json()
        .catch(() => ({}))
    // effect-promise: total -- an unreadable body is caught above and read as none.
    const body = (yield* Effect.promise(read)) as {
      readonly reply?: unknown
      readonly actions?: unknown
    }
    if (typeof body.reply !== 'string') return
    yield* maybeStoreFact(agent, resolveUserId(c), {
      reply: body.reply,
      tables: tablesOfActions(body.actions),
    })
  })

const factsChatProgram = (c: Context, app?: App) =>
  Effect.gen(function* () {
    const agentName = c.req.param('name')
    if (typeof agentName !== 'string' || agentName.length === 0) {
      return c.json(
        errorBody({ error: 'Agent name is required.', code: ApiErrorCode.BAD_REQUEST }),
        400
      )
    }
    const agent = (app?.agents ?? []).find((a) => a.name === agentName)
    if (agent === undefined || app === undefined) {
      return agentNotFound(c)
    }

    // This is the FOURTH per-agent invocation route, and
    // it sits under a different prefix (`/api/ai/agents/*`) from the other three.
    // That prefix also attaches `authMiddleware` without chaining `requireAuth()`,
    // so gating `/api/agents/*` alone would leave the agent reachable here.
    const triggerRefusal = yield* checkTriggerPermission(c, agent, app)
    if (triggerRefusal) return triggerRefusal

    // effect-promise: total -- `parseFactsChatBody` catches a rejected parse and reads it as an empty body.
    const { message, sessionId } = yield* Effect.promise(() => parseFactsChatBody(c))
    if (message.length === 0) {
      return c.json(
        errorBody({
          error: '`message` is required and must be a non-empty string.',
          code: ApiErrorCode.BAD_REQUEST,
        }),
        400
      )
    }

    const turn = agentBoundChatTurn(c, app, { message, sessionId, agentName })
    const program = Effect.tap(turn, (response) => storeFactFromTurn(c, agent, response))
    return yield* withChatTurnReads(program)
  })

const handleFactsChat = (c: Context, app?: App): Promise<Response> =>
  runHandlerEffect(c, answerFailures(c, factsChatProgram(c, app)))

/**
 * `POST /api/ai/agents/:name/recall` — recall the calling user's stored facts
 * for the agent's namespace. Returns `{ facts: [{ fact, createdAt }] }`,
 * oldest first. Per-user scoped, and judged at read time as chat replay is: a
 * fact learned from a table the user no longer lists is left out (it stays
 * stored), and a fact naming no table is returned as stored.
 */
const factsRecallProgram = (c: Context, app?: App) =>
  Effect.gen(function* () {
    const agentName = c.req.param('name')
    const agent = (app?.agents ?? []).find((a) => a.name === agentName)
    if (agent === undefined) {
      return agentNotFound(c)
    }
    // The same trigger gate as the chat turn that writes these facts: a caller who
    // may not reach the agent is answered exactly as for an undeclared name.
    const triggerRefusal = yield* checkTriggerPermission(c, agent, app)
    if (triggerRefusal) return triggerRefusal
    const userId = resolveUserId(c)
    if (userId === undefined) {
      return c.json(
        errorBody({ error: 'Authentication required.', code: ApiErrorCode.UNAUTHORIZED }),
        401
      )
    }
    return yield* recalledFacts(c, app, agent, userId)
  })

const handleFactsRecall = (c: Context, app?: App): Promise<Response> =>
  runHandlerEffect(c, answerFailures(c, factsRecallProgram(c, app)))

/** The caller's facts for `agent`, less those learned from a table she no longer lists. */
const recalledFacts = (c: Context, app: App | undefined, agent: Agent, userId: string) =>
  Effect.gen(function* () {
    const result = yield* Effect.result(
      recallAgentFacts({ namespace: resolveNamespace(agent), userId })
    )
    if (result._tag === 'Failure') {
      logError('[ai] recall-facts failed', result.failure)
      return c.json(
        errorBody({ error: 'Failed to recall facts.', code: ApiErrorCode.INTERNAL_ERROR }),
        500
      )
    }
    const { reader } = yield* resolveUserPrincipal(c)
    const listed = yield* keepListedBy(
      { app, reader },
      result.success,
      (f) => f.tables,
      'recalled facts'
    )
    const facts = listed.map((f) => ({ fact: f.fact, createdAt: f.createdAt.toISOString() }))
    return yield* respondWith(c, Effect.succeed({ facts }), agentFactsRecallResponseSchema)
  }).pipe(withChatTurnReads)

/**
 * Chain the agent facts-memory routes onto the given Hono app. Always
 * registered — the handlers return 404 for agents not declared in
 * `app.agents`, keeping the API shape stable across configurations.
 */
export function chainAiFactsRoutes(honoApp: Hono, app?: App): Hono {
  return honoApp
    .post('/api/ai/agents/:name/chat', (c) => handleFactsChat(c, app))
    .post('/api/ai/agents/:name/recall', (c) => handleFactsRecall(c, app))
}
