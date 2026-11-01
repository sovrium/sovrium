/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { chatRequestSchema } from '@/domain/models/api/ai/chat'
import { ApiErrorCode } from '@/domain/models/api/error'
import { isSystemAgentName } from '@/domain/models/app/agents/agent-identity'
import { resolveSystemAgentTurnBinding } from '@/presentation/api/agents/agent-chat'
import {
  resolveDeclaredAgentTurnScope,
  type AgentTurnScope,
} from '@/presentation/api/agents/agent-turn-scope'
import { chainAiChatApprovalRoutes } from '@/presentation/api/agents/chat-approval-routes'
import { buildChatContextPrompt } from '@/presentation/api/agents/chat-context-prompt'
import { resolveChatErrorConfig } from '@/presentation/api/agents/chat-error-handling'
import { resolveUserPrincipal, type ChatPrincipal } from '@/presentation/api/agents/chat-read-scope'
import { withChatTurnReads } from '@/presentation/api/agents/chat-reader-rows'
import {
  aiDisabledResponse,
  applyChatRateLimit,
  extractPageContext,
  type ChatRequestPayload,
} from '@/presentation/api/agents/chat-request'
import { handleChatStop } from '@/presentation/api/agents/chat-stop-route'
import { toToolCallTables } from '@/presentation/api/agents/chat-tool-calling'
import { type ChatTurnInput } from '@/presentation/api/agents/chat-turn-completion'
import { admitTurnParts, type AdmittedTurnParts } from '@/presentation/api/agents/chat-turn-parts'
import {
  answerChatTurn,
  streamAgentChatTurn,
  streamGenericChatTurn,
} from '@/presentation/api/agents/chat-turn-run'
import { chainAiConversationRoutes } from '@/presentation/api/agents/conversations-routes'
import {
  createAiAnonRateLimit,
  type AiAnonRateLimit,
} from '@/presentation/api/middleware/ai-anon-rate-limit'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { decodeJsonBody } from '@/presentation/api/runtime/request-body'
import {
  answerFailures,
  runHandlerEffect,
  runHandlerStream,
  type HandlerAnswer,
} from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { ChatRateLimitDecision } from '@/infrastructure/ai/agents/chat-rate-limit'
import type { Hono, Context } from 'hono'

/**
 * The generic AI chat routes — `POST /api/ai/chat`, its stream
 * `POST /api/ai/chat/stream`, and `POST /api/ai/chat/stop`.
 *
 * This is the cross-cutting chat endpoint asserted by
 * `[internal ref]`: the default, agent-less chat surface,
 * bound to a declared `app.agents[]` entry when the body names one. Auth is
 * chained in `middleware/api-auth-guards.ts`, ahead of these routes.
 *
 * Each request runs as ONE program on the request's services: its gates, its
 * files, the turn (`chat-turn-run.ts`) and what completes it. The stream's
 * program goes on after it answered, until what it streamed is saved.
 *
 * Response envelope: `{ reply, actions, sessionId }`.
 */

const parseRequestBody = async (
  c: Context
): Promise<ChatRequestPayload | { readonly error: string }> => {
  // The raw body is kept: `pageContext` rides beside the contract (read below).
  const { raw, decoded: parsed } = await decodeJsonBody(c, chatRequestSchema)
  if (!parsed.success) return { error: parsed.error.message }
  // The operator-tunable `AI_CHAT_MAX_MESSAGE_LENGTH` cap. Unset → no limit; an
  // over-length message answers a 400 whose message mentions "length".
  const { maxMessageLength } = resolveChatErrorConfig()
  if (maxMessageLength !== undefined && parsed.data.message.length > maxMessageLength) {
    return {
      error: `Message exceeds the maximum length of ${String(maxMessageLength)} characters.`,
    }
  }
  const pageContext = extractPageContext(raw)
  return {
    message: parsed.data.message,
    ...(parsed.data.parts !== undefined && { parts: parsed.data.parts }),
    sessionId: parsed.data.sessionId ?? crypto.randomUUID(),
    ...(parsed.data.agent !== undefined && { agent: parsed.data.agent }),
    ...(parsed.data.confirmationToken !== undefined && {
      confirmationToken: parsed.data.confirmationToken,
    }),
    ...(pageContext !== undefined && { pageContext }),
    ...(parsed.data.parentId !== undefined && { parentId: parsed.data.parentId }),
  }
}

/** The 404 an undeclared agent — or one the caller may not trigger — answers. */
const agentNotDeclared = (c: Context, agentName: string): Response =>
  c.json(
    errorBody({
      error: `Agent '${agentName}' is not declared in the app schema.`,
      code: ApiErrorCode.NOT_FOUND,
    }),
    404
  )

/** What every turn of a request carries, whoever it runs as. */
interface TurnBase {
  readonly message: string
  readonly sessionId: string
  readonly actorName: string
  readonly app: App | undefined
  readonly parts?: AdmittedTurnParts | undefined
}

