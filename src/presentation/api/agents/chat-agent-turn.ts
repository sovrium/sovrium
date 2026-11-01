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
 * model settings, who it runs as — which the turn's program
 * (`application/use-cases/agents/chat-turn/run-chat-turn.ts`) runs, buffered
 * or streamed (`chat-turn-run.ts`).
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

import { Effect } from 'effect'
import { DynamicRecordRepository } from '@/application/ports/repositories/tables/dynamic-record-repository'
import { AiService } from '@/application/ports/services/ai-service'
import { dispatchAgentAction } from '@/application/use-cases/agents/agent-action-dispatch'
import { type AgentTurnSpec } from '@/application/use-cases/agents/agent-runtime'
import { logError } from '@/infrastructure/logging/logger'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import { agentActionToolsFor, agentAttribution, type AgentTurnBinding } from './agent-chat'
import { recordChatActivity } from './chat-activity-log'
import { buildTurnTools } from './chat-browser-tool'
import {
  chatErrorCode,
  chatErrorMessage,
  chatErrorStatus,
  isTransientChatError,
  resolveChatErrorConfig,
  type ChatProviderError,
} from './chat-error-handling'
import { chatTableRoles } from './chat-read-scope'
import {
  resolveMaxToolIterations,
  runChatTableTool,
  toToolCallTables,
  type ChatToolScope,
  type ToolCallTable,
} from './chat-tool-calling'
import { type ChatTurnInput } from './chat-turn-completion'
import { questionContent } from './chat-turn-parts'
import type { AgentCaller } from '@/application/ports/services/agent-approval-store'
import type {
  AiError,
  ChatInput,
  ChatMessage,
  ChatReply,
  ChatToolCall,
  ChatToolDefinition,
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
const resolveTurnToolTables = (input: ChatTurnInput) =>
  Effect.map(toToolCallTables(input.app, input.reader), (tables) =>
    tables.filter(
      (table) =>
        input.agent?.toolTables === undefined || input.agent.toolTables.includes(table.name)
    )
  )

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
 * One model call under the operator's retry policy: only TRANSIENT failures
 * (503/429) are retried, up to `AI_CHAT_MAX_RETRIES`, each retry one more
 * recorded provider request — so the adapter is told not to retry on its own.
 */
const callWithRetries =
  (maxRetries: number | undefined) =>
  (input: ChatInput): Effect.Effect<ChatReply, AiError, AiService> =>
    maxRetries === undefined
      ? Effect.flatMap(Effect.service(AiService), (ai) => ai.chat(input))
      : Effect.flatMap(Effect.service(AiService), (ai) => ai.chat({ ...input, retry: false })).pipe(
          Effect.retry({ while: isTransientChatError, times: maxRetries })
        )

/**
 * A chat turn's own tools — its table lookups, its browser tool. A lookup
 * answers every refusal and query failure with an error result the model
 * reads; one that throws past that is logged, and handed to the model as a
 * failed lookup rather than ending the turn.
 */
const runTableTool =
  (scope: ChatToolScope, dynamicRecords: DynamicRecordRepository['Service']) =>
  (call: ChatToolCall): Effect.Effect<OtherToolResult, never, StepRequirements> =>
    runChatTableTool(call, scope).pipe(
      Effect.provideService(DynamicRecordRepository, dynamicRecords),
      // effect-swallow: the model reads the failure as the tool's result and the turn goes on; the defect is logged here.
      Effect.catchDefect((defect) =>
        Effect.sync(() => {
          logError('[ai-chat] a chat tool failed', defect, { tool: call.name })
          return { content: `Error: the "${call.name}" tool failed.`, denied: false }
        })
      )
    )

/** How a chat turn runs: what it replays, and whether it streams. */
interface ChatTurnSpecOptions {
  readonly history: ReadonlyArray<ChatMessage>
  readonly stream: boolean
  /** Files sent earlier in a conversation whose messages are not replayed. */
  readonly carried?: ReadonlyArray<MessagePart>
}

/**
 * The tools a chat turn offers its model: its table lookups and browser tool,
 * then a declared agent's actions, each naming only the tables it reaches.
 */
const turnToolDefinitions = (
  input: ChatTurnInput,
  tables: ReadonlyArray<ToolCallTable>,
  agent: Agent | undefined
): ReadonlyArray<ChatToolDefinition> => {
  const toolDefs = tables.map((table) => ({ name: table.name, columns: table.readableColumns }))
  const listed = new Set(tables.map((table) => table.name))
  return [
    ...buildTurnTools(toolDefs, input.app, input.agent),
    ...(agent === undefined
      ? []
      : agentActionToolsFor(agent, input.app, turnCaller(input), listed)),
  ]
}

/**
 * A turn's tools: a declared agent's actions, through its gates, and the
 * chat's own table lookups and browser, on the services the turn runs on.
 */
const turnTools = (
  input: ChatTurnInput,
  turn: {
    readonly tables: ReadonlyArray<ToolCallTable>
    readonly agent: Agent | undefined
    readonly caller: AgentCaller | undefined
    readonly dynamicRecords: DynamicRecordRepository['Service']
  }
): AgentTurnSpec<StepRequirements>['tools'] => {
  const { app } = input
  const { agent, caller } = turn
  const agentName = agentAttribution(input.agent)
  return {
    runAction: (action, props) =>
      app === undefined || agent === undefined
        ? Effect.succeed({ ok: false, error: `the action "${action}" is not available` })
        : dispatchAgentAction({ app, agentName: agent.name, action, props, caller }),
    runOther: runTableTool(
      {
        tables: turn.tables,
        app,
        reader: input.reader,
        ...(agentName !== undefined && { agentName }),
      },
      turn.dynamicRecords
    ),
  }
}

/**
 * The turn a chat request runs, buffered or streamed. Its own tools read on
 * the services the turn runs on, which the agent runtime hands them with.
 */
export const chatTurnSpec = (input: ChatTurnInput, options: ChatTurnSpecOptions) =>
  Effect.gen(function* () {
    const errorConfig = resolveChatErrorConfig()
    const tables = yield* resolveTurnToolTables(input)
    // The one service its lookups read that a step's requirements do not hold.
    const dynamicRecords = yield* DynamicRecordRepository
    const agent = declaredAgent(input)
    const caller = turnCaller(input)
    const { app } = input
    const spec: AgentTurnSpec<StepRequirements> = {
      surface: 'chat',
      agent,
      app,
      requestedById: input.actorName === 'anonymous' ? undefined : input.actorName,
      chatActor: input.actorName,
      caller,
      tools: turnTools(input, { tables, agent, caller, dynamicRecords }),
      messages: [
        { role: 'system', content: input.systemPrompt },
        ...options.history,
        {
          role: 'user',
          content: questionContent(input.message, input.parts, options.carried ?? []),
        },
      ],
      toolDefinitions: turnToolDefinitions(input, tables, agent),
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
    return spec
  })

/**
 * Render a chat-turn provider failure, and record it. `code` follows the
 * status: 502 is BAD_GATEWAY, 504 GATEWAY_TIMEOUT, and only the 503 keeps
 * SERVICE_UNAVAILABLE.
 */
export const chatProviderFailure = (c: Context, failure: ChatProviderError, actorName: string) => {
  const status = chatErrorStatus(failure)
  return Effect.as(
    recordChatActivity({ action: 'ai.chat.error', actorName }),
    c.json(errorBody({ error: chatErrorMessage(status), code: chatErrorCode(status) }), status)
  )
}
