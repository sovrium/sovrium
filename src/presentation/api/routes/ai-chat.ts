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
import { buildEffectiveRoles, getUserGroups } from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { chatRequestSchema } from '@/domain/models/api/ai/chat'
import { type ContextPageScope } from '@/domain/services/ai-chat/ai-chat-context'
import { buildChatToolDefinitions } from '@/domain/services/ai-chat/ai-chat-tools'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import {
  resolveAgentTurnBinding,
  type AgentTurnBinding,
} from '@/presentation/api/routes/agents/agent-chat'
import { recordChatActivity } from '@/presentation/api/routes/ai/chat-activity-log'
import { buildChatContextPrompt } from '@/presentation/api/routes/ai/chat-context-prompt'
import { appendConversationTurn } from '@/presentation/api/routes/ai/chat-conversation-store'
import {
  applyRetentionPolicy,
  loadDurableHistory,
  persistChatTurnDurably,
} from '@/presentation/api/routes/ai/chat-durable-memory'
import {
  chatErrorMessage,
  chatErrorStatus,
  isTransientChatError,
  resolveChatErrorConfig,
  type ChatTurnError,
} from '@/presentation/api/routes/ai/chat-error-handling'
import {
  checkChatRateLimit,
  type ChatRateLimitDecision,
} from '@/presentation/api/routes/ai/chat-rate-limit'
import { buildStreamResponse } from '@/presentation/api/routes/ai/chat-stream'
import {
  completeToolCallingTurn,
  toToolCallTables,
  respondWithActions,
} from '@/presentation/api/routes/ai/chat-tool-calling'
import {
  finishChatTurn,
  type ChatTurnInput,
} from '@/presentation/api/routes/ai/chat-turn-completion'
import { chainAiConversationRoutes } from '@/presentation/api/routes/ai/conversations-route'
import { provideAiLive } from '@/presentation/api/routes/ai/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Hono, Context } from 'hono'

/**
 * Generic AI Chat route — `POST /api/ai/chat`.
 *
 * This is the cross-cutting chat endpoint asserted by
 * `[internal ref]` (`[internal ref]` and
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
   *. When present and it resolves to a stashed
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
  c: Readonly<Context>
): Promise<ChatRequestPayload | { readonly error: string }> => {
  const raw = (await c.req.json().catch(() => undefined)) as unknown
  const parsed = chatRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid request body' }
  }
  // Enforce the operator-tunable `AI_CHAT_MAX_MESSAGE_LENGTH` cap. Unset → no
  // limit; an over-length message is rejected with a 400 carrying a message
  // that mentions "length" so callers can distinguish it from other 400s
  //.
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
const aiDisabledResponse = (c: Readonly<Context>): Response | undefined => {
  const provider = process.env.AI_PROVIDER
  if (provider === undefined) {
    return c.json({ error: 'AI is not enabled. Set AI_PROVIDER to enable AI features.' }, 404)
  }
  return undefined
}

/**
 * Resolve the current user's role AND group memberships from the authenticated
 * session, returning both the bare role and the effective-role list that table
 * RBAC is evaluated against.
 *
 * The generic `/api/ai/chat` route is `requireAuth`-gated, so a session is
 * normally present. The `'member'` fallback keeps the handler total in the
 * defensive case where the session is somehow absent — the context builder
 * then describes only tables the default role can read.
 *
 * Groups matter here because a table permission may name `group:<name>`, which
 * a bare role string can never match. Unlike the HTTP table routes there is no
 * `enrichUserRole` middleware on this path, so the lookup is made explicitly —
 * `getUserGroups` is documented as a plain async lookup with no request
 * context for exactly this caller shape, and never throws.
 */
const resolveUserPrincipal = async (
  c: Readonly<Context>
): Promise<{ readonly userRole: string; readonly effectiveRoles: readonly string[] }> => {
  const session = getSessionContext(c as unknown as Context)
  if (session === undefined) return { userRole: 'member', effectiveRoles: ['member'] }
  const [userRole, userGroups] = await Promise.all([
    getUserRole(session.userId),
    getUserGroups(session.userId),
  ])
  return { userRole, effectiveRoles: buildEffectiveRoles(userRole, userGroups) }
}

