/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import { AiEmbeddingRepositoryLive } from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
import { aiErrorOutcome } from './ai'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type {
  ChatInput,
  ChatMessage,
  ChatReply,
  ChatToolCall,
  ChatToolDefinition,
} from '@/application/ports/services/ai-service'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

const DEFAULT_MAX_STEPS = 10

const DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT = 5

const DEFAULT_KNOWLEDGE_SIMILARITY_THRESHOLD = 0.7

const retrieveKnowledgeChunks = (input: {
  readonly task: string
  readonly agent: Agent
}): Effect.Effect<
  ReadonlyArray<{ readonly content: string; readonly sourceRef: string | null }>,
  never,
  AiService
> =>
  Effect.gen(function* () {
    const memory = input.agent.memory?.knowledge
    if (memory === undefined || memory.enabled !== true) return []
    const limit = memory.retrievalLimit ?? DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT
    const threshold = memory.similarityThreshold ?? DEFAULT_KNOWLEDGE_SIMILARITY_THRESHOLD
    const sources = memory.sources ?? []

    const ai = yield* AiService
    const embedResult = yield* Effect.either(ai.embed({ text: input.task }))
    if (embedResult._tag === 'Left') return []

    const searchProgram = Effect.gen(function* () {
      const repo = yield* AiEmbeddingRepository
      return yield* repo.search({
        embedding: embedResult.right.embedding,
        agentName: undefined,
        minSimilarity: threshold,
        maxResults: limit,
      })
    }).pipe(
      Effect.provide(AiEmbeddingRepositoryLive),
      Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<never>))
    )
    const results = yield* searchProgram

    const filtered =
      sources.length === 0
        ? results
        : results.filter((row) => {
            const ref = row.sourceRef ?? ''
            return sources.some((source) => ref.startsWith(`document:${source}/`))
          })
    return filtered.map((row) => ({ content: row.content, sourceRef: row.sourceRef }))
  })

const buildAgentSystemPrompt = (agent: Agent): string => {
  const { tools } = agent
  const capabilityLines =
    tools !== undefined
      ? [
          '',
          'Your capabilities are restricted to the following allowlist:',
          `- Tables you may access: ${tools.tables.join(', ')}`,
          `- Actions you may perform: ${tools.actions.join(', ')}`,
        ]
      : []
  return [agent.systemPrompt, ...capabilityLines].join('\n')
}

const buildAgentTools = (agent: Agent): ReadonlyArray<ChatToolDefinition> => {
  const { tools } = agent
  if (tools === undefined) return []
  const tableList = tools.tables.join(', ')
  return tools.actions.map((action) => ({
    type: 'function' as const,
    function: {
      name: action,
      description: `Perform the "${action}" operation against the agent's allowlisted tables (${tableList}).`,
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            description: `One of the allowlisted tables: ${tableList}.`,
          },
        },
      },
    },
  }))
}

const buildToolResult = (
  toolCall: ChatToolCall,
  allowedActions: ReadonlySet<string>
): ChatMessage => ({
  role: 'tool',
  toolCallId: toolCall.id,
  content: allowedActions.has(toolCall.name)
    ? `Tool "${toolCall.name}" acknowledged.`
    : `Tool "${toolCall.name}" is not in the agent's allowlist and was rejected.`,
})

const resolveModel = (agent: Agent): string =>
  agent.model ?? process.env['AI_MODEL'] ?? 'mock-model'

interface AgentLoopInput {
  readonly agent: Agent
  readonly model: string
  readonly tools: ReadonlyArray<ChatToolDefinition>
  readonly allowedActions: ReadonlySet<string>
  readonly allowedTables: ReadonlySet<string>
  readonly maxSteps: number
}

const validateToolCall = (
  toolCall: ChatToolCall,
  input: AgentLoopInput
): ActionOutcome | undefined => {
  if (!input.allowedActions.has(toolCall.name)) {
    return aiErrorOutcome({
      code: 'invalid_tool',
      message: `ai.agent: the agent attempted tool "${toolCall.name}" which is not in its allowlist`,
      retryable: false,
    })
  }
  const requestedTable = toolCall.arguments['table']
  if (typeof requestedTable === 'string' && !input.allowedTables.has(requestedTable)) {
    return aiErrorOutcome({
      code: 'table_not_found',
      message: `ai.agent: tool "${toolCall.name}" referenced table "${requestedTable}" which is not in the agent's allowlisted tables`,
      retryable: false,
    })
  }
  return undefined
}

interface AgentLoopState {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly stepsExecuted: number
  readonly toolsUsed: ReadonlyArray<string>
  readonly lastReply: ChatReply | undefined
}

