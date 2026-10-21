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
 * the agent runtime (`use-cases/agents/agent-runtime.ts`): it advertises the
 * agent's allowlisted tools, RUNS each tool call the model makes through the
 * agent's gates and the automation engine's own handler for the action — the
 * same handlers, inside the same run, as a step would — hands the real result
 * back, and re-queries, bounded by the action's `maxSteps`.
 *
 * Wave: the automations actions AI agent requirement.
 */

import { Effect } from 'effect'
import { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import { AiService } from '@/application/ports/services/ai-service'
import {
  runAgentTurnToEnd,
  type AgentTurnResult,
} from '@/application/use-cases/agents/agent-runtime'
import {
  agentActionKey,
  buildAgentActionTools,
  buildAgentSystemPrompt,
} from '@/domain/models/app/agents/agent-turn-service'
import { readsOfToolCalls } from '@/domain/models/app/automations/step-read-service'
import { logError } from '@/infrastructure/logging/logger'
import { aiErrorOutcome, classifyAiError } from './ai'
import { chunksWithinStarterReach } from './ai-agent-starter-reach'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type {
  AgentActionResult,
  AgentActionRunner,
  AgentToolResult,
} from '@/application/use-cases/agents/agent-tool-call'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/** Default per-action step cap when `props.maxSteps` is omitted. */
const DEFAULT_MAX_STEPS = 10

/** Default retrieval limit when `agent.memory.knowledge.retrievalLimit` is omitted. */
const DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT = 5

/** Default similarity threshold when `agent.memory.knowledge.similarityThreshold` is omitted. */
const DEFAULT_KNOWLEDGE_SIMILARITY_THRESHOLD = 0.7

/**
 * Log a task that could not be embedded, with its cause, before the agent
 * falls back to running without retrieved knowledge.
 */
const logEmbedFailure =
  (agentName: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError(
            '[automations] ai.agent could not embed its task; running without retrieved knowledge',
            cause,
            { 'sovrium.agent.name': agentName }
          )
        )
      )
    )

/**
 * Search the agent's knowledge base for chunks semantically relevant to the
 * task. Returns
 * the matched chunks of the agent's OWN table index and of the global document
 * knowledge, the documents narrowed to the agent's declared `sources` (each
 * source names a path-prefix under `AI_KNOWLEDGE_DIR`). Another agent's index
 * is never read: an agent whose role reads less must not retrieve what an agent
 * whose role reads more had embedded.
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
  readonly app: App
  readonly automation: AutomationContext
}): Effect.Effect<
  ReadonlyArray<{ readonly content: string; readonly sourceRef: string | null }>,
  never,
  AiService | AiEmbeddingRepository | TableRepository | AuthRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    const memory = input.agent.memory?.knowledge
    if (memory === undefined || memory.enabled !== true) return []
    const limit = memory.retrievalLimit ?? DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT
    const threshold = memory.similarityThreshold ?? DEFAULT_KNOWLEDGE_SIMILARITY_THRESHOLD
    const sources = memory.sources ?? []

    const ai = yield* AiService
    // effect-swallow: fail-soft — a task that cannot be embedded runs without retrieved knowledge, as an agent with none does; the cause is logged on the way.
    const embedResult = yield* Effect.result(
      ai.embed({ text: input.task }).pipe(logEmbedFailure(input.agent.name))
    )
    if (embedResult._tag === 'Failure') return []

    const searchProgram = Effect.gen(function* () {
      const repo = yield* AiEmbeddingRepository
      return yield* repo.search({
        embedding: embedResult.success.embedding,
        // The agent's own index, plus the document knowledge stored with
        // `agent_name = null` (global) — never another agent's index. The
        // agent's `sources` allowlist is applied to the documents as a
        // sourceRef-prefix filter post-search rather than at the SQL layer.
        agentName: input.agent.name,
        includeGlobal: true,
        minSimilarity: threshold,
        maxResults: limit,
      })
    }).pipe(
      // effect-swallow: retrieval is an ENRICHMENT — a knowledge-index read that fails must leave the agent answering from its prompt rather than fail the run, and an empty result here already means "nothing matched".
      Effect.orElseSucceed(() => [] as ReadonlyArray<never>)
    )
    const results = yield* searchProgram

    // Honour `agent.memory.knowledge.sources` by keeping only the document
    // chunks whose path falls under one of the named sources. An empty
    // `sources` array (or omitted) means every document counts. The agent's
    // own table chunks are not documents and are kept.
    const filtered = results.filter((row) => {
      if (row.agentName !== null) return row.agentName === input.agent.name
      if (sources.length === 0) return true
      const ref = row.sourceRef ?? ''
      // Document refs are shaped `document:<path>:<chunkIndex>` where
      // `<path>` is relative to AI_KNOWLEDGE_DIR (e.g. `product-docs/password.md`).
      return sources.some((source) => ref.startsWith(`document:${source}/`))
    })
    // A run started by hand reads as its starter too: of the agent's chunks,
    // only those she may read herself ground the answer.
    const reachable = yield* chunksWithinStarterReach(input.app, input.automation, filtered)
    return reachable.map((row) => ({ content: row.content, sourceRef: row.sourceRef }))
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

/** The code a step fails with when the model's only calls were refused by the gates. */
const REFUSAL_CODES: Readonly<Record<NonNullable<AgentToolResult['refusal']>, string>> = {
  'action-not-allowed': 'invalid_tool',
  'table-not-allowed': 'table_not_found',
  'role-denied': 'tool_error',
  'caller-denied': 'tool_error',
  'rate-limited': 'agent_error',
  queued: 'agent_error',
}

