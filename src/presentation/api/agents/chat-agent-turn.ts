/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A chat turn on the agent runtime ([internal ref] D2).
 *
 * `/api/ai/chat` and its stream, agent-bound or not, run their turn on
 * `runAgentTurn`. This module builds the turn — the messages, the tools, the
 * model settings, who it runs as — and finishes the buffered one into the
 * `{ reply, actions, sessionId }` envelope. The stream forwards the same turn's
 * events (`chat-stream.ts`).
 *
 * What a chat turn adds to the runtime:
 *
 *  - its own tools — `query_<table>` / `count_<table>` over the tables the
 *    caller may read (narrowed to an agent's allowlist), and `browser_use` for
 *    an agent granted it — run by {@link runChatTableTool};
 *  - for a declared agent, its allowlisted actions as tools, which the runtime
 *    resolves through the agent's gates like on every other surface;
 *  - the operator-tunable `AI_CHAT_TIMEOUT` deadline and `AI_CHAT_MAX_RETRIES`
 *    retry policy on every model call, and `AI_CHAT_MAX_TOOL_ITERATIONS`
 *    tool rounds.
 */

import { Data, Effect } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import { dispatchAgentAction } from '@/application/use-cases/agents/agent-action-dispatch'
import { runAgentTurnToEnd, type AgentTurnSpec } from '@/application/use-cases/agents/agent-runtime'
import { buildAgentActionTools } from '@/domain/models/app/agents/agent-turn-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  provideDomain,
  requireDomainContext,
  runRequestEffect,
} from '@/infrastructure/logging/request-effect'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { agentAttribution, type AgentTurnBinding } from './agent-chat'
import { recordChatActivity } from './chat-activity-log'
import { buildTurnTools } from './chat-browser-tool'
import { appendConversationTurn } from './chat-conversation-store'
import {
  applyRetentionPolicy,
  loadDurableHistory,
  persistChatTurnDurably,
} from './chat-durable-memory'
import {
  chatErrorCode,
  chatErrorMessage,
  chatErrorStatus,
  isTransientChatError,
  resolveChatErrorConfig,
  type ChatTurnError,
} from './chat-error-handling'
import { turnCitations, withTurnKnowledge } from './chat-knowledge-citations'
import { chatTableRoles } from './chat-read-scope'
import {
  resolveMaxToolIterations,
  runChatTableTool,
  toToolCallTables,
  type ChatToolScope,
} from './chat-tool-calling'
import { respondWithActions, toolTurnActions, toolTurnReply } from './chat-tool-reply'
import { finishChatTurn, type ChatTurnInput } from './chat-turn-completion'
import { loadCarriedFiles, questionContent } from './chat-turn-parts'
import type { AgentCaller } from '@/application/ports/services/agent-approval-store'
import type {
  ChatInput,
  ChatMessage,
  ChatReply,
  ChatToolCall,
  MessagePart,
} from '@/application/ports/services/ai-service'
import type { OtherToolResult } from '@/application/use-cases/agents/agent-tool-call'
import type { StepRequirements } from '@/application/use-cases/automations/run/types'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context } from 'hono'

/**
 * The tables a turn's tools may reach: the RBAC-readable set for the acting
 * role, narrowed for an agent-bound turn to the agent's declared allowlist.
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
 * The per-agent provider overrides an agent-bound turn layers onto every model
 * call — empty for a generic turn.
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
 * The declared agent a turn runs as, whose gates its actions pass — none for a
 * generic turn or the built-in System Agent, which takes no actions.
 */
const declaredAgent = (input: ChatTurnInput): Agent | undefined =>
  input.agent === undefined || input.agent.builtIn === true
    ? undefined
    : input.app?.agents?.find((candidate) => candidate.name === input.agent?.name)

/**
 * The person a declared agent answers on this turn — her grants cap each call,
 * and its record actions run as her. None in an app without sign-in, where
 * there is nobody to judge.
 */
const turnCaller = (input: ChatTurnInput): AgentCaller | undefined => {
  const person = input.reader.answering
  if (person === undefined) return undefined
  return {
    userId: person.userId,
    grantOn: (table) => ({
      role: person.role,
      effectiveRoles:
        table === undefined ? [person.role] : chatTableRoles(input.app, table, person),
      signedOut: person.userId === undefined,
    }),
  }
}

