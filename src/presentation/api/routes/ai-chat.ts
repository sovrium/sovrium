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
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { chatRequestSchema, type ChatResponse, type ChatAction } from '@/domain/models/api/ai/chat'
import { type ContextPageScope } from '@/domain/services/ai-chat/ai-chat-context'
import { buildChatToolDefinitions } from '@/domain/services/ai-chat/ai-chat-tools'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { handleAgentChat } from '@/presentation/api/routes/agents/agent-chat'
import {
  recordActivityLogRow,
  recordChatActivity,
} from '@/presentation/api/routes/ai/chat-activity-log'
import { completeTriggerTurn } from '@/presentation/api/routes/ai/chat-automation-flow'
import { buildChatContextPrompt } from '@/presentation/api/routes/ai/chat-context-prompt'
import { appendConversationTurn } from '@/presentation/api/routes/ai/chat-conversation-store'
import {
  applyRetentionPolicy,
  loadDurableHistory,
  persistTurnDurably,
} from '@/presentation/api/routes/ai/chat-durable-memory'
import {
  chatErrorMessage,
  chatErrorStatus,
  isTransientChatError,
  resolveChatErrorConfig,
  type ChatTurnError,
} from '@/presentation/api/routes/ai/chat-error-handling'
import {
  evaluateMutationTurn,
  resolveUserEmail,
  type MutationTurnResult,
} from '@/presentation/api/routes/ai/chat-mutation-flow'
import { evaluateQueryTurn } from '@/presentation/api/routes/ai/chat-query-flow'
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
 * Resolve the current user's role from the authenticated session.
 *
 * The generic `/api/ai/chat` route is `requireAuth`-gated, so a session is
 * normally present. The `?? 'member'` fallback keeps the handler total in the
 * defensive case where the session is somehow absent — the context builder
 * then describes only tables the default role can read.
 */
const resolveUserRole = async (c: Readonly<Context>): Promise<string> => {
  const session = getSessionContext(c as unknown as Context)
  if (session === undefined) return 'member'
  return getUserRole(session.userId)
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
 * Handle an agent-bound chat turn: delegate to {@link handleAgentChat}, then —
 * on a successful turn — persist the completed exchange to durable
 * conversation history. The agent path
 * otherwise skips the `finishChatTurn` persistence the generic path runs, so
 * agent chats would not survive a restart or appear in the conversation list.
 */
const handleAgentBoundChat = async (
  c: Readonly<Context>,
  app: App,
  req: { readonly message: string; readonly sessionId: string; readonly agentName: string }
): Promise<Response> => {
  const result = await handleAgentChat(app, req)
  const { reply } = result.body
  if (result.status === 200 && typeof reply === 'string') {
    const session = getSessionContext(c as unknown as Context)
    const actorName = session?.userId ?? 'anonymous'
    appendConversationTurn(req.sessionId, req.message, reply)
    // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
    await persistTurnDurably(actorName, req.sessionId, req.message, reply)
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.message', actorName })
  }
  return c.json(result.body, result.status)
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
    return handleAgentBoundChat(c, app, { message, sessionId, agentName: parsed.agent })
  }

  // Identify the acting user for activity monitoring
  // and resolve their role — drives table RBAC and the per-request context.
  const session = getSessionContext(c as unknown as Context)
  const actorName = session?.userId ?? 'anonymous'
  const userRole = await resolveUserRole(c)

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
  ...(parts.app !== undefined && { app: parts.app }),
  ...(parts.confirmationToken !== undefined && { confirmationToken: parts.confirmationToken }),
  ...(parts.pageContext !== undefined && { pageContext: parts.pageContext }),
  ...(parts.rateLimitRemaining !== undefined && {
    rateLimitRemaining: parts.rateLimitRemaining,
  }),
})

/** Inputs for a single non-agent chat turn dispatched to the AI provider. */
interface ChatTurnInput {
  readonly systemPrompt: string
  readonly message: string
  readonly sessionId: string
  /** Acting user's identifier — written to the activity log for this turn. */
  readonly actorName: string
  /** Acting user's role — drives table-level RBAC for record mutations. */
  readonly userRole: string
  /** App schema — present when the turn may trigger a record mutation. */
  readonly app?: App
  /** Confirmation token from the request body, when re-confirming a delete. */
  readonly confirmationToken?: string
  /**
   * Optional page scope (`allowedTables`) narrowing the table list visible to
   * a record query.
   */
  readonly pageContext?: ContextPageScope
  /**
   * Remaining chat quota within the current rate-limit window. Present only
   * when `AI_CHAT_RATE_LIMIT` is configured — surfaced as the
   * `X-RateLimit-Remaining` response header.
   */
  readonly rateLimitRemaining?: number
}

/**
 * Dispatch one chat turn to the `AiService` port and map the tagged-error
 * union onto HTTP status codes. The optional
 * `AI_CHAT_TIMEOUT` deadline is threaded into the provider call; transient
 * failures (503/429) are retried up to `AI_CHAT_MAX_RETRIES` while
 * non-transient ones fail fast. The response carries a fixed, user-friendly
 * message — the raw provider message is never forwarded to the caller.
 */
