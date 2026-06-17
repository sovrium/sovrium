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


interface ChatRequestPayload {
  readonly message: string
  readonly sessionId: string
  readonly agent?: string
  readonly confirmationToken?: string
  readonly pageContext?: ContextPageScope
}

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

const aiDisabledResponse = (c: Readonly<Context>): Response | undefined => {
  const provider = process.env.AI_PROVIDER
  if (provider === undefined) {
    return c.json({ error: 'AI is not enabled. Set AI_PROVIDER to enable AI features.' }, 404)
  }
  return undefined
}

const resolveUserRole = async (c: Readonly<Context>): Promise<string> => {
  const session = getSessionContext(c as unknown as Context)
  if (session === undefined) return 'member'
  return getUserRole(session.userId)
}

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
    await persistTurnDurably(actorName, req.sessionId, req.message, reply)
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

  const gate = applyChatRateLimit(c)
  if ('rejected' in gate) return gate.rejected
  const rateLimit = gate.decision

  if (parsed.agent !== undefined && app !== undefined) {
    return handleAgentBoundChat(c, app, { message, sessionId, agentName: parsed.agent })
  }

  const session = getSessionContext(c as unknown as Context)
  const actorName = session?.userId ?? 'anonymous'
  const userRole = await resolveUserRole(c)

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

interface ChatTurnInput {
  readonly systemPrompt: string
  readonly message: string
  readonly sessionId: string
  readonly actorName: string
  readonly userRole: string
  readonly app?: App
  readonly confirmationToken?: string
  readonly pageContext?: ContextPageScope
  readonly rateLimitRemaining?: number
}

const runChatTurn = async (c: Readonly<Context>, input: ChatTurnInput): Promise<Response> => {
  await applyRetentionPolicy(input.actorName)
  const history = await loadDurableHistory(input.actorName, input.sessionId)
  const errorConfig = resolveChatErrorConfig()

  const toolTables = toToolCallTables(input.app, input.userRole)
  const tools: ReadonlyArray<ChatToolDefinition> = buildChatToolDefinitions(
    toolTables.map((table) => ({ name: table.name, columns: table.readableColumns }))
  )

  const baseMessages: ReadonlyArray<ChatMessage> = [
    { role: 'system', content: input.systemPrompt },
    ...history,
    { role: 'user', content: input.message },
  ]

  const oneAttempt: Effect.Effect<ChatReply, ChatTurnError, AiService> = Effect.gen(function* () {
    const ai = yield* AiService
    return yield* ai.chat({
      messages: baseMessages,
      ...(tools.length > 0 && { tools }),
      ...(errorConfig.timeoutMs !== undefined && { timeoutMs: errorConfig.timeoutMs }),
    })
  })

  const program: Effect.Effect<ChatReply, ChatTurnError, AiService> =
    errorConfig.maxRetries === undefined
      ? oneAttempt
      : oneAttempt.pipe(
          Effect.retry({ while: isTransientChatError, times: errorConfig.maxRetries })
        )

  const result = await Effect.runPromise(program.pipe(provideAiLive, Effect.either))

  if (result._tag === 'Left') {
    const status = chatErrorStatus(result.left)
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    return c.json({ error: chatErrorMessage(status) }, status)
  }

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

const finishChatTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  aiReply: string
): Promise<Response> => {
  const query = await evaluateQueryTurn({
    app: input.app,
    message: input.message,
    sessionId: input.sessionId,
    userRole: input.userRole,
    ...(input.pageContext !== undefined && { pageContext: input.pageContext }),
  })
  if (query.kind === 'forbidden') {
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  if (query.kind === 'answered') {
    return finishQueryTurn(c, input, query.reply, query.action)
  }

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
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return finishMutationTurn(c, input, aiReply, mutation)
}

const finishMutationTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  aiReply: string,
  mutation: Exclude<MutationTurnResult, { kind: 'forbidden' }>
): Promise<Response> => {
  const reply = resolveReply(aiReply, mutation)

  appendConversationTurn(input.sessionId, input.message, reply)
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })

  const actions: ReadonlyArray<ChatAction> = mutation.kind === 'applied' ? mutation.actions : []
  const body: ChatResponse = {
    reply,
    actions: [...actions],
    sessionId: input.sessionId,
    ...(mutation.kind === 'pending' && { pendingConfirmation: mutation.pendingConfirmation }),
  }
  if (input.rateLimitRemaining !== undefined) {
    return c.json(body, 200, {
      'X-RateLimit-Remaining': input.rateLimitRemaining.toString(),
    })
  }
  return c.json(body, 200)
}

const finishQueryTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  reply: string,
  action: ChatAction
): Promise<Response> => {
  appendConversationTurn(input.sessionId, input.message, reply)
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)
  const userEmail = await resolveUserEmail(input.actorName)
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


const handleChatStream = async (c: Readonly<Context>): Promise<Response> => {
  const disabled = aiDisabledResponse(c)
  if (disabled) return disabled
  const parsed = await parseRequestBody(c)
  if ('error' in parsed) {
    return c.json({ error: parsed.error }, 400)
  }
  const session = getSessionContext(c as unknown as Context)
  const userId = session?.userId ?? 'anonymous'
  return buildStreamResponse(c, {
    message: parsed.message,
    sessionId: parsed.sessionId,
    userId,
  })
}

export function chainAiChatRoutes<T extends Hono>(honoApp: T, app?: App): T {
  const withChat = honoApp
    .post('/api/ai/chat', (c) => handleChat(c as unknown as Readonly<Context>, app))
    .post('/api/ai/chat/stream', (c) =>
      handleChatStream(c as unknown as Readonly<Context>)
    ) as unknown as T
  return chainAiConversationRoutes(withChat)
}
