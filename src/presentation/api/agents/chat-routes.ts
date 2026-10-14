/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { chatRequestSchema } from '@/domain/models/api/ai/chat'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { isSystemAgentName } from '@/domain/models/app/agents/agent-identity'
import { type ContextPageScope } from '@/domain/models/app/agents/ai-chat-context'
import { requireDomainContext } from '@/infrastructure/logging/request-effect'
import { type ChatRateLimitDecision } from '@/infrastructure/process/chat-rate-limit'
import {
  agentAttribution,
  resolveSystemAgentTurnBinding,
} from '@/presentation/api/agents/agent-chat'
import {
  resolveDeclaredAgentTurnScope,
  type AgentTurnScope,
} from '@/presentation/api/agents/agent-turn-scope'
import { carriedFiles, chatTurnSpec, runChatTurn } from '@/presentation/api/agents/chat-agent-turn'
import { chainAiChatApprovalRoutes } from '@/presentation/api/agents/chat-approval-routes'
import { buildChatContextPrompt } from '@/presentation/api/agents/chat-context-prompt'
import { applyRetentionPolicy } from '@/presentation/api/agents/chat-durable-memory'
import { resolveChatErrorConfig } from '@/presentation/api/agents/chat-error-handling'
import { withTurnKnowledge } from '@/presentation/api/agents/chat-knowledge-citations'
import { resolveUserPrincipal, type ChatReader } from '@/presentation/api/agents/chat-read-scope'
import {
  aiDisabledResponse,
  applyChatRateLimit,
  extractPageContext,
  type ChatRequestPayload,
} from '@/presentation/api/agents/chat-request'
import { handleChatStop } from '@/presentation/api/agents/chat-stop-route'
import { buildStreamResponse, type StreamTurnInput } from '@/presentation/api/agents/chat-stream'
import { toToolCallTables } from '@/presentation/api/agents/chat-tool-calling'
import { type ChatTurnInput } from '@/presentation/api/agents/chat-turn-completion'
import {
  admitTurnParts,
  loadCarriedFiles,
  questionContent,
  type AdmittedTurnParts,
} from '@/presentation/api/agents/chat-turn-parts'
import { chainAiConversationRoutes } from '@/presentation/api/agents/conversations-routes'
import {
  createAiAnonRateLimit,
  type AiAnonRateLimit,
} from '@/presentation/api/middleware/ai-anon-rate-limit'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Hono, Context } from 'hono'

/**
 * Generic AI Chat route — `POST /api/ai/chat`.
 *
 * This is the cross-cutting chat endpoint asserted by
 * `[internal ref]` (an AI chat cross spec and
 * neighbours). It is distinct from the per-agent endpoint
 * `POST /api/agents/:name/chat` mounted by `ai-mcp-status.ts` — that one is
 * tied to a declared `app.agents[]` entry; this one is the default,
 * agent-less chat surface used by the platform's generic chat UI.
 *
 * Auth wiring: this file does NOT install `authMiddleware`/`requireAuth`
 * itself. The auth chain in `api-routes.ts` (where this route is mounted)
 * adds `requireAuth()` for `/api/ai/chat` so unauthenticated requests get
 * a 401 before the handler runs.
 *
 * Response envelope (per the spec contract):
 *   { reply: string, actions: ChatAction[], sessionId: string }
 *
 * `actions` is always an empty array in this v1 surface — tool routing,
 * record-mutation actions, and pending-confirmation flows ship in later
 * specs (
 * § 2.5 "Out-of-scope for P0").
 */