/**
 * The input of a turn run under `principal`, with its optional fields set only
 * when defined, so the turn's exactOptionalProperty contract is honoured.
 */
const turnInput = (
  base: TurnBase,
  principal: ChatPrincipal & { readonly systemPrompt: string },
  extra: Pick<ChatTurnInput, 'agent' | 'confirmationToken' | 'pageContext' | 'rateLimitRemaining'>
): ChatTurnInput => ({
  systemPrompt: principal.systemPrompt,
  message: base.message,
  sessionId: base.sessionId,
  actorName: base.actorName,
  userRole: principal.userRole,
  effectiveRoles: principal.effectiveRoles,
  reader: principal.reader,
  ...(base.app !== undefined && { app: base.app }),
  ...(base.parts !== undefined && { parts: base.parts }),
  ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined)),
})

/** The input of an agent-bound turn: the agent's prompt and binding, read as `scope.reader`. */
const agentTurnInput = (base: TurnBase, scope: AgentTurnScope): ChatTurnInput =>
  turnInput(base, { ...scope, systemPrompt: scope.binding.systemPrompt }, { agent: scope.binding })

/**
 * The binding of an agent-bound turn and the principal its tools read as: a
 * declared agent's is `resolveDeclaredAgentTurnScope`'s, under its own role
 * capped by the caller's reach.
 *
 * The built-in System Agent is the one exception, and deliberately so: it is
 * the caller's own read-only assistant, so it reads AS the caller. Its prompt
 * and its tools are built from the tables the caller may read, which is what
 * keeps it from handing a member a table only an admin may read.
 */
const resolveAgentTurnScope = (c: Context, app: App, agentName: string) =>
  isSystemAgentName(agentName)
    ? Effect.gen(function* () {
        const principal = yield* resolveUserPrincipal(c)
        const readable = yield* toToolCallTables(app, principal.reader)
        const scope: AgentTurnScope = {
          ...principal,
          binding: resolveSystemAgentTurnBinding(app, readable),
        }
        return scope
      })
    : resolveDeclaredAgentTurnScope(c, app, agentName)

/** The request an agent-bound turn answers. */
interface AgentBoundRequest {
  readonly message: string
  readonly sessionId: string
  readonly agentName: string
  readonly parts?: AdmittedTurnParts | undefined
}

/**
 * An agent-bound chat turn — `POST /api/ai/chat` with `{ agent }`, and the
 * transport behind `POST /api/ai/agents/:name/chat`. It runs the SAME turn a
 * generic one runs, parameterised by the agent's binding: everything the agent
 * adds is data threaded into one path, never a second path. An undeclared
 * agent — or one the caller may not trigger — answers 404 before the turn.
 */
export const agentBoundChatTurn = (c: Context, app: App, req: AgentBoundRequest) =>
  Effect.gen(function* () {
    const scope = yield* resolveAgentTurnScope(c, app, req.agentName)
    if (scope === undefined) return agentNotDeclared(c, req.agentName)
    const actorName = getSessionContext(c)?.userId ?? 'anonymous'
    return yield* answerChatTurn(c, agentTurnInput({ ...req, actorName, app }, scope))
  })

/** A turn bound to no agent: the caller's own assistant, under her role. */
const genericChatTurn = (
  c: Context,
  base: TurnBase,
  turn: { readonly parsed: ChatRequestPayload; readonly rateLimit: ChatRateLimitDecision }
) =>
  Effect.gen(function* () {
    const { parsed, rateLimit } = turn
    // The acting user's role drives table RBAC and the per-request context,
    // rebuilt every turn from her current reach.
    const principal = yield* resolveUserPrincipal(c)
    const systemPrompt = yield* buildChatContextPrompt(base.app, principal, parsed.pageContext)
    return yield* answerChatTurn(
      c,
      turnInput(
        base,
        { ...principal, systemPrompt },
        {
          confirmationToken: parsed.confirmationToken,
          pageContext: parsed.pageContext,
          rateLimitRemaining: rateLimit.limit !== undefined ? rateLimit.remaining : undefined,
        }
      )
    )
  })

/**
 * The gates every chat request passes before its program, in order: AI
 * enabled, the anonymous limit (an app without `auth`), the body, and the
 * per-user rate limit — so a refused caller reaches neither the model nor a
 * recorded provider request.
 */
const openChatRequest = async (
  c: Context,
  app: App | undefined,
  anonLimit: AiAnonRateLimit
): Promise<
  | { readonly refusal: Response }
  | { readonly parsed: ChatRequestPayload; readonly rateLimit: ChatRateLimitDecision }