/**
 * Run the per-user chat rate-limit gate for one request ([internal ref]-*).
 *
 * Keyed by the acting user's id so different users have independent counters
 *. A no-op unless `AI_CHAT_RATE_LIMIT` is set, so the
 * rest of the chat specs (which never set it) are unaffected. Returns a 429
 * `Response` (with `Retry-After`) when the request must be rejected, or the
 * limiter decision when the request may proceed — the decision carries the
 * remaining quota surfaced as `X-RateLimit-Remaining` on the 200 response.
 */
const applyChatRateLimit = (
  c: Readonly<Context>
): { readonly rejected: Response } | { readonly decision: ChatRateLimitDecision } => {
  const session = getSessionContext(c as unknown as Context)
  const principalKey = session?.userId ?? 'anonymous'
  const decision = checkChatRateLimit(principalKey)
  if (decision.limited) {
    return {
      rejected: c.json(
        { error: 'You have exceeded the AI chat rate limit. Please try again later.' },
        429,
        { 'Retry-After': decision.retryAfter.toString() }
      ),
    }
  }
  return { decision }
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
 * That is the whole point of the shape. The agent path used to be its own
 * transport (a hard-coded `${baseUrl}/chat/completions` fetch), and every
 * capability the generic path gained afterwards silently skipped it: tool
 * EXECUTION, `actions[]`, provider-aware endpoint selection, agent attribution
 * on the persisted row. Each was a separate defect with a separate spec; all
 * four had one cause.
 *
 * A 404 for an undeclared agent is decided here rather than inside the turn:
 * the agent name is request DATA, and a name the app never declared is a bad
 * request, not a provider failure.
 */
export const runAgentBoundChatTurn = async (
  c: Readonly<Context>,
  app: App,
  req: { readonly message: string; readonly sessionId: string; readonly agentName: string }
): Promise<Response> => {
  const binding = resolveAgentTurnBinding(app, req.agentName)
  if (binding === undefined) {
    return c.json({ error: `Agent '${req.agentName}' is not declared in the app schema.` }, 404)
  }
  const session = getSessionContext(c as unknown as Context)
  const actorName = session?.userId ?? 'anonymous'
  return runChatTurn(c, {
    systemPrompt: binding.systemPrompt,
    message: req.message,
    sessionId: req.sessionId,
    actorName,
    // The agent acts under its DECLARED role, not the caller's — that is what
    // makes an agent's reach a property of the config rather than of whoever
    // happens to be chatting with it. An agent has no
    // user identity and therefore no group memberships, so its effective-role
    // list is its declared role alone: widening this to the CALLER's groups
    // would be a privilege escalation, not a group-awareness fix.
    userRole: binding.role,
    effectiveRoles: [binding.role],
    app,
    agent: binding,
  })
}

const handleChat = async (c: Readonly<Context>, app?: App): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400)
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
  const session = getSessionContext(c as unknown as Context)
  const actorName = session?.userId ?? 'anonymous'
  const { userRole, effectiveRoles } = await resolveUserPrincipal(c)

  // Build the per-request context block ([internal ref]-*), regenerated on
  // every turn so it always reflects the caller's current role.
  const systemPrompt = buildChatContextPrompt(app, userRole, parsed.pageContext)

  return runChatTurn(
    c,
    buildChatTurnInput({
      systemPrompt,
      message,
      sessionId,
      actorName,
      userRole,
      effectiveRoles,
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
  readonly app: App | undefined
  readonly confirmationToken: string | undefined
  readonly pageContext: ContextPageScope | undefined
  readonly rateLimitRemaining: number | undefined
}): ChatTurnInput => ({
  systemPrompt: parts.systemPrompt,
  message: parts.message,
  sessionId: parts.sessionId,
  actorName: parts.actorName,
  userRole: parts.userRole,
  effectiveRoles: parts.effectiveRoles,
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
 * request, which is what [internal ref] asserts on. A non-transient
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
  return toToolCallTables(input.app, input.userRole, input.effectiveRoles).filter(
    (table) => allowlist === undefined || allowlist.includes(table.name)
  )
}

/**
 * The per-agent provider overrides an agent-bound turn layers onto the shared
 * `ai.chat` call — empty for a generic turn. The port forwards each onto
 * whichever wire format the resolved provider speaks, which is precisely what
 * the old hard-coded `/chat/completions` fetch could not do
 *.
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
 * non-transient ones fail fast ([internal ref] — each retry is one
 * more recorded provider request). The response carries a fixed, user-friendly
 * message — the raw provider message is never forwarded to the caller.
 *
 * The turn's message list is the fresh system prompt, then the session's prior
 * exchanges loaded from DURABLE storage so history survives a restart
 *, then the new user message. It is
 * kept in a local because the tool-calling loop extends it with tool results.
 *
 * The program runs on the observability runtime under the request-edge
 * `http.server` root span, so the `AiService.chat` seam's `ai.request` child
 * span chains under the request root.
 *
 * Both agent-bound and generic turns come through here — see
 * {@link runAgentBoundChatTurn} for what an agent adds and what it skips.
 */
const runChatTurn = async (c: Readonly<Context>, input: ChatTurnInput): Promise<Response> => {
  // Lazy retention sweep — delete this user's conversations older than
  // `AI_MEMORY_MAX_AGE_DAYS` before the new turn lands.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort retention side effect
  await applyRetentionPolicy(input.actorName)
  // Prepend the session's prior user/assistant exchanges so the provider sees
  // the full conversation, not just the latest message.
  // History is loaded from durable storage so it survives a
  // process restart; the system prompt above is regenerated per turn.
  //
  // An agent-bound turn deliberately does NOT replay history — it never has,
  // on either agent transport, and the unification onto this dispatch changes
  // the transport, not the conversation model. Silently switching agents to
  // stateful turns here would be a product change smuggled in as a refactor,
  // and it is observable: fact extraction re-derives a fact per turn, so a
  // replayed history makes an agent re-learn its FIRST fact every turn
  //. Whether agent chat SHOULD carry
  // history is a real question — it just is not this change's to answer.
  const history =
    input.agent !== undefined ? [] : await loadDurableHistory(input.actorName, input.sessionId)
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
  const result = await runRequestEffect(c, program.pipe(provideAiLive, Effect.result))

  if (result._tag === 'Failure') {
    const status = chatErrorStatus(result.failure)
    // Best-effort: record the failed turn in activity monitoring so failures
    // are observable alongside successful turns.
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    return c.json({ error: chatErrorMessage(status) }, status)
  }

  // Function/tool-calling path: a reply carrying
  // `toolCalls` drives the tool-calling loop. Otherwise fall through to the
  // regular query/mutation completion path.
  if (result.success.toolCalls !== undefined && result.success.toolCalls.length > 0) {
    return completeToolCallingTurn(c, {
      initialReply: result.success,
      baseMessages,
      tools,
      tables: toolTables,
      userRole: input.userRole,
      effectiveRoles: input.effectiveRoles,
      actorName: input.actorName,
      sessionId: input.sessionId,
      userMessage: input.message,
      rateLimitRemaining: input.rateLimitRemaining,
      ...(agent !== undefined && { agentName: agent.name }),
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
 * carried it — [internal ref]), record activity, and return the standard
 * `{ reply, actions, sessionId }` envelope.
 *
 * `actions` is empty because a prose turn took none — not because the field is
 * unimplemented. A turn that DID act returns its actions from the tool-calling
 * loop above.
 */
const finishAgentTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  agent: AgentTurnBinding,
  reply: string
): Promise<Response> => {
  appendConversationTurn(input.sessionId, input.message, reply)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistChatTurnDurably({
    userId: input.actorName,
    sessionId: input.sessionId,
    userMessage: input.message,
    assistantReply: reply,
    agentName: agent.name,
  })
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })
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

const handleChatStream = async (c: Readonly<Context>): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400)
  }
  // Identify the acting user so the completed streamed exchange can be
  // persisted to that user's durable conversation history.
  const session = getSessionContext(c as unknown as Context)
  const userId = session?.userId ?? 'anonymous'
  return buildStreamResponse(c, {
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
export function chainAiChatRoutes<T extends Hono>(honoApp: T, app?: App): T {
  const withChat = honoApp
    .post('/api/ai/chat', (c) => handleChat(c as unknown as Readonly<Context>, app))
    .post('/api/ai/chat/stream', (c) =>
      handleChatStream(c as unknown as Readonly<Context>)
    ) as unknown as T
  // Conversation-history routes (GET list, GET :sessionId, DELETE :sessionId)
  // for durable chat memory. Auth is
  // enforced by the `authMiddleware + requireAuth` chain in `api-routes.ts`.
  return chainAiConversationRoutes(withChat)
}