const parseRequestBody = async (
  c: Context
): Promise<ChatRequestPayload | { readonly error: string }> => {
  const raw = (await c.req.json().catch(() => undefined)) as unknown
  const parsed = decodeSafe(chatRequestSchema)(raw)
  if (!parsed.success) {
    return { error: parsed.error.message }
  }
  // Enforce the operator-tunable `AI_CHAT_MAX_MESSAGE_LENGTH` cap. Unset → no
  // limit; an over-length message is rejected with a 400 carrying a message
  // that mentions "length" so callers can distinguish it from other 400s
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

/**
 * Handle an agent-bound chat turn — `POST /api/ai/chat` with `{ agent }`, and
 * the transport behind `POST /api/ai/agents/:name/chat`.
 *
 * It runs the SAME `runChatTurn` dispatch a generic turn runs, parameterised by
 * the agent's `AgentTurnBinding`. Everything the agent adds — system
 * prompt, model / temperature / max-tokens overrides, the role that scopes its
 * tools, the tool-table allowlist, the attribution name — is data threaded into
 * one path, not a second path.
 *
 * The agent path is not its own transport: a separate one silently misses every
 * capability the generic path gains.
 *
 * A 404 for an undeclared agent — or one the caller may not trigger — is
 * decided here, before the turn: the name is request DATA, not a provider failure.
 */
export const runAgentBoundChatTurn = async (
  c: Context,
  app: App,
  req: {
    readonly message: string
    readonly sessionId: string
    readonly agentName: string
    readonly parts?: AdmittedTurnParts | undefined
  }
): Promise<Response> => {
  const scope = await resolveAgentTurnScope(c, app, req.agentName)
  if (scope === undefined) {
    const error = `Agent '${req.agentName}' is not declared in the app schema.`
    return c.json(errorBody({ error, code: ApiErrorCode.NOT_FOUND }), 404)
  }
  const actorName = getSessionContext(c)?.userId ?? 'anonymous'
  return runChatTurn(c, {
    services: requireDomainContext(c),
    systemPrompt: scope.binding.systemPrompt,
    message: req.message,
    sessionId: req.sessionId,
    actorName,
    userRole: scope.userRole,
    effectiveRoles: scope.effectiveRoles,
    reader: scope.reader,
    app,
    agent: scope.binding,
    ...(req.parts !== undefined && { parts: req.parts }),
  })
}

/**
 * The binding of an agent-bound turn and the principal its tools read as: a
 * declared agent's is {@link resolveDeclaredAgentTurnScope}'s, under its own
 * role capped by the caller's reach.
 *
 * The built-in System Agent is the one exception, and deliberately so: it is
 * the caller's own read-only assistant, so it reads AS the caller. Its prompt
 * and its tools are built from the tables the caller may read, which is what
 * keeps it from handing a member a table only an admin may read.
 */
const resolveAgentTurnScope = async (
  c: Context,
  app: App,
  agentName: string
): Promise<AgentTurnScope | undefined> => {
  if (isSystemAgentName(agentName)) {
    const { userRole, effectiveRoles, reader } = await resolveUserPrincipal(c)
    const readable = toToolCallTables(app, reader)
    return {
      binding: resolveSystemAgentTurnBinding(app, readable),
      userRole,
      effectiveRoles,
      reader,
    }
  }
  return resolveDeclaredAgentTurnScope(c, app, agentName)
}

const handleChat = async (
  c: Context,
  app: App | undefined,
  anonLimit: AiAnonRateLimit
): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  // The anonymous limit (apps without `auth`) runs first, so a refused caller
  // reaches neither the body parser nor the model.
  const anonymous = anonLimit(c, app, 'chat')
  if (anonymous !== undefined) return anonymous
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json(errorBody({ error: parsed.error, code: ApiErrorCode.BAD_REQUEST }), 400)
  }
  const { message, sessionId } = parsed

  // Per-user chat rate limit. The gate runs BEFORE
  // the AI provider is reached, so a 429 never produces a recorded provider
  // request.
  const gate = applyChatRateLimit(c)
  if ('rejected' in gate) return gate.rejected
  const rateLimit = gate.decision

  // The message's files: the caller's own uploads, or a 404 / 422 before any
  // model call, with nothing saved.
  const actorName = getSessionContext(c)?.userId ?? 'anonymous'
  const admission = await admitTurnParts(c, { userId: actorName, sessionId, parts: parsed.parts })
  if ('refusal' in admission) return admission.refusal
  const parts = admission.admitted

  // Agent-bound turn: when the body names a declared `app.agents[]` entry,
  // delegate to the agent-chat handler so the agent's `systemPrompt`, `model`,
  // and `temperature` overrides reach the AI provider ([internal ref]-*).
  if (parsed.agent !== undefined && app !== undefined) {
    return runAgentBoundChatTurn(c, app, { message, sessionId, agentName: parsed.agent, parts })
  }

  return runGenericChatTurn(c, app, { parsed, actorName, parts, rateLimit })
}

