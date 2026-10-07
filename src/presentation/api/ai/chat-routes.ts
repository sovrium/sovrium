/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AiService,
  type ChatReply,
  type ChatMessage,
  type ChatToolDefinition,
} from '@/application/ports/services/ai-service'
import { chatRequestSchema } from '@/domain/models/api/ai/chat'
import { decodeSafe } from '@/domain/models/api/combinators/decode'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { isSystemAgentName } from '@/domain/models/app/agents/agent-identity'
import { type ContextPageScope } from '@/domain/models/app/agents/ai-chat-context'
import { buildChatToolDefinitions } from '@/domain/models/app/agents/ai-chat-tools'
import {
  provideDomain,
  requireDomainContext,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { mayTriggerAgentNamed } from '@/presentation/api/agents/agent-trigger-guard'
import {
  agentAttribution,
  resolveAgentTurnBinding,
  resolveSystemAgentTurnBinding,
  type AgentTurnBinding,
} from '@/presentation/api/ai/agent-chat'
import {
  createAiAnonRateLimit,
  type AiAnonRateLimit,
} from '@/presentation/api/ai/ai-anon-rate-limit'
import { recordChatActivity } from '@/presentation/api/ai/chat-activity-log'
import { buildChatContextPrompt } from '@/presentation/api/ai/chat-context-prompt'
import { appendConversationTurn } from '@/presentation/api/ai/chat-conversation-store'
import {
  applyRetentionPolicy,
  loadDurableHistory,
  persistChatTurnDurably,
} from '@/presentation/api/ai/chat-durable-memory'
import {
  chatErrorCode,
  chatErrorMessage,
  chatErrorStatus,
  isTransientChatError,
  resolveChatErrorConfig,
  type ChatTurnError,
} from '@/presentation/api/ai/chat-error-handling'
import {
  checkChatRateLimit,
  type ChatRateLimitDecision,
} from '@/presentation/api/ai/chat-rate-limit'
import {
  agentCaller,
  agentReader,
  resolveUserPrincipal,
  type ChatReader,
} from '@/presentation/api/ai/chat-read-scope'
import { buildStreamResponse } from '@/presentation/api/ai/chat-stream'
import {
  completeToolCallingTurn,
  toToolCallTables,
  respondWithActions,
} from '@/presentation/api/ai/chat-tool-calling'
import { finishChatTurn, type ChatTurnInput } from '@/presentation/api/ai/chat-turn-completion'
import { chainAiConversationRoutes } from '@/presentation/api/ai/conversations-routes'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
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

interface ChatRequestPayload {
  readonly message: string
  readonly sessionId: string
  readonly agent?: string
  /**
   * Optional token confirming a previously-pending destructive action
   * When present and it resolves to a stashed
   * confirmation, an affirmative message commits the mutation.
   */
  readonly confirmationToken?: string
  /**
   * Optional page scope passed when the chat surface is embedded in a page
   * component declaring `allowedTables`. Not part
   * of `chatRequestSchema` — it is a presentation-layer concern read straight
   * off the raw body so the context builder can narrow the table list.
   */
  readonly pageContext?: ContextPageScope
}

/**
 * Best-effort extraction of an optional `pageContext` object from the raw
 * request body. Returns undefined when absent or malformed — a bad
 * `pageContext` never fails the request, it just yields the un-scoped context.
 */
const extractPageContext = (raw: unknown): ContextPageScope | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { pageContext: candidate } = raw as { readonly pageContext?: unknown }
  if (typeof candidate !== 'object' || candidate === null) return undefined
  const { page, allowedTables: allowed } = candidate as {
    readonly page?: unknown
    readonly allowedTables?: unknown
  }
  return {
    ...(typeof page === 'string' && { page }),
    ...(Array.isArray(allowed) &&
      allowed.every((t) => typeof t === 'string') && {
        allowedTables: allowed as ReadonlyArray<string>,
      }),
  }
}

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
    sessionId: parsed.data.sessionId ?? crypto.randomUUID(),
    ...(parsed.data.agent !== undefined && { agent: parsed.data.agent }),
    ...(parsed.data.confirmationToken !== undefined && {
      confirmationToken: parsed.data.confirmationToken,
    }),
    ...(pageContext !== undefined && { pageContext }),
  }
}

/**
 * When `AI_PROVIDER` is entirely unset, AI is not just unconfigured but
 * absent — the chat surface does not exist, so we return 404 (consistent
 * with the rest of the API's "feature not enabled → 404" convention).
 * A *present-but-empty/invalid* `AI_PROVIDER` is a misconfiguration of an
 * intended feature and surfaces as 503 from the service layer below.
 */
