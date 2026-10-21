/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Editing a question and regenerating an answer:
 *
 *  - `POST /api/ai/conversations/:sessionId/messages/:messageId/edit` with
 *    `{ content }` — the edited question is written in place of the old one,
 *    as its SIBLING, and answered;
 *  - `POST /api/ai/conversations/:sessionId/messages/:messageId/regenerate` —
 *    another answer to the same question, as a sibling of the old answer.
 *
 * Neither overwrites anything: the conversation is a tree, the new message is
 * the newest of its siblings, and the current branch follows it
 * (`conversation-branch-service.ts`). The model is sent the branch the new
 * message continues, so it never reads the exchange being replaced.
 *
 * The answer runs on the chat's own turn — `chatTurnSpec` on the agent runtime,
 * with the agent's prompt, tools, gates and knowledge — never a second loop.
 * A question sent with files is answered with them again: an edit replaces its
 * text and keeps its files, and both read them through the same replay as any
 * later turn of the conversation (`chat-turn-parts.ts`).
 *
 * Only the conversation's owner reaches it: anyone else, and a message that is
 * not in the conversation or not of the right role, is answered 404 (S1).
 */

import { Effect } from 'effect'
import { runAgentTurnToEnd } from '@/application/use-cases/agents/agent-runtime'
import { findOwnedChatAttachments } from '@/application/use-cases/ai/chat-attachments'
import {
  loadConversationTree,
  recordConversationBranch,
} from '@/application/use-cases/ai/conversation-memory'
import { conversationEditRequestSchema } from '@/domain/models/api/ai/conversations'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { currentBranch, pathTo } from '@/domain/models/app/agents/conversation-branch-service'
import { storedToolCalls } from '@/domain/models/app/agents/stored-tool-call-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  requireDomainContext,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { checkChatRateLimit } from '@/infrastructure/process/chat-rate-limit'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { validateRequest } from '@/presentation/api/runtime/validate-request'
import { recordChatActivity } from './chat-activity-log'
import { chatProviderFailure, chatTurnSpec } from './chat-agent-turn'
import { resolveChatErrorConfig } from './chat-error-handling'
import { turnCitations, withTurnKnowledge } from './chat-knowledge-citations'
import { keepListedExchanges } from './chat-replay-scope'
import { toolTurnActions, toolTurnReply } from './chat-tool-reply'
import { carriedFilesOf, readmitStoredParts, replayStoredHistory } from './chat-turn-parts'
import { resolveConversationTurnInput } from './conversation-turn-input'
import { toWireMessages } from './conversation-wire'
import type { ChatTurnInput } from './chat-turn-completion'
import type {
  AiMemoryMessage,
  AiMemoryThread,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import type { ConversationTurnResponse } from '@/domain/models/api/ai/conversations'
import type { App } from '@/domain/models/app'
import type { Hono, Context, TypedResponse } from 'hono'

/** What a branch turn asks the agent, and where its answer is written. */
interface BranchTurnPlan {
  /** The question the agent answers. */
  readonly question: string
  /** The message the new branch is written below (`null`: a new first message). */
  readonly parentId: string | null
  /** The last message of the history the model is sent (`null`: none). */
  readonly historyEnd: string | null
  /** The messages the new branch writes before the answer: the edited question, or none. */
  readonly leading: ReadonlyArray<{
    readonly role: 'user'
    readonly content: string
    readonly parts?: ReadonlyArray<AiMessagePart> | undefined
  }>
  /** The question's parts, when it was sent with files: what the model reads again. */
  readonly parts?: ReadonlyArray<AiMessagePart> | undefined
}

/** An edited question's parts: the new text, then the files the old one was sent with. */
const editedParts = (
  parts: ReadonlyArray<AiMessagePart> | undefined,
  content: string
): ReadonlyArray<AiMessagePart> | undefined =>
  parts === undefined
    ? undefined
    : [{ type: 'text', text: content }, ...parts.filter((part) => part.type !== 'text')]

/** The caller, her conversation, and the message the request names. */
interface OpenedBranchTurn {
  readonly userId: string
  readonly sessionId: string
  readonly messageId: string
  readonly thread: AiMemoryThread
}

/** The edit plan for `messageId`, or `undefined` when it is not a question. */
const editPlan = (
  messages: ReadonlyArray<AiMemoryMessage>,
  messageId: string,
  content: string
): BranchTurnPlan | undefined => {
  const edited = messages.find((message) => message.id === messageId && message.role === 'user')
  if (edited === undefined) return undefined
  const parts = editedParts(edited.parts, content)
  return {
    question: content,
    parentId: edited.parentId,
    historyEnd: edited.parentId,
    leading: [{ role: 'user', content, parts }],
    parts,
  }
}

/** The regeneration plan for `messageId`, or `undefined` when it is not an answer. */
const regeneratePlan = (
  messages: ReadonlyArray<AiMemoryMessage>,
  messageId: string
): BranchTurnPlan | undefined => {
  const answer = messages.find(
    (message) => message.id === messageId && message.role === 'assistant'
  )
  const question = messages.find(
    (message) => message.id === answer?.parentId && message.role === 'user'
  )
  return answer === undefined || question === undefined
    ? undefined
    : {
        question: question.content,
        parentId: question.id,
        historyEnd: question.parentId,
        leading: [],
        parts: question.parts,
      }
}

/**
 * The prior exchanges the model is sent: the branch down to the message the new
 * one follows — never the exchange it replaces. An agent-bound turn replays
 * none, as on every chat transport (`replayedHistory`).
 */
const replayFor = (
  messages: ReadonlyArray<AiMemoryMessage>,
  historyEnd: string | null
): ReadonlyArray<{
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly parts?: ReadonlyArray<AiMessagePart> | undefined
  readonly toolCalls?: AiMemoryMessage['toolCalls']
}> =>
  pathTo(messages, historyEnd).flatMap((message) =>
    message.role === 'user' || message.role === 'assistant'
      ? [
          {
            role: message.role,
            content: message.content,
            parts: message.parts,
            toolCalls: message.toolCalls,
          },
        ]
      : []
  )

/**
 * The branch the new message continues, with the files sent in it: replayed
 * whole — less every exchange answered from a table the caller no longer
 * lists — or, for a turn that replays no history, its files alone.
 */
const branchHistory = async (
  asked: ChatTurnInput,
  branch: {
    readonly userId: string
    readonly messages: ReadonlyArray<AiMemoryMessage>
    readonly plan: BranchTurnPlan
  }
): Promise<{
  readonly history: Awaited<ReturnType<typeof replayStoredHistory>>
  readonly carried: Awaited<ReturnType<typeof carriedFilesOf>>
}> => {
  const { services, app, reader } = asked
  const earlier = replayFor(branch.messages, branch.plan.historyEnd)
  if (asked.agent !== undefined && asked.agent.builtIn !== true) {
    return { history: [], carried: await carriedFilesOf(services, branch.userId, earlier) }
  }
  const replayed = await keepListedExchanges({ services, app, reader }, earlier)
  return { history: await replayStoredHistory(services, branch.userId, replayed), carried: [] }
}

/** The answer a branch ends on, with one line per call its turn ran. */
const answerOf = (turn: {
  readonly answer: string
  readonly toolCalls: ReturnType<typeof storedToolCalls>
}) => ({ role: 'assistant' as const, content: turn.answer, toolCalls: turn.toolCalls })

/** Write the new branch, record the turn, and answer with the branch now current. */
const respondWithBranch = async (
  c: Context,
  opened: OpenedBranchTurn,
  turn: {
    readonly plan: BranchTurnPlan
    readonly answer: string
    readonly actions: ConversationTurnResponse['actions']
    readonly citations: ConversationTurnResponse['citations']
    readonly toolCalls: ReturnType<typeof storedToolCalls>
  }
): Promise<Response> => {
  const { userId, sessionId } = opened
  const services = requireDomainContext(c)
  const written = await runRequestEffect(
    c,
    Effect.gen(function* () {
      yield* recordConversationBranch({
        userId,
        sessionId,
        parentId: turn.plan.parentId,
        messages: [...turn.plan.leading, answerOf(turn)],
      })
      const tree = yield* loadConversationTree({ userId, sessionId })
      // The caller's own uploads the messages name, to give each its name and type.
      const ids = (tree?.messages ?? []).flatMap((message) =>
        (message.parts ?? []).flatMap((part) => (part.type === 'text' ? [] : [part.attachmentId]))
      )
      const uploads = yield* findOwnedChatAttachments({ userId, ids })
      return tree === undefined ? undefined : { tree: tree.messages, uploads }
    }).pipe(Effect.provide(services), Effect.result)
  )
  if (written._tag === 'Failure' || written.success === undefined) {
    logError('[ai] writing a conversation branch failed', written)
    return c.json(
      errorBody({ error: 'Failed to save the conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  await recordChatActivity(services, { action: 'ai.chat.message', actorName: userId })
  const { tree, uploads } = written.success
  const messages = await runRequestEffect(c, toWireMessages(tree, currentBranch(tree), uploads))
  const body: ConversationTurnResponse = {
    sessionId,
    reply: turn.answer,
    actions: [...turn.actions],
    ...(turn.citations !== undefined && { citations: turn.citations }),
    messages: [...messages],
  }
  return c.json(body, 200)
}

/**
 * Answer `plan` on the chat's turn — its agent, prompt, tools, gates and
 * knowledge, on the agent runtime — then write it as the new branch.
 */
const answerBranch = async (
  c: Context,
  app: App,
  opened: OpenedBranchTurn,
  plan: BranchTurnPlan
): Promise<Response> => {
  const { userId, sessionId, thread } = opened
  const asked = await resolveConversationTurnInput(c, app, {
    userId,
    sessionId,
    question: plan.question,
    agentName: thread.agentName,
  })
  if (asked === undefined) return notFound(c, 'Conversation not found.')
  const services = requireDomainContext(c)
  const parts =
    plan.parts === undefined ? undefined : await readmitStoredParts(services, userId, plan.parts)
  const { input, passages } = await withTurnKnowledge({
    ...asked,
    ...(parts !== undefined && { parts }),
  })
  const earlier = await branchHistory(asked, { userId, messages: thread.messages, plan })
  const spec = await chatTurnSpec(input, { ...earlier, stream: false })
  const result = await runRequestEffect(
    c,
    provideDomain(c, runAgentTurnToEnd(spec)).pipe(Effect.result)
  )
  if (result._tag === 'Failure') return chatProviderFailure(c, result.failure, userId)
  const { reply, toolResults } = result.success
  const answer = toolResults.length > 0 ? toolTurnReply(reply, toolResults) : reply
  return respondWithBranch(c, opened, {
    plan,
    answer,
    actions: toolResults.length > 0 ? toolTurnActions(toolResults) : [],
    citations: turnCitations(answer, passages),
    toolCalls: storedToolCalls(toolResults),
  })
}

/**
 * The gates every branch turn passes, in order: a signed-in caller, AI
 * configured, the caller's own conversation, and the chat rate limit. Every
 * refusal but the rate limit reads as a conversation that does not exist.
 */
const openBranchTurn = async (
  c: Context
): Promise<OpenedBranchTurn | { readonly refusal: Response }> => {
  const userId = getSessionContext(c)?.userId
  const sessionId = c.req.param('sessionId') ?? ''
  const messageId = c.req.param('messageId') ?? ''
  if (userId === undefined || process.env.AI_PROVIDER === undefined) {
    return { refusal: notFound(c, 'Conversation not found.') }
  }
  const loaded = await runRequestEffect(
    c,
    loadConversationTree({ userId, sessionId }).pipe(
      Effect.provide(requireDomainContext(c)),
      Effect.result
    )
  )
  if (loaded._tag === 'Failure') {
    logError('[ai] loading a conversation to branch failed', loaded.failure)
    return {
      refusal: c.json(
        errorBody({ error: 'Failed to load conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
        500
      ),
    }
  }
  if (loaded.success === undefined) return { refusal: notFound(c, 'Conversation not found.') }
  const limit = checkChatRateLimit(userId)
  if (limit.limited) return { refusal: rateLimitedResponse(c, limit.retryAfter) }
  return { userId, sessionId, messageId, thread: loaded.success }
}

/** `POST /api/ai/conversations/:sessionId/messages/:messageId/edit`. */
const handleEdit = async (c: Context, app: App): Promise<Response | TypedResponse<unknown>> => {
  const body = await validateRequest(c, conversationEditRequestSchema)
  if (!body.success) return body.response
  // The operator's `AI_CHAT_MAX_MESSAGE_LENGTH`, as on `POST /api/ai/chat`: an
  // edited question is a question asked.
  const { maxMessageLength } = resolveChatErrorConfig()
  if (maxMessageLength !== undefined && body.data.content.length > maxMessageLength) {
    const error = `Message exceeds the maximum length of ${String(maxMessageLength)} characters.`
    return c.json(errorBody({ error, code: ApiErrorCode.BAD_REQUEST }), 400)
  }
  const opened = await openBranchTurn(c)
  if ('refusal' in opened) return opened.refusal
  const plan = editPlan(opened.thread.messages, opened.messageId, body.data.content)
  return plan === undefined ? notFound(c, 'Message not found.') : answerBranch(c, app, opened, plan)
}

/** `POST /api/ai/conversations/:sessionId/messages/:messageId/regenerate`. */
const handleRegenerate = async (c: Context, app: App): Promise<Response> => {
  const opened = await openBranchTurn(c)
  if ('refusal' in opened) return opened.refusal
  const plan = regeneratePlan(opened.thread.messages, opened.messageId)
  return plan === undefined ? notFound(c, 'Message not found.') : answerBranch(c, app, opened, plan)
}

/**
 * Chain the edit and regenerate routes. Without an app there is no agent and
 * no table to answer from, so both answer 404. Auth is the `/api/ai/conversations/*`
 * chain in `api-auth-guards.ts`.
 */
export function chainAiConversationBranchRoutes(honoApp: Hono, app?: App): Hono {
  return honoApp
    .post('/api/ai/conversations/:sessionId/messages/:messageId/edit', async (c) =>
      app === undefined ? notFound(c, 'Conversation not found.') : handleEdit(c, app)
    )
    .post('/api/ai/conversations/:sessionId/messages/:messageId/regenerate', async (c) =>
      app === undefined ? notFound(c, 'Conversation not found.') : handleRegenerate(c, app)
    )
}
