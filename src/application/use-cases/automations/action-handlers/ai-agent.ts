/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `ai/agent` action handler — dispatches an automation task to a named AI
 * agent declared in `app.agents[]`.
 *
 * Unlike `ai/generate` (a single one-shot completion), an agent action runs
 * an autonomous multi-step loop: it advertises the agent's allowlisted tools
 * to the LLM, executes any tool calls the model requests, feeds the results
 * back, and re-queries — bounded by the action's `maxSteps`.
 *
 * The handler reuses the shared `AiService` port (the same provider plumbing
 * as `ai/generate`), so the agent's LLM round-trips are observed by the AI
 * mock server in E2E specs.
 *
 * Wave: [internal ref].
 */

import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import { AiEmbeddingRepositoryActive } from '@/infrastructure/database/repositories/ai/ai-embedding-repository-live'
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

/** Default per-action step cap when `props.maxSteps` is omitted. */
const DEFAULT_MAX_STEPS = 10

/** Default retrieval limit when `agent.memory.knowledge.retrievalLimit` is omitted. */
const DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT = 5

/** Default similarity threshold when `agent.memory.knowledge.similarityThreshold` is omitted. */
const DEFAULT_KNOWLEDGE_SIMILARITY_THRESHOLD = 0.7

/**
 * Search the agent's knowledge base for chunks semantically relevant to the
 * task. Returns
 * the matched chunks, scoped to the agent's declared `sources` (each source
 * names a path-prefix under `AI_KNOWLEDGE_DIR`).
 *
 * A provider/DB failure resolves to an empty list — knowledge retrieval is a
 * best-effort augmentation that must never break the agent invocation.
 *
 * That tolerance is precisely why the repository Layer must be the
 * dialect-gated `AiEmbeddingRepositoryActive` and never the Postgres-only
 * `AiEmbeddingRepositoryLive`: on SQLite the latter's pgvector `<=>` search is
 * invalid SQL, and `orElseSucceed` would convert every retrieval into a silent
 * zero-chunk result. The WRITE side (`embed-pipeline.ts`) already gates
 * correctly, so the index would keep filling and never be read.
 */
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
    const embedResult = yield* Effect.result(ai.embed({ text: input.task }))
    if (embedResult._tag === 'Failure') return []

    const searchProgram = Effect.gen(function* () {
      const repo = yield* AiEmbeddingRepository
      return yield* repo.search({
        embedding: embedResult.success.embedding,
        // Document knowledge is stored with `agent_name = null` (global). The
        // agent's `sources` allowlist is applied as a sourceRef-prefix filter
        // post-search rather than at the SQL layer.
        agentName: undefined,
        minSimilarity: threshold,
        maxResults: limit,
      })
    }).pipe(
      Effect.provide(AiEmbeddingRepositoryActive),
      Effect.orElseSucceed(() => [] as ReadonlyArray<never>)
    )
    const results = yield* searchProgram

    // Honour `agent.memory.knowledge.sources` by keeping only chunks whose
    // sourceRef path falls under one of the named sources. An empty `sources`
    // array (or omitted) means no filtering — every retrieved chunk counts.
    const filtered =
      sources.length === 0
        ? results
        : results.filter((row) => {
            const ref = row.sourceRef ?? ''
            // Document refs are shaped `document:<path>:<chunkIndex>` where
            // `<path>` is relative to AI_KNOWLEDGE_DIR (e.g. `product-docs/password.md`).
            return sources.some((source) => ref.startsWith(`document:${source}/`))
          })
    return filtered.map((row) => ({ content: row.content, sourceRef: row.sourceRef }))
  })

/**
 * Build the agent's effective system prompt: its base `systemPrompt` plus a
 * capability context block enumerating the allowlisted tables + actions, so
 * the LLM is aware of the exact constraints it operates within. Mirrors the
 * agent-execute path's `buildSystemPrompt` (kept inline so the application
 * layer does not reach into the presentation layer).
 */
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

/**
 * Per-action description overrides for the tools advertised to the LLM.
 *
 * The generic fallback ("perform the X operation") is enough for actions whose
 * name already says what they do, but it is actively harmful for the read pair:
 * `record.read` and `record.list` would otherwise be described identically bar
 * one word, leaving the model to guess which one takes a filter. A model that
 * picks `read` for a filtered question gets a refusal, and one that picks
 * `list` for a by-id question sweeps the table — so the distinction is spelled
 * out rather than implied.
 */
const ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'record.read':
    'Fetch exactly ONE record by its primary key. Requires the record id. ' +
    'Cannot filter, sort, or return multiple records — use record.list for that.',
  'record.list':
    'Fetch a SET of records matching conditions. Supports filtering, sorting, ' +
    'and limit/offset paging, and returns zero or more records. ' +
    'Use record.read instead when you already know the exact record id.',
}

/**
 * Build the OpenAI-compatible `tools[]` array advertised to the LLM — one
 * function per allowlisted agent action, scoped to the agent's tables. A
 * tool is named exactly after the agent action (`record.read`) so the
 * model (and the captured request) reflects the allowlist verbatim: an
 * action outside the allowlist simply has no tool.
 */