/**
 * The step failure for a turn that ended because every call of a step was
 * refused — never silently honoured, never acknowledged.
 */
const refusalOutcome = (results: readonly AgentToolResult[]): ActionOutcome | undefined => {
  const refusals = results.filter((result) => result.outcome === 'denied')
  const last = refusals.at(-1)
  if (last === undefined || refusals.length !== results.length) return undefined
  return aiErrorOutcome({
    code: REFUSAL_CODES[last.refusal ?? 'action-not-allowed'],
    message: `ai.agent: the agent attempted tool "${last.name}"${
      last.table === undefined ? '' : ` on table "${last.table}"`
    }, which its allowlist or role does not permit`,
    retryable: false,
  })
}

/**
 * The agent's actions run inside the automation run, through the engine's
 * native-action dispatcher, so a record the agent writes starts its table's
 * record automations under the run's depth limit and its reads are recorded
 * against this step. Outside a run (a unit test) nothing can run an action.
 */
const runActionInRun =
  (runContext: ActionRunContext | undefined): AgentActionRunner<never> =>
  (action, props) => {
    const invoke = runContext?.invokeNativeAction
    if (invoke === undefined) {
      return Effect.succeed({ ok: false, error: 'no automation run to dispatch the action in' })
    }
    const { type, operator } = agentActionKey(action)
    return Effect.tryPromise({
      try: () => invoke(type, operator, props),
      catch: (cause) => (cause instanceof Error ? cause.message : String(cause)),
    }).pipe(
      Effect.map((output): AgentActionResult => ({
        ok: true,
        output:
          typeof output === 'object' && output !== null
            ? (output as Readonly<Record<string, unknown>>)
            : { result: output },
      })),
      Effect.catch((error) => Effect.succeed<AgentActionResult>({ ok: false, error }))
    )
  }

/** The step output of a turn that ran to its end. */
const turnOutput = (
  turn: AgentTurnResult,
  knowledgeUsed: number
): Readonly<Record<string, unknown>> => {
  const pending = turn.toolResults.flatMap((result) =>
    result.approvalId === undefined ? [] : [result.approvalId]
  )
  return {
    result: turn.reply,
    toolsUsed: turn.toolResults
      .filter((result) => result.outcome === 'ok' || result.outcome === 'failed')
      .map((result) => result.name),
    stepsExecuted: turn.steps,
    // Knowledge retrieval count — non-zero only when the agent declares
    // `memory.knowledge.enabled` AND a knowledge source returned at least
    // one chunk above the configured similarity threshold.
    knowledgeUsed,
    ...(pending.length > 0 && { pendingApprovals: pending }),
  }
}

/**
 * `ai/agent` handler — dispatches the resolved `task` to the named agent in
 * `app.agents[]`, runs its turn on the agent runtime, and surfaces the result
 * as `output: { result, toolsUsed, stepsExecuted, knowledgeUsed }`.
 *
 * `props.task` and `props.agent` are already template-resolved by the run
 * loop. The referenced agent is guaranteed to exist (the AppSchema
 * cross-validator rejects `ai:agent` actions naming an unknown agent at
 * decode time), but the handler still presence-guards defensively.
 */
export const handleAiAgent: ActionHandler = (action, app: App, automation, runContext) =>
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
    const knowledgeChunks = yield* retrieveKnowledgeChunks({ task, agent, app, automation })
    const toolDefinitions = buildAgentActionTools(agent)
    const turn = yield* Effect.result(
      runAgentTurnToEnd({
        surface: 'automation',
        agent,
        app,
        requestedById: automation.userId,
        tools: { runAction: runActionInRun(runContext) },
        messages: [
          { role: 'system', content: composeSystemPrompt(agent, knowledgeChunks) },
          { role: 'user', content: task },
        ],
        toolDefinitions,
        maxSteps: resolveMaxSteps(props),
        model: {
          model: agent.model,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        },
      })
    )
    if (turn._tag === 'Failure') {
      return aiErrorOutcome({
        code: 'agent_provider_error',
        message: turn.failure.message,
        retryable: classifyAiError(turn.failure).retryable,
      })
    }
    const refusal = refusalOutcome(turn.success.toolResults)
    if (refusal !== undefined) return refusal
    const calls = turn.success.events.flatMap((event) =>
      event.type === 'tool_call'
        ? [{ id: event.id, name: event.name, arguments: event.arguments }]
        : []
    )
    return {
      status: 'success',
      output: turnOutput(turn.success, knowledgeChunks.length),
      // The records the tool calls named, for the erasure index.
      reads: readsOfToolCalls(calls),
    } as const
  }).pipe(Effect.withSpan('automations.handle-ai-agent', { attributes: actionAttributes(action) }))