/**
 * The prior exchanges a turn replays to the provider, or none.
 *
 * An agent-bound turn deliberately does NOT replay history — it never has, on
 * either agent transport. It is observable, too: fact extraction re-derives a
 * fact per turn, so a replayed history makes an agent re-learn its FIRST fact
 * every turn.
 */
export const replayedHistory = async (input: ChatTurnInput): Promise<ReadonlyArray<ChatMessage>> =>
  replaysHistory(input) ? loadDurableHistory(input.services, input.actorName, input.sessionId) : []

/** Whether a turn replays its conversation's earlier messages ({@link replayedHistory}). */
const replaysHistory = (input: ChatTurnInput): boolean =>
  input.agent === undefined || input.agent.builtIn === true

/**
 * The files sent earlier in the conversation, for a turn that replays none of
 * its messages: a file stays readable for the rest of its conversation.
 */
export const carriedFiles = async (input: ChatTurnInput): Promise<ReadonlyArray<MessagePart>> =>
  replaysHistory(input) ? [] : loadCarriedFiles(input.services, input.actorName, input.sessionId)

/**
 * One model call under the operator's retry policy: only TRANSIENT failures
 * (503/429) are retried, up to `AI_CHAT_MAX_RETRIES`, each retry one more
 * recorded provider request — so the adapter is told not to retry on its own.
 */
const callWithRetries =
  (maxRetries: number | undefined) =>
  (input: ChatInput): Effect.Effect<ChatReply, ChatTurnError, AiService> =>
    maxRetries === undefined
      ? Effect.flatMap(Effect.service(AiService), (ai) => ai.chat(input))
      : Effect.flatMap(Effect.service(AiService), (ai) => ai.chat({ ...input, retry: false })).pipe(
          Effect.retry({ while: isTransientChatError, times: maxRetries })
        )

/** A chat tool that threw past its own error results. */
class ChatToolFailure extends Data.TaggedError('ChatToolFailure')<{
  readonly tool: string
  readonly cause: unknown
}> {}

/**
 * A chat turn's own tools — its table lookups, its browser tool. A lookup
 * answers every refusal and query failure with an error result the model
 * reads; one that throws past that is logged, and handed to the model as a
 * failed lookup rather than ending the turn.
 */
const runTableTool =
  (scope: ChatToolScope) =>
  (call: ChatToolCall): Effect.Effect<OtherToolResult> =>
    Effect.tryPromise({
      try: () => runChatTableTool(call, scope),
      catch: (cause) => new ChatToolFailure({ tool: call.name, cause }),
    }).pipe(
      Effect.tapError((cause) =>
        Effect.sync(() => {
          logError('[ai-chat] a chat tool failed', cause, { tool: call.name })
        })
      ),
      // effect-swallow: the model reads the failure as the tool's result and the turn goes on; the cause is logged above.
      Effect.orElseSucceed(() => ({
        content: `Error: the "${call.name}" tool failed.`,
        denied: false,
      }))
    )

/** How a chat turn runs: what it replays, and whether it streams. */
interface ChatTurnSpecOptions {
  readonly history: ReadonlyArray<ChatMessage>
  readonly stream: boolean
  /** Files sent earlier in a conversation whose messages are not replayed. */
  readonly carried?: ReadonlyArray<MessagePart>
}

/** The turn a chat request runs, buffered or streamed. */
export const chatTurnSpec = (
  input: ChatTurnInput,
  options: ChatTurnSpecOptions
): AgentTurnSpec<StepRequirements> => {
  const errorConfig = resolveChatErrorConfig()
  const tables = resolveTurnToolTables(input)
  const toolDefs = tables.map((table) => ({ name: table.name, columns: table.readableColumns }))
  const agent = declaredAgent(input)
  const caller = turnCaller(input)
  const { app } = input
  return {
    surface: 'chat',
    agent,
    app,
    requestedById: input.actorName === 'anonymous' ? undefined : input.actorName,
    chatActor: input.actorName,
    caller,
    tools: {
      runAction: (action, props) =>
        app === undefined || agent === undefined
          ? Effect.succeed({ ok: false, error: `the action "${action}" is not available` })
          : dispatchAgentAction({ app, agentName: agent.name, action, props, caller }),
      runOther: runTableTool({
        services: input.services,
        tables,
        app,
        reader: input.reader,
        ...(agentAttribution(input.agent) !== undefined && {
          agentName: agentAttribution(input.agent),
        }),
      }),
    },
    messages: [
      { role: 'system', content: input.systemPrompt },
      ...options.history,
      { role: 'user', content: questionContent(input.message, input.parts, options.carried ?? []) },
    ],
    toolDefinitions: [
      ...buildTurnTools(toolDefs, input.app, input.agent),
      ...(agent === undefined ? [] : buildAgentActionTools(agent)),
    ],
    // `AI_CHAT_MAX_TOOL_ITERATIONS` counts tool ROUNDS; the runtime counts
    // model calls, one more than the rounds they bracket.
    maxSteps: resolveMaxToolIterations() + 1,
    model: {
      ...agentProviderOverrides(input.agent),
      ...(errorConfig.timeoutMs !== undefined && { timeoutMs: errorConfig.timeoutMs }),
    },
    stream: options.stream,
    callModel: callWithRetries(errorConfig.maxRetries),
  }
}