/** A turn bound to no agent: the caller's own assistant, under her role. */
const runGenericChatTurn = async (
  c: Context,
  app: App | undefined,
  turn: {
    readonly parsed: ChatRequestPayload
    readonly actorName: string
    readonly parts: AdmittedTurnParts | undefined
    readonly rateLimit: ChatRateLimitDecision
  }
): Promise<Response> => {
  const { parsed, rateLimit } = turn
  // Resolve the acting user's role — drives table RBAC and the per-request context.
  const { userRole, effectiveRoles, reader } = await resolveUserPrincipal(c)

  // Build the per-request context block ([internal ref]-*), regenerated on
  // every turn so it always reflects the caller's current role.
  const systemPrompt = buildChatContextPrompt(app, userRole, parsed.pageContext)

  return runChatTurn(
    c,
    buildChatTurnInput({
      services: requireDomainContext(c),
      systemPrompt,
      message: parsed.message,
      sessionId: parsed.sessionId,
      actorName: turn.actorName,
      userRole,
      effectiveRoles,
      reader,
      app,
      confirmationToken: parsed.confirmationToken,
      pageContext: parsed.pageContext,
      rateLimitRemaining: rateLimit.limit !== undefined ? rateLimit.remaining : undefined,
      parts: turn.parts,
    })
  )
}

/**
 * Assemble the {@link ChatTurnInput} for a non-agent chat turn, including the
 * optional fields (`app`, `confirmationToken`, `rateLimitRemaining`) only when
 * defined so the turn's exactOptionalProperty contract is honoured.
 */
const buildChatTurnInput = (parts: {
  readonly systemPrompt: string
  readonly message: string
  readonly sessionId: string
  readonly actorName: string
  readonly userRole: string
  readonly effectiveRoles: readonly string[]
  readonly reader: ChatReader
  readonly app: App | undefined
  readonly confirmationToken: string | undefined
  readonly pageContext: ContextPageScope | undefined
  readonly rateLimitRemaining: number | undefined
  readonly services: DomainContext
  readonly parts: AdmittedTurnParts | undefined
}): ChatTurnInput => ({
  services: parts.services,
  systemPrompt: parts.systemPrompt,
  message: parts.message,
  sessionId: parts.sessionId,
  actorName: parts.actorName,
  userRole: parts.userRole,
  effectiveRoles: parts.effectiveRoles,
  reader: parts.reader,
  ...(parts.app !== undefined && { app: parts.app }),
  ...(parts.confirmationToken !== undefined && { confirmationToken: parts.confirmationToken }),
  ...(parts.pageContext !== undefined && { pageContext: parts.pageContext }),
  ...(parts.rateLimitRemaining !== undefined && {
    rateLimitRemaining: parts.rateLimitRemaining,
  }),
  ...(parts.parts !== undefined && { parts: parts.parts }),
})

// ---------------------------------------------------------------------------
// Streaming variant — POST /api/ai/chat/stream
// ---------------------------------------------------------------------------
//
// The SSE encoding, `AI_CHAT_STREAM_TIMEOUT` handling, and durable persistence
// for the streaming transport live in `ai/chat-stream.ts` (`buildStreamResponse`),
// keeping this file under the `max-lines` cap. This handler stays here so the
// route registration and auth wiring are co-located with the buffered route.

/**
 * A generic stream: the model's answer to the question alone, which carries
 * the files sent earlier in its conversation, since a stream replays no history.
 */
const genericStreamSpec = async (
  c: Context,
  app: App | undefined,
  request: {
    readonly parsed: ChatRequestPayload
    readonly userId: string
    readonly parts: AdmittedTurnParts | undefined
  }
): Promise<StreamTurnInput['spec']> => {
  const { parsed, userId, parts } = request
  const carried = await loadCarriedFiles(requireDomainContext(c), userId, parsed.sessionId)
  return {
    surface: 'chat',
    app,
    chatActor: userId,
    tools: { runAction: () => Effect.succeed({ ok: false, error: 'no actions' }) },
    messages: [{ role: 'user', content: questionContent(parsed.message, parts, carried) }],
    toolDefinitions: [],
    maxSteps: 1,
    stream: true,
  }
}