const aiDisabledResponse = (c: Context): Response | undefined => {
  const provider = process.env.AI_PROVIDER
  if (provider === undefined) {
    return notFound(c, 'AI is not enabled. Set AI_PROVIDER to enable AI features.')
  }
  return undefined
}

/**
 * Run the per-user chat rate-limit gate for one request (the AI chat rate requirement-*).
 *
 * Keyed by the acting user's id so different users have independent counters
 * A no-op unless `AI_CHAT_RATE_LIMIT` is set, so the
 * rest of the chat specs (which never set it) are unaffected. Returns a 429
 * `Response` (with `Retry-After`) when the request must be rejected, or the
 * limiter decision when the request may proceed — the decision carries the
 * remaining quota surfaced as `X-RateLimit-Remaining` on the 200 response.
 */
const applyChatRateLimit = (
  c: Context
): { readonly rejected: Response } | { readonly decision: ChatRateLimitDecision } => {
  const session = getSessionContext(c)
  const principalKey = session?.userId ?? 'anonymous'
  const decision = checkChatRateLimit(principalKey)
  return decision.limited ? { rejected: rateLimitedResponse(c, decision.retryAfter) } : { decision }
}

/**
 * Handle an agent-bound chat turn — `POST /api/ai/chat` with `{ agent }`, and
 * the transport behind `POST /api/ai/agents/:name/chat`.
 *
 * It runs the SAME `runChatTurn` dispatch a generic turn runs, parameterised by
 * the agent's {@link AgentTurnBinding}. Everything the agent adds — system
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
  req: { readonly message: string; readonly sessionId: string; readonly agentName: string }
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
  })
}

interface AgentTurnScope {
  readonly binding: AgentTurnBinding
  readonly userRole: string
  readonly effectiveRoles: readonly string[]
  readonly reader: ChatReader
}

/**
 * The binding of an agent-bound turn and the principal its tools read as.
 *
 * A DECLARED agent acts under its declared role, not the caller's — that is
 * what makes an agent's reach a property of the config rather than of whoever
 * happens to be chatting with it. An agent has no user
 * identity and therefore no group memberships, so its effective-role list is
 * its declared role alone: widening this to the CALLER's groups would be a
 * privilege escalation, not a group-awareness fix.
 *
 * Its reach is a ceiling, never a grant to its caller: when a signed-in person
 * chats with it, its tools read the intersection of its reach and hers
 * (`agentReader`), so an admin-role agent never hands a member a row her
 * row-level rule hides or a field she may not read. A visitor signed in to
 * nothing, using an agent open to everyone, reads the anonymous reach
 * (`agentCaller`).
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
  const binding = resolveAgentTurnBinding(app, agentName)
  // Its trigger grant, as on every road into an agent; refused as undeclared.
  if (binding === undefined || !(await mayTriggerAgentNamed(c, app, agentName))) return undefined
  const caller = await agentCaller(c, app)
  return {
    binding,
    userRole: binding.role,
    effectiveRoles: [binding.role],
    reader: agentReader(binding.role, caller),
  }
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

  // Agent-bound turn: when the body names a declared `app.agents[]` entry,
  // delegate to the agent-chat handler so the agent's `systemPrompt`, `model`,
  // and `temperature` overrides reach the AI provider ([internal ref]-*).
  if (parsed.agent !== undefined && app !== undefined) {
    return runAgentBoundChatTurn(c, app, { message, sessionId, agentName: parsed.agent })
  }

  // Identify the acting user for activity monitoring
  // and resolve their role — drives table RBAC and the per-request context.
  const session = getSessionContext(c)
  const actorName = session?.userId ?? 'anonymous'
  const { userRole, effectiveRoles, reader } = await resolveUserPrincipal(c)

  // Build the per-request context block ([internal ref]-*), regenerated on
  // every turn so it always reflects the caller's current role.
  const systemPrompt = buildChatContextPrompt(app, userRole, parsed.pageContext)

  return runChatTurn(
    c,
    buildChatTurnInput({
      services: requireDomainContext(c),
      systemPrompt,
      message,
      sessionId,
      actorName,
      userRole,
      effectiveRoles,
      reader,
      app,
      confirmationToken: parsed.confirmationToken,
      pageContext: parsed.pageContext,
      rateLimitRemaining: rateLimit.limit !== undefined ? rateLimit.remaining : undefined,
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
})

/**
 * Wrap a single provider attempt in the operator-tunable retry policy.
 *
 * Only TRANSIENT failures (503/429) are retried, up to `AI_CHAT_MAX_RETRIES`;
 * each retry re-runs the attempt and so produces one more recorded provider
 * request, which is what an AI chat error spec asserts on. A non-transient
 * failure (401/400) is never retried.
 */