> => {
  const refusal = aiDisabledResponse(c) ?? anonLimit(c, app, 'chat')
  if (refusal !== undefined) return { refusal }
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return {
      refusal: c.json(errorBody({ error: parsed.error, code: ApiErrorCode.BAD_REQUEST }), 400),
    }
  }
  // The buffered chat's per-user limit, one counter for both transports.
  const gate = applyChatRateLimit(c)
  return 'rejected' in gate ? { refusal: gate.rejected } : { parsed, rateLimit: gate.decision }
}

/**
 * The message's files, then the turn: the caller's own uploads, or a 404 / 422
 * before any model call, with nothing saved.
 */
const withAdmittedParts = <R>(
  c: Context,
  base: Omit<TurnBase, 'parts'> & { readonly parsed: ChatRequestPayload },
  turn: (base: TurnBase) => Effect.Effect<Response, unknown, R>
) =>
  Effect.gen(function* () {
    const { parsed } = base
    const admission = yield* admitTurnParts(c, {
      userId: base.actorName,
      sessionId: parsed.sessionId,
      parts: parsed.parts,
    })
    if ('refusal' in admission) return admission.refusal
    return yield* turn({ ...base, parts: admission.admitted })
  })

const handleChat = async (c: Context, app: App | undefined, anonLimit: AiAnonRateLimit) => {
  const opened = await openChatRequest(c, app, anonLimit)
  if ('refusal' in opened) return opened.refusal
  const { parsed, rateLimit } = opened
  const actorName = getSessionContext(c)?.userId ?? 'anonymous'
  const base = { message: parsed.message, sessionId: parsed.sessionId, actorName, app, parsed }
  const program = withAdmittedParts(c, base, (turn) =>
    // An agent-bound turn: the agent's prompt, model and tools reach the provider.
    parsed.agent !== undefined && app !== undefined
      ? agentBoundChatTurn(c, app, { ...turn, agentName: parsed.agent })
      : genericChatTurn(c, turn, { parsed, rateLimit })
  )
  return runHandlerEffect(c, answerFailures(c, withChatTurnReads(program)))
}

/**
 * Stream the turn a request asks. An agent-bound stream runs the agent's turn
 * exactly as the buffered route does — its prompt, its tools, its gates. A
 * generic stream forwards the model's answer to the message alone, with the
 * files sent earlier in its conversation, since a stream replays no history.
 */
const streamTurn = (
  c: Context,
  handle: HandlerAnswer,
  base: TurnBase & { readonly parsed: ChatRequestPayload }
) =>
  Effect.gen(function* () {
    const { parsed, app } = base
    if (parsed.agent === undefined || app === undefined) {
      return yield* streamGenericChatTurn(c, handle, { ...base, systemPrompt: '' }, parsed.parentId)
    }
    const scope = yield* resolveAgentTurnScope(c, app, parsed.agent)
    if (scope === undefined) return agentNotDeclared(c, parsed.agent)
    return yield* streamAgentChatTurn(c, handle, agentTurnInput(base, scope), parsed.parentId)
  })

const handleChatStream = async (c: Context, app: App | undefined, anonLimit: AiAnonRateLimit) => {
  const opened = await openChatRequest(c, app, anonLimit)
  if ('refusal' in opened) return opened.refusal
  const { parsed } = opened
  // The acting user, whose history the streamed exchange is saved to.
  const actorName = getSessionContext(c)?.userId ?? 'anonymous'
  const base = { message: parsed.message, sessionId: parsed.sessionId, actorName, app, parsed }
  return runHandlerStream(c, (handle) =>
    answerFailures(
      c,
      withChatTurnReads(
        withAdmittedParts(c, base, (turn) => streamTurn(c, handle, { ...turn, parsed }))
      )
    )
  )
}

/**
 * Chain the generic `/api/ai/chat` route(s) onto the given Hono app. Always
 * registered; unauthenticated requests are short-circuited to 401 by the
 * `requireAuth` middleware in `middleware/api-auth-guards.ts`.
 *
 * Not to be confused with `handleAgentChat` in `ai-mcp-status.ts`: that serves
 * `POST /api/agents/:name/chat`, which still performs its own raw provider
 * fetch and advertises the external MCP tool catalog rather than table tools.
 */
export function chainAiChatRoutes(honoApp: Hono, app?: App): Hono {
  // One window per route chain, shared by the buffered and streamed routes: an
  // anonymous visitor's chat budget is the same whichever transport it uses.
  const anonLimit = createAiAnonRateLimit()
  const withChat = honoApp
    .post('/api/ai/chat', (c) => handleChat(c, app, anonLimit))
    .post('/api/ai/chat/stream', (c) => handleChatStream(c, app, anonLimit))
    .post('/api/ai/chat/stop', (c) => handleChatStop(c))
  // Conversation-history routes (GET list, GET :sessionId, DELETE :sessionId), then
  // the window's decisions on held calls; auth is chained in `api-auth-guards.ts`.
  return chainAiChatApprovalRoutes(chainAiConversationRoutes(withChat, app), app)
}