/**
 * The turn a streamed request runs. An agent-bound stream runs the agent's turn
 * exactly as the buffered route does — its prompt, its tools, its gates. A
 * generic stream forwards the model's answer to the message alone, as it
 * always has.
 */
const streamTurn = async (
  c: Context,
  app: App | undefined,
  request: {
    readonly parsed: ChatRequestPayload
    readonly userId: string
    readonly parts: AdmittedTurnParts | undefined
  }
): Promise<
  Pick<StreamTurnInput, 'spec' | 'agentName' | 'passages'> | { readonly refusal: Response }
> => {
  const { parsed, userId, parts } = request
  if (parsed.agent === undefined || app === undefined) {
    return { spec: await genericStreamSpec(c, app, request) }
  }
  const scope = await resolveAgentTurnScope(c, app, parsed.agent)
  if (scope === undefined) {
    const error = `Agent '${parsed.agent}' is not declared in the app schema.`
    return { refusal: c.json(errorBody({ error, code: ApiErrorCode.NOT_FOUND }), 404) }
  }
  const input = buildChatTurnInput({
    services: requireDomainContext(c),
    systemPrompt: scope.binding.systemPrompt,
    message: parsed.message,
    sessionId: parsed.sessionId,
    actorName: userId,
    userRole: scope.userRole,
    effectiveRoles: scope.effectiveRoles,
    reader: scope.reader,
    app,
    confirmationToken: undefined,
    pageContext: undefined,
    rateLimitRemaining: undefined,
    parts,
  })
  // The agent's knowledge, numbered into its prompt; the `done` event carries what it cites.
  const known = await withTurnKnowledge({ ...input, agent: scope.binding })
  const carried = await carriedFiles(known.input)
  return {
    spec: chatTurnSpec(known.input, { history: [], stream: true, carried }),
    agentName: agentAttribution(scope.binding),
    passages: known.passages,
  }
}

const handleChatStream = async (
  c: Context,
  app: App | undefined,
  anonLimit: AiAnonRateLimit
): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  const anonymous = anonLimit(c, app, 'chat')
  if (anonymous !== undefined) return anonymous
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json(errorBody({ error: parsed.error, code: ApiErrorCode.BAD_REQUEST }), 400)
  }
  // The buffered chat's per-user limit, one counter for both transports: a
  // refused turn reaches no model and saves nothing.
  const gate = applyChatRateLimit(c)
  if ('rejected' in gate) return gate.rejected
  // The acting user, whose history the streamed exchange is saved to.
  const userId = getSessionContext(c)?.userId ?? 'anonymous'
  const admission = await admitTurnParts(c, {
    userId,
    sessionId: parsed.sessionId,
    parts: parsed.parts,
  })
  if ('refusal' in admission) return admission.refusal
  const parts = admission.admitted
  const turn = await streamTurn(c, app, { parsed, userId, parts })
  if ('refusal' in turn) return turn.refusal
  // The buffered turn's retention sweep, for a turn that runs: best-effort, logged.
  await applyRetentionPolicy(requireDomainContext(c), userId)
  return buildStreamResponse(c, {
    services: requireDomainContext(c),
    message: parsed.message,
    sessionId: parsed.sessionId,
    userId,
    spec: turn.spec,
    agentName: turn.agentName,
    userParts: parts?.stored,
    passages: turn.passages,
    parentId: parsed.parentId,
  })
}

/**
 * Chain the generic `/api/ai/chat` route(s) onto the given Hono app. Always
 * registered; unauthenticated requests are short-circuited to 401 by the
 * `requireAuth` middleware in `api-routes.ts`. When the request body names a
 * declared `app.agents[]` entry, the turn is bound to that agent by
 * {@link runAgentBoundChatTurn} — the SAME dispatch a generic turn runs, with
 * the agent's prompt, provider overrides, tool allowlist and attribution
 * threaded through as data.
 *
 * Not to be confused with `handleAgentChat` in `ai-mcp-status.ts`: that is a
 * different function serving a different route (`POST /api/agents/:name/chat`),
 * which still performs its own raw provider fetch and advertises the external
 * MCP tool catalog rather than table tools.
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
  return chainAiChatApprovalRoutes(chainAiConversationRoutes(withChat))
}