const withChatRetries = (
  attempt: Effect.Effect<ChatReply, ChatTurnError, AiService>,
  maxRetries: number | undefined
): Effect.Effect<ChatReply, ChatTurnError, AiService> =>
  maxRetries === undefined
    ? attempt
    : attempt.pipe(Effect.retry({ while: isTransientChatError, times: maxRetries }))

/**
 * The tables a turn's tools may reach: the RBAC-readable set for the acting
 * role, narrowed for an agent-bound turn to the agent's
 * declared allowlist.
 *
 * The RBAC gate runs FIRST and through the same code either way, so an
 * allowlist can only ever subtract — it never grants an agent a table its role
 * cannot read.
 */
const resolveTurnToolTables = (input: ChatTurnInput): ReturnType<typeof toToolCallTables> => {
  const allowlist = input.agent?.toolTables
  return toToolCallTables(input.app, input.reader).filter(
    (table) => allowlist === undefined || allowlist.includes(table.name)
  )
}

/**
 * The per-agent provider overrides an agent-bound turn layers onto the shared
 * `ai.chat` call — empty for a generic turn. The port forwards each onto
 * whichever wire format the resolved provider speaks, which is precisely what
 * the old hard-coded `/chat/completions` fetch could not do.
 */
const agentProviderOverrides = (
  agent: AgentTurnBinding | undefined
): { readonly model?: string; readonly temperature?: number; readonly maxTokens?: number } =>
  agent === undefined
    ? {}
    : {
        temperature: agent.temperature,
        ...(agent.model !== undefined && { model: agent.model }),
        ...(agent.maxTokens !== undefined && { maxTokens: agent.maxTokens }),
      }

/**
 * Dispatch one chat turn to the `AiService` port and map the tagged-error
 * union onto HTTP status codes. The optional
 * `AI_CHAT_TIMEOUT` deadline is threaded into the provider call; transient
 * failures (503/429) are retried up to `AI_CHAT_MAX_RETRIES` while
 * non-transient ones fail fast (an AI chat error spec — each retry is one
 * more recorded provider request). The response carries a fixed, user-friendly
 * message — the raw provider message is never forwarded to the caller.
 *
 * The turn's message list is the fresh system prompt, then the session's prior
 * exchanges loaded from DURABLE storage so history survives a restart
 * then the new user message. It is
 * kept in a local because the tool-calling loop extends it with tool results.
 *
 * The program runs on the observability runtime under the request-edge
 * `http.server` root span, so the `AiService.chat` seam's `ai.request` child
 * span chains under the request root.
 *
 * Both agent-bound and generic turns come through here — see
 * {@link runAgentBoundChatTurn} for what an agent adds and what it skips.
 */
/**
 * Render a chat-turn provider failure, and record it.
 *
 * `code` follows the status rather than flattening all three onto
 * SERVICE_UNAVAILABLE: 502 is BAD_GATEWAY, 504 is GATEWAY_TIMEOUT, and only
 * the 503 keeps SERVICE_UNAVAILABLE. See {@link chatErrorCode} for why the
 * distinction is worth carrying.
 */
const chatProviderFailure = async (
  c: Context,
  failure: ChatTurnError,
  actorName: string
): Promise<Response> => {
  const status = chatErrorStatus(failure)
  // Best-effort: record the failed turn in activity monitoring so failures are
  // observable alongside successful turns.
  await recordChatActivity(requireDomainContext(c), { action: 'ai.chat.error', actorName })
  return c.json(errorBody({ error: chatErrorMessage(status), code: chatErrorCode(status) }), status)
}

/**
 * The prior exchanges a turn replays to the provider, or none.
 *
 * An agent-bound turn deliberately does NOT replay history — it never has, on
 * either agent transport, and unifying the transports changed the transport,
 * not the conversation model. It is observable, too: fact extraction re-derives
 * a fact per turn, so a replayed history makes an agent re-learn its FIRST fact
 * every turn.
 */
const replayedHistory = async (input: ChatTurnInput): Promise<ReadonlyArray<ChatMessage>> =>
  input.agent !== undefined && input.agent.builtIn !== true
    ? []
    : loadDurableHistory(input.services, input.actorName, input.sessionId)