const buildAgentTools = (agent: Agent): ReadonlyArray<ChatToolDefinition> => {
  const { tools } = agent
  if (tools === undefined) return []
  const tableList = tools.tables.join(', ')
  return tools.actions.map((action) => ({
    type: 'function' as const,
    function: {
      name: action,
      description: `${
        ACTION_DESCRIPTIONS[action] ?? `Perform the "${action}" operation.`
      } Allowlisted tables: ${tableList}.`,
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

/**
 * Synthesise a `role: 'tool'` result message for one tool call. The agent
 * action runtime does not execute side effects against tables in this v1
 * surface — it acknowledges the call so the loop can continue and the model
 * can produce a final answer. Tool calls outside the agent's allowlist are
 * rejected with an error result (never silently honoured).
 */
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

/** Resolve the effective request model: `agent.model` → `AI_MODEL` → mock. */
const resolveModel = (agent: Agent): string =>
  agent.model ?? process.env['AI_MODEL'] ?? 'mock-model'

/** Immutable inputs threaded through every step of the agent loop. */
interface AgentLoopInput {
  readonly agent: Agent
  readonly model: string
  readonly tools: ReadonlyArray<ChatToolDefinition>
  readonly allowedActions: ReadonlySet<string>
  readonly allowedTables: ReadonlySet<string>
  readonly maxSteps: number
}

/**
 * Validate one model-requested tool call against the agent's allowlist. A
 * call is rejected when its action is outside the allowlist, or when it
 * references a `table` argument that is not one of the agent's allowlisted
 * tables. Returns a structured {@link ActionOutcome} on rejection (so the
 * caller surfaces `output.error.code` per the AI runtime-error contract),
 * or `undefined` when the call is honourable.
 */
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

/** Mutable-by-replacement state advanced one step at a time. */
interface AgentLoopState {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly stepsExecuted: number
  readonly toolsUsed: ReadonlyArray<string>
  readonly lastReply: ChatReply | undefined
}

/** Assemble the `AiService.chat` request body for one agent step. */
const buildStepChatInput = (state: AgentLoopState, input: AgentLoopInput): ChatInput => ({
  messages: state.messages,
  model: input.model,
  ...(input.agent.temperature !== undefined ? { temperature: input.agent.temperature } : {}),
  ...(input.agent.maxTokens !== undefined ? { maxTokens: input.agent.maxTokens } : {}),
  ...(input.tools.length > 0 ? { tools: input.tools } : {}),
})

/**
 * Fold a model reply into the next loop state: when the reply carries tool
 * calls, append the assistant turn + each tool result and record the
 * allowlisted tool names; otherwise the state's message list is unchanged.
 */
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

/**
 * Drive the agent loop recursively: a single `AiService.chat` round-trip per
 * recursion, stopping when the model returns no tool calls or `maxSteps` is
 * reached — whichever comes first. A provider failure mid-loop surfaces as a
 * graceful `ActionOutcome` (`status: 'success'` with `output.error`).
 */
const runAgentLoop = (
  state: AgentLoopState,
  input: AgentLoopInput
): Effect.Effect<AgentLoopState | ActionOutcome, never, AiService> =>
  Effect.gen(function* () {
    if (state.stepsExecuted >= input.maxSteps) return state
    const ai = yield* AiService
    const result = yield* Effect.result(ai.chat(buildStepChatInput(state, input)))
    if (result._tag === 'Failure') {
      return aiErrorOutcome({
        code: 'agent_provider_error',
        message: result.failure.message,
        retryable: true,
      })
    }
    // Validate every tool call the model requested against the agent's
    // allowlist BEFORE acting on it. An unknown action or an out-of-allowlist
    // table aborts the loop with a structured `agent_error`-class outcome
    // rather than being silently acknowledged.
    const toolCalls = result.success.toolCalls ?? []
    const rejection = toolCalls
      .map((call) => validateToolCall(call, input))
      .find((outcome): outcome is ActionOutcome => outcome !== undefined)
    if (rejection !== undefined) return rejection
    const next = advanceState(state, result.success, input.allowedActions)
    const stopped = toolCalls.length === 0
    return stopped ? next : yield* runAgentLoop(next, input)
  })

/** Read `props.maxSteps` defensively, defaulting to {@link DEFAULT_MAX_STEPS}. */
const resolveMaxSteps = (props: Readonly<Record<string, unknown>>): number => {
  const raw = props['maxSteps']
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1
    ? Math.floor(raw)
    : DEFAULT_MAX_STEPS
}

/**
 * Resolve the `ai/agent` action's `props` into either a ready-to-run
 * `{ agent, task }` pair or a graceful failure `ActionOutcome`. Presence-
 * guards `agent`/`task` and re-checks the agent exists (defence-in-depth —
 * the AppSchema cross-validator already rejects unknown agents at decode).
 */
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

/**
 * Compose the final system prompt: agent persona + (optional) retrieved
 * knowledge context. Extracted from the handler to keep its cyclomatic
 * complexity within the project budget (max 10).
 */
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

/**
 * `ai/agent` handler — dispatches the resolved `task` to the named agent in
 * `app.agents[]`, runs the bounded autonomous loop, and surfaces the result
 * as `output: { result, toolsUsed, stepsExecuted, knowledgeUsed }`.
 *
 * `props.task` and `props.agent` are already template-resolved by the run
 * loop. The referenced agent is guaranteed to exist (the AppSchema
 * cross-validator rejects `ai:agent` actions naming an unknown agent at
 * decode time), but the handler still presence-guards defensively.
 */
export const handleAiAgent: ActionHandler = (action, app: App, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const resolved = resolveAgentTask(props, app)
    if ('status' in resolved) return resolved
    const { agent, task } = resolved

    // Knowledge retrieval (RAG): if the agent declares `memory.knowledge.enabled`,
    // embed the task and pull matching chunks from `system.ai_embeddings`. The
    // retrieved chunks are surfaced as `output.knowledgeUsed` (count) and
    // prepended to the system prompt so the model can ground its answer in
    // ingested knowledge.
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
        // Knowledge retrieval count — non-zero only when the agent declares
        // `memory.knowledge.enabled` AND a knowledge source returned at least
        // one chunk above the configured similarity threshold.
        knowledgeUsed: knowledgeChunks.length,
      },
    } as const
  })