const runChatTurn = async (c: Readonly<Context>, input: ChatTurnInput): Promise<Response> => {
  // Lazy retention sweep — delete this user's conversations older than
  // `AI_MEMORY_MAX_AGE_DAYS` before the new turn lands.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort retention side effect
  await applyRetentionPolicy(input.actorName)
  // Prepend the session's prior user/assistant exchanges so the provider sees
  // the full conversation, not just the latest message.
  // History is loaded from durable PostgreSQL storage so it
  // survives a process restart; `buildAiChatContext` already produced a fresh
  // system prompt — the history carries only the turn-by-turn messages.
  const history = await loadDurableHistory(input.actorName, input.sessionId)
  const errorConfig = resolveChatErrorConfig()

  // RBAC-scoped tool definitions: one `query_<table>` tool per readable table
  // — unauthorized tables produce no tool.
  const toolTables = toToolCallTables(input.app, input.userRole)
  const tools: ReadonlyArray<ChatToolDefinition> = buildChatToolDefinitions(
    toolTables.map((table) => ({ name: table.name, columns: table.readableColumns }))
  )

  // Kept in a local so the tool-calling loop can extend it with tool results.
  const baseMessages: ReadonlyArray<ChatMessage> = [
    { role: 'system', content: input.systemPrompt },
    ...history,
    { role: 'user', content: input.message },
  ]

  // One provider attempt — the optional `AI_CHAT_TIMEOUT` deadline is threaded
  // into `ChatInput.timeoutMs` so the live adapter aborts the underlying fetch
  // at the deadline (deterministic; [internal ref]). The tool
  // definitions are advertised so the model may request a tool call.
  const oneAttempt: Effect.Effect<ChatReply, ChatTurnError, AiService> = Effect.gen(function* () {
    const ai = yield* AiService
    return yield* ai.chat({
      messages: baseMessages,
      ...(tools.length > 0 && { tools }),
      ...(errorConfig.timeoutMs !== undefined && { timeoutMs: errorConfig.timeoutMs }),
    })
  })

  // Retry only transient failures (503/429), up to `AI_CHAT_MAX_RETRIES`. Each
  // retry re-runs `oneAttempt`, producing one more recorded provider request —
  // which is what [internal ref] asserts on. A non-transient failure
  // (401/400) is never retried.
  const program: Effect.Effect<ChatReply, ChatTurnError, AiService> =
    errorConfig.maxRetries === undefined
      ? oneAttempt
      : oneAttempt.pipe(
          Effect.retry({ while: isTransientChatError, times: errorConfig.maxRetries })
        )

  // Run on the observability runtime under the request-edge root `http.server`
  // span so the shared `AiService.chat` seam's `ai.request` child span chains
  // under the request root (`Effect.either` already discharged requirements).
  const result = await runRequestEffect(c, program.pipe(provideAiLive, Effect.either))

  if (result._tag === 'Left') {
    const status = chatErrorStatus(result.left)
    // Best-effort: record the failed turn in activity monitoring so failures
    // are observable alongside successful turns.
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    return c.json({ error: chatErrorMessage(status) }, status)
  }

  // Function/tool-calling path: a reply carrying
  // `toolCalls` drives the tool-calling loop. Otherwise fall through to the
  // regular query/mutation completion path.
  if (result.right.toolCalls !== undefined && result.right.toolCalls.length > 0) {
    return completeToolCallingTurn(c, {
      initialReply: result.right,
      baseMessages,
      tools,
      tables: toolTables,
      userRole: input.userRole,
      actorName: input.actorName,
      sessionId: input.sessionId,
      userMessage: input.message,
      rateLimitRemaining: input.rateLimitRemaining,
    })
  }

  return finishChatTurn(c, input, result.right.content)
}

/**
 * Complete a chat turn after a successful AI provider response: evaluate the
 * turn against the record-mutation pipeline,
 * short-circuit to HTTP 403 on a `forbidden` outcome, persist the exchange,
 * record activity, and build the `{ reply, actions, pendingConfirmation? }`
 * response envelope.
 */
const finishChatTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  aiReply: string
): Promise<Response> => {
  // Read-query path. Evaluated before the mutation
  // path because a query verb ("show", "how many") and a mutation verb
  // ("create", "update", "delete") are disjoint — but a query message such as
  // "Show users where …; DROP TABLE users;--" must be read as a *query*, not a
  // delete. A `forbidden` query short-circuits to HTTP 403; an `answered`
  // query owns the reply text and the `type: 'query'` action.
  const query = await evaluateQueryTurn({
    app: input.app,
    message: input.message,
    sessionId: input.sessionId,
    userRole: input.userRole,
    ...(input.pageContext !== undefined && { pageContext: input.pageContext }),
  })
  if (query.kind === 'forbidden') {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    // S1 anti-enumeration: authz denials in chat (table/record query) return 404
    // so the user cannot enumerate which tables they lack access to.
    // `query.message` is intentionally discarded from the response envelope.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  if (query.kind === 'answered') {
    return finishQueryTurn(c, input, query.reply, query.action)
  }

  // Automation-trigger path. Evaluated before
  // the mutation path because a trigger verb ("run", "trigger") is disjoint
  // from a mutation verb ("create", "update", "delete"). `completeTriggerTurn`
  // owns the whole completion path — a `forbidden` trigger becomes HTTP 403,
  // a `triggered` / `not-triggerable` / `not-found` turn becomes the 200
  // envelope; `undefined` means the turn is not a trigger turn.
  const triggerResponse = await completeTriggerTurn(c, {
    app: input.app,
    message: input.message,
    sessionId: input.sessionId,
    userRole: input.userRole,
    actorName: input.actorName,
    aiReply,
    rateLimitRemaining: input.rateLimitRemaining,
  })
  if (triggerResponse !== undefined) return triggerResponse

  // The mutation parser owns intent extraction (the E2E mock AI never returns
  // structured actions for these prompts), so the AI provider is used purely
  // for the conversational reply.
  const mutation = await evaluateMutationTurn({
    app: input.app,
    message: input.message,
    userId: input.actorName,
    userRole: input.userRole,
    ...(input.confirmationToken !== undefined && {
      confirmationToken: input.confirmationToken,
    }),
  })
  if (mutation.kind === 'forbidden') {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    // S1 anti-enumeration: authz denials in chat (record mutation) return 404
    // so the user cannot enumerate which tables they lack write access to.
    // `mutation.message` is intentionally discarded from the response envelope.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return finishMutationTurn(c, input, aiReply, mutation)
}

/**
 * Complete a chat turn after the (non-forbidden) record-mutation pipeline
 * resolved it. The reply text is the executor's summary for an applied
 * mutation (so the created/updated record details surface —
 * [internal ref]), the validation message for a rejected
 * mutation, or the AI's text otherwise. Persists the exchange to conversation
 * history, records `ai.chat.message` activity, and builds the
 * `{ reply, actions, pendingConfirmation? }` envelope.
 */
const finishMutationTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  aiReply: string,
  mutation: Exclude<MutationTurnResult, { kind: 'forbidden' }>
): Promise<Response> => {
  const reply = resolveReply(aiReply, mutation)

  // Persist this completed exchange so the *next* turn on the same session
  // carries it forward. The in-memory store keeps the
  // sessionless `anonymous` fallback working; durable PostgreSQL persistence
  // makes history survive a restart and powers the conversation endpoints.
  appendConversationTurn(input.sessionId, input.message, reply)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)
  // Record the interaction in activity monitoring.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })

  const actions: ReadonlyArray<ChatAction> = mutation.kind === 'applied' ? mutation.actions : []
  const body: ChatResponse = {
    reply,
    actions: [...actions],
    sessionId: input.sessionId,
    ...(mutation.kind === 'pending' && { pendingConfirmation: mutation.pendingConfirmation }),
  }
  // Surface the remaining chat quota so clients can self-throttle
  //. Header is present only when rate limiting is set.
  if (input.rateLimitRemaining !== undefined) {
    return c.json(body, 200, {
      'X-RateLimit-Remaining': input.rateLimitRemaining.toString(),
    })
  }
  return c.json(body, 200)
}

/**
 * Complete a chat turn after the read-query pipeline answered it
 *. Persists the exchange to conversation history,
 * records an `ai.chat.query` activity row attributed to the acting user's
 * email, and builds the `{ reply, actions }` envelope
 * with the single `type: 'query'` action.
 */
const finishQueryTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  reply: string,
  action: ChatAction
): Promise<Response> => {
  appendConversationTurn(input.sessionId, input.message, reply)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)
  // Record the read query in activity monitoring with explicit user
  // attribution. Best-effort — a logging failure must
  // never break the chat turn.
  const userEmail = await resolveUserEmail(input.actorName)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordActivityLogRow({
    actorType: 'user',
    actorName: input.actorName,
    action: 'ai.chat.query',
    targetTable: action.table,
    userEmail,
  })
  return respondWithActions(c, {
    reply,
    actions: [action],
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}

/**
 * Choose the reply text for a chat turn: the mutation executor's summary /
 * message takes precedence over the raw AI text when the turn was a record
 * mutation, so the created/updated record details ([internal ref] /
 * 015) and validation errors surface to the caller.
 */
const resolveReply = (aiReply: string, mutation: MutationTurnResult): string => {
  switch (mutation.kind) {
    case 'applied':
      return mutation.summary
    case 'validation-error':
      return mutation.message
    case 'pending':
      return mutation.pendingConfirmation.description
    case 'cancelled':
      return 'Okay — the action was cancelled. No records were changed.'
    case 'none':
    case 'forbidden':
      return aiReply
  }
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
 * declared `app.agents[]` entry, the turn is delegated to `handleAgentChat`
 * so the agent's per-agent overrides reach the AI provider.
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