const buildStepChatInput = (state: AgentLoopState, input: AgentLoopInput): ChatInput => ({
  messages: state.messages,
  model: input.model,
  ...(input.agent.temperature !== undefined ? { temperature: input.agent.temperature } : {}),
  ...(input.agent.maxTokens !== undefined ? { maxTokens: input.agent.maxTokens } : {}),
  ...(input.tools.length > 0 ? { tools: input.tools } : {}),
})

const advanceState = (
  state: AgentLoopState,
  reply: ChatReply,
  allowedActions: ReadonlySet<string>
): AgentLoopState => {
  const toolCalls = reply.toolCalls ?? []
  const base = { stepsExecuted: state.stepsExecuted + 1, lastReply: reply }
  if (toolCalls.length === 0) {
    return { ...state, ...base }
  }
  const honoured = toolCalls.map((call) => call.name).filter((name) => allowedActions.has(name))
  return {
    messages: [
      ...state.messages,
      { role: 'assistant', content: reply.content, toolCalls },
      ...toolCalls.map((call) => buildToolResult(call, allowedActions)),
    ],
    toolsUsed: [...state.toolsUsed, ...honoured],
    ...base,
  }
}

const runAgentLoop = (
  state: AgentLoopState,
  input: AgentLoopInput
): Effect.Effect<AgentLoopState | ActionOutcome, never, AiService> =>
  Effect.gen(function* () {
    if (state.stepsExecuted >= input.maxSteps) return state
    const ai = yield* AiService
    const result = yield* Effect.either(ai.chat(buildStepChatInput(state, input)))
    if (result._tag === 'Left') {
      return aiErrorOutcome({
        code: 'agent_provider_error',
        message: result.left.message,
        retryable: true,
      })
    }
    const toolCalls = result.right.toolCalls ?? []
    const rejection = toolCalls
      .map((call) => validateToolCall(call, input))
      .find((outcome): outcome is ActionOutcome => outcome !== undefined)
    if (rejection !== undefined) return rejection
    const next = advanceState(state, result.right, input.allowedActions)
    const stopped = toolCalls.length === 0
    return stopped ? next : yield* runAgentLoop(next, input)
  })

const resolveMaxSteps = (props: Readonly<Record<string, unknown>>): number => {
  const raw = props['maxSteps']
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1
    ? Math.floor(raw)
    : DEFAULT_MAX_STEPS
}

const resolveAgentTask = (
  props: Readonly<Record<string, unknown>>,
  app: App
): { readonly agent: Agent; readonly task: string } | ActionOutcome => {
  const agentName = stringProp(props, 'agent')
  const task = stringProp(props, 'task')
  if (agentName === '' || task === '') {
    return { status: 'failure', error: 'ai.agent requires an agent and a task' }
  }
  const agent = app.agents?.find((candidate) => candidate.name === agentName)
  if (agent === undefined) {
    return {
      status: 'failure',
      error: `ai.agent: agent '${agentName}' does not exist in app.agents`,
    }
  }
  return { agent, task }
}

const composeSystemPrompt = (
  agent: Readonly<Agent>,
  knowledgeChunks: readonly { readonly content: string }[]
): string => {
  const knowledgeContext =
    knowledgeChunks.length > 0
      ? [
          '',
          'Relevant knowledge retrieved from your knowledge base:',
          ...knowledgeChunks.map((chunk, idx) => `[${idx + 1}] ${chunk.content}`),
        ].join('\n')
      : ''
  return [buildAgentSystemPrompt(agent), knowledgeContext]
    .filter((part) => part.trim().length > 0)
    .join('\n\n')
}

export const handleAiAgent: ActionHandler = (action, app: App, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const resolved = resolveAgentTask(props, app)
    if ('status' in resolved) return resolved
    const { agent, task } = resolved

    const knowledgeChunks = yield* retrieveKnowledgeChunks({ task, agent })
    const systemPrompt = composeSystemPrompt(agent, knowledgeChunks)

    const initial: AgentLoopState = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task },
      ],
      stepsExecuted: 0,
      toolsUsed: [],
      lastReply: undefined,
    }
    const outcome = yield* runAgentLoop(initial, {
      agent,
      model: resolveModel(agent),
      tools: buildAgentTools(agent),
      allowedActions: new Set(agent.tools?.actions ?? []),
      allowedTables: new Set(agent.tools?.tables ?? []),
      maxSteps: resolveMaxSteps(props),
    })
    if (!('messages' in outcome)) return outcome

    return {
      status: 'success',
      output: {
        result: outcome.lastReply?.content ?? '',
        toolsUsed: outcome.toolsUsed,
        stepsExecuted: outcome.stepsExecuted,
        knowledgeUsed: knowledgeChunks.length,
      },
    } as const
  })