/**
 * Render a chat-turn provider failure, and record it. `code` follows the
 * status: 502 is BAD_GATEWAY, 504 GATEWAY_TIMEOUT, and only the 503 keeps
 * SERVICE_UNAVAILABLE.
 */
export const chatProviderFailure = async (
  c: Context,
  failure: ChatTurnError,
  actorName: string
): Promise<Response> => {
  const status = chatErrorStatus(failure)
  await recordChatActivity(requireDomainContext(c), { action: 'ai.chat.error', actorName })
  return c.json(errorBody({ error: chatErrorMessage(status), code: chatErrorCode(status) }), status)
}

/**
 * Persist an exchange (attributed to the agent, whichever transport carried
 * it), record it, and answer with the standard envelope.
 */
const finishWithReply = async (
  c: Context,
  input: ChatTurnInput,
  answer: {
    readonly reply: string
    readonly actions: ReturnType<typeof toolTurnActions>
    readonly citations?: ReturnType<typeof turnCitations>
  }
): Promise<Response> => {
  appendConversationTurn(input.sessionId, input.message, answer.reply)
  await persistChatTurnDurably(input.services, {
    userId: input.actorName,
    sessionId: input.sessionId,
    userMessage: input.message,
    assistantReply: answer.reply,
    userParts: input.parts?.stored,
    ...(agentAttribution(input.agent) !== undefined && {
      agentName: agentAttribution(input.agent),
    }),
  })
  await recordChatActivity(input.services, {
    action: 'ai.chat.message',
    actorName: input.actorName,
  })
  return respondWithActions(c, {
    reply: answer.reply,
    actions: answer.actions,
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
    citations: answer.citations,
  })
}

/**
 * Run one buffered chat turn and answer it.
 *
 * A turn that called tools answers with the model's final reply and one action
 * per tool call. A turn that called none completes as it always has: an
 * agent's prose is its answer, and a generic turn's prose goes through the
 * record-query / mutation / automation-trigger completion — never an agent's,
 * whose own phrasing must not be replaced by a table dump.
 */
export const runChatTurn = async (c: Context, asked: ChatTurnInput): Promise<Response> => {
  // Lazy retention sweep — delete this user's conversations older than
  // `AI_MEMORY_MAX_AGE_DAYS` before the new turn lands.
  await applyRetentionPolicy(asked.services, asked.actorName)
  const history = await replayedHistory(asked)
  const carried = await carriedFiles(asked)
  // The agent's knowledge passages, numbered into its prompt; its answer cites them.
  const { input, passages } = await withTurnKnowledge(asked)
  const program = runAgentTurnToEnd(chatTurnSpec(input, { history, stream: false, carried }))
  // Under the request-edge root span, so each model call's `ai.request` span
  // chains under it.
  const result = await runRequestEffect(c, provideDomain(c, program).pipe(Effect.result))
  if (result._tag === 'Failure') {
    return chatProviderFailure(c, result.failure, input.actorName)
  }
  const { toolResults, reply } = result.success
  if (toolResults.length > 0) {
    const answer = toolTurnReply(reply, toolResults)
    return finishWithReply(c, asked, {
      reply: answer,
      actions: toolTurnActions(toolResults),
      citations: turnCitations(answer, passages),
    })
  }
  if (input.agent !== undefined) {
    return finishWithReply(c, asked, {
      reply,
      actions: [],
      citations: turnCitations(reply, passages),
    })
  }
  return finishChatTurn(c, input, reply)
}