const runChatTurn = async (c: Context, input: ChatTurnInput): Promise<Response> => {
  // Lazy retention sweep — delete this user's conversations older than
  // `AI_MEMORY_MAX_AGE_DAYS` before the new turn lands.
  await applyRetentionPolicy(input.services, input.actorName)
  // Prepend the session's prior user/assistant exchanges so the provider sees
  // the full conversation, not just the latest message.
  // History is loaded from durable storage so it survives a
  // process restart; the system prompt above is regenerated per turn.
  // The agent carve-out lives in `replayedHistory` below.
  const history = await replayedHistory(input)
  const errorConfig = resolveChatErrorConfig()

  const toolTables = resolveTurnToolTables(input)
  const toolDefs = toolTables.map((t) => ({ name: t.name, columns: t.readableColumns }))
  const tools: ReadonlyArray<ChatToolDefinition> = buildChatToolDefinitions(toolDefs)

  // Kept in a local so the tool-calling loop can extend it with tool results.
  const baseMessages: ReadonlyArray<ChatMessage> = [
    { role: 'system', content: input.systemPrompt },
    ...history,
    { role: 'user', content: input.message },
  ]

  // The deadline is threaded into `ChatInput.timeoutMs` so the live adapter
  // aborts the fetch deterministically.
  const { agent } = input
  const oneAttempt: Effect.Effect<ChatReply, ChatTurnError, AiService> = Effect.gen(function* () {
    const ai = yield* AiService
    return yield* ai.chat({
      messages: baseMessages,
      ...(tools.length > 0 && { tools }),
      ...(errorConfig.timeoutMs !== undefined && { timeoutMs: errorConfig.timeoutMs }),
      ...agentProviderOverrides(agent),
    })
  })

  const program = withChatRetries(oneAttempt, errorConfig.maxRetries)

  // Run on the observability runtime under the request-edge root `http.server`
  // span so the shared `AiService.chat` seam's `ai.request` child span chains
  // under the request root.
  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))

  if (result._tag === 'Failure') {
    return await chatProviderFailure(c, result.failure, input.actorName)
  }

  // Function/tool-calling path: a reply carrying
  // `toolCalls` drives the tool-calling loop. Otherwise fall through to the
  // regular query/mutation completion path.
  if (result.success.toolCalls !== undefined && result.success.toolCalls.length > 0) {
    return completeToolCallingTurn(c, {
      services: input.services,
      initialReply: result.success,
      baseMessages,
      tools,
      tables: toolTables,
      app: input.app,
      reader: input.reader,
      actorName: input.actorName,
      sessionId: input.sessionId,
      userMessage: input.message,
      rateLimitRemaining: input.rateLimitRemaining,
      ...(agentAttribution(agent) !== undefined && { agentName: agentAttribution(agent) }),
    })
  }

  // An agent-bound turn that produced plain prose completes here rather than in
  // `finishChatTurn`. The NL record-query / mutation / automation-trigger
  // pipeline is the GENERIC chat surface's contract: an agent answers under its
  // own system prompt, and routing its prose through those parsers would let a
  // phrase like "show me the open ones" silently replace the agent's answer
  // with a table dump. Tool calling — which an agent DOES take part in — is
  // handled above, before this split.
  if (agent !== undefined) {
    return finishAgentTurn(c, input, agent, result.success.content)
  }

  return finishChatTurn(c, input, result.success.content)
}

/**
 * Complete an agent-bound turn that returned prose: persist the exchange
 * (tagged with the agent so the row is attributed regardless of which transport
 * carried it — an AI memory spec), record activity, and return the standard
 * `{ reply, actions, sessionId }` envelope.
 *
 * `actions` is empty because a prose turn took none — not because the field is
 * unimplemented. A turn that DID act returns its actions from the tool-calling
 * loop above.
 */
const finishAgentTurn = async (
  c: Context,
  input: ChatTurnInput,
  agent: AgentTurnBinding,
  reply: string
): Promise<Response> => {
  appendConversationTurn(input.sessionId, input.message, reply)
  await persistChatTurnDurably(input.services, {
    userId: input.actorName,
    sessionId: input.sessionId,
    userMessage: input.message,
    assistantReply: reply,
    ...(agentAttribution(agent) !== undefined && { agentName: agentAttribution(agent) }),
  })
  await recordChatActivity(input.services, {
    action: 'ai.chat.message',
    actorName: input.actorName,
  })
  return respondWithActions(c, {
    reply,
    actions: [],
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}

// ---------------------------------------------------------------------------
// Streaming variant — POST /api/ai/chat/stream
// ---------------------------------------------------------------------------
//
// The SSE encoding, `AI_CHAT_STREAM_TIMEOUT` handling, and durable persistence
// for the streaming transport live in `ai/chat-stream.ts` (`buildStreamResponse`),
// keeping this file under the `max-lines` cap. This handler stays here so the
// route registration and auth wiring are co-located with the buffered route.

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
  // Identify the acting user so the completed streamed exchange can be
  // persisted to that user's durable conversation history.
  const session = getSessionContext(c)
  const userId = session?.userId ?? 'anonymous'
  return buildStreamResponse(c, {
    services: requireDomainContext(c),
    message: parsed.message,
    sessionId: parsed.sessionId,
    userId,
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
  // Conversation-history routes (GET list, GET :sessionId, DELETE :sessionId)
  // for durable chat memory. Auth is
  // enforced by the `authMiddleware + requireAuth` chain in `api-routes.ts`.
  return chainAiConversationRoutes(withChat)
}
