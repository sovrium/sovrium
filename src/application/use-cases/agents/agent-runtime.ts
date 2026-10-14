/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one agent runtime ([internal ref] D2).
 *
 * Every agent turn runs here — a chat turn and its stream, an automation's
 * `ai:agent` step, a scheduled run, an approved action resumed. Given the
 * conversation so far, the tools on offer and who the turn runs as, the
 * runtime asks the model, resolves each tool call it makes through the agent's
 * gates (`agent-tool-call.ts`), one at a time, hands every result back, and
 * stops on a final answer, on its step cap, or on a pause.
 *
 * The loop is Sovrium's, not `effect/ai`'s, which has none: each step is one
 * `AiService` call. A surface only decides how the turn is delivered — it
 * drains the event stream into a JSON reply or a step output, or forwards it.
 *
 * Events, in order: the model's `content` / `reasoning` deltas, then for each
 * call it made a `tool_call` and its `tool_result`, then the next step's, and
 * a last `done`. A turn the provider cut short mid-stream ends WITHOUT `done`.
 *
 * Failures: a provider failure on the FIRST step fails the stream — nothing
 * happened yet, and a route maps it to a status. On a later step it ends the
 * turn with `done { finishReason: 'error' }`: work already done is not thrown
 * away because the summary of it failed.
 *
 * Cancellation is interruption. A tool call is uninterruptible once started,
 * so interrupting the consumer stops the turn at the next step boundary and
 * never leaves half a write; the caller that interrupted ends its own stream.
 */

import { Effect, Stream } from 'effect'
import { AgentGuard } from '@/application/ports/services/agent-guard'
import { logError } from '@/infrastructure/logging/logger'
import { bufferedStep, streamedStep, type StepItem } from './agent-model-step'
import { withAgentSkills } from './agent-skill-tools'
import { executeAgentToolCall } from './agent-tool-call'
import { canShowAForm, withAskUser } from './ask-user-tool'
import { withAgentMcpTools } from './mcp-agent-tools'
import type { AgentToolContext, AgentToolRequirements, AgentToolResult } from './agent-tool-call'
import type {
  AiService,
  AiError,
  ChatFinishReason,
  ChatInput,
  ChatMessage,
  ChatReply,
  ChatToolCall,
  ChatToolDefinition,
  ChatUsage,
} from '@/application/ports/services/ai-service'
import type { McpClient } from '@/application/ports/services/mcp-client'

/** One event of an agent turn. */
export type AgentTurnEvent =
  | { readonly type: 'content'; readonly delta: string }
  | { readonly type: 'reasoning'; readonly delta: string }
  | {
      readonly type: 'tool_call'
      readonly id: string
      readonly name: string
      readonly arguments: Record<string, unknown>
    }
  | ({ readonly type: 'tool_result' } & AgentToolResult)
  | {
      readonly type: 'done'
      readonly model: string
      readonly finishReason: ChatFinishReason
      readonly usage?: ChatUsage | undefined
      /** The text of the turn's last model reply — what a buffered surface returns. */
      readonly reply: string
      /** Model calls the turn made. */
      readonly steps: number
    }

/** The model settings a turn calls with. */
export interface AgentTurnModel {
  readonly model?: string | undefined
  readonly temperature?: number | undefined
  readonly maxTokens?: number | undefined
  readonly timeoutMs?: number | undefined
}

/** One agent turn. */
export interface AgentTurnSpec<R> extends AgentToolContext<R> {
  /** The conversation so far: system prompt, history, the new user message. */
  readonly messages: ReadonlyArray<ChatMessage>
  /** The tools advertised to the model. */
  readonly toolDefinitions: ReadonlyArray<ChatToolDefinition>
  /** Model calls the turn may make; with tools still asked for at the last, it ends `tool-limit`. */
  readonly maxSteps: number
  readonly model?: AgentTurnModel | undefined
  /** Stream each model call (a forwarding surface) rather than buffer it. */
  readonly stream?: boolean | undefined
  /**
   * How a buffered step calls the model — a surface's retry policy wraps the
   * port here. Defaults to `AiService.chat`.
   */
  readonly callModel?:
    ((input: ChatInput) => Effect.Effect<ChatReply, AiError, AiService>) | undefined
}

/** The requirements of a whole turn. */
export type AgentTurnRequirements = AiService | AgentToolRequirements | McpClient

interface TurnState {
  readonly messages: ReadonlyArray<ChatMessage>
  /** Model calls made so far. */
  readonly step: number
  readonly usage: ChatUsage | undefined
}

const addUsage = (
  total: ChatUsage | undefined,
  next: ChatUsage | undefined
): ChatUsage | undefined =>
  next === undefined
    ? total
    : total === undefined
      ? next
      : {
          inputTokens: total.inputTokens + next.inputTokens,
          outputTokens: total.outputTokens + next.outputTokens,
          totalTokens: total.totalTokens + next.totalTokens,
        }

const chatInput = <R>(spec: AgentTurnSpec<R>, messages: ReadonlyArray<ChatMessage>): ChatInput => ({
  messages,
  ...(spec.toolDefinitions.length > 0 && { tools: spec.toolDefinitions }),
  ...(spec.model?.model !== undefined && { model: spec.model.model }),
  ...(spec.model?.temperature !== undefined && { temperature: spec.model.temperature }),
  ...(spec.model?.maxTokens !== undefined && { maxTokens: spec.model.maxTokens }),
  ...(spec.model?.timeoutMs !== undefined && { timeoutMs: spec.model.timeoutMs }),
})

const done = (
  reply: ChatReply,
  finishReason: ChatFinishReason,
  state: Pick<TurnState, 'usage' | 'step'>
): AgentTurnEvent => ({
  type: 'done',
  model: reply.model,
  finishReason,
  usage: state.usage,
  reply: reply.content,
  steps: state.step,
})

/** A reply's own finish, as a turn's: a turn never ends on `tool-calls`. */
const turnFinish = (reply: ChatReply): ChatFinishReason =>
  reply.finishReason === undefined || reply.finishReason === 'tool-calls'
    ? 'stop'
    : reply.finishReason

/** What the model reads for a call its turn did not get to, an earlier one having paused it. */
export const NOT_RUN_CONTENT =
  'Not run: the turn paused, for an approval or a question, before this call.'

/** A call the turn did not get to, because an earlier one paused it. */
const notRun = (call: ChatToolCall): AgentToolResult => ({
  id: call.id,
  name: call.name,
  outcome: 'failed',
  content: NOT_RUN_CONTENT,
})

/** A call that pauses the turn: held for an approval, or asking the person a question. */
const pauses = (result: AgentToolResult): boolean =>
  result.outcome === 'pending-approval' || result.outcome === 'pending-input'

/**
 * Resolve a step's calls one at a time, in the order the model made them. Once
 * a call is held for approval, or asks the person a question, the rest of the
 * step does not run.
 */
const resolveCalls = <R>(
  spec: AgentTurnSpec<R>,
  calls: ReadonlyArray<ChatToolCall>,
  messages: ReadonlyArray<ChatMessage>,
  remainingSteps: number
): Effect.Effect<ReadonlyArray<AgentToolResult>, never, R | AgentToolRequirements> =>
  Effect.reduce(
    calls,
    (): ReadonlyArray<AgentToolResult> => [],
    (results, call) =>
      results.some(pauses)
        ? Effect.succeed([...results, notRun(call)])
        : Effect.map(
            executeAgentToolCall(call, spec, {
              // What a held call resumes with: the conversation, plus the
              // results of the calls of this step that ran before it.
              messages: [...messages, ...results.map(toolMessage)],
              tools: spec.toolDefinitions,
              remainingSteps,
            }),
            (result) => [...results, result]
          )
  )

const toolMessage = (result: AgentToolResult): ChatMessage => ({
  role: 'tool',
  content: result.content,
  toolCallId: result.id,
})

/** Charge a reply's tokens to the agent's daily budget. */
const chargeTokens = <R>(
  spec: AgentTurnSpec<R>,
  reply: ChatReply
): Effect.Effect<void, never, AgentGuard> =>
  spec.agent === undefined || reply.usage === undefined
    ? Effect.void
    : Effect.flatMap(Effect.service(AgentGuard), (guard) =>
        guard.recordTokens(spec.agent?.name ?? '', reply.usage?.totalTokens ?? 0)
      )

/** After a reply: finish, or resolve its calls and go on. */
const afterReply = <R>(
  spec: AgentTurnSpec<R>,
  state: TurnState,
  reply: ChatReply
): Stream.Stream<AgentTurnEvent, AiError, R | AgentTurnRequirements> =>
  Stream.unwrap(
    Effect.gen(function* () {
      yield* chargeTokens(spec, reply)
      const usage = addUsage(state.usage, reply.usage)
      const calls = reply.toolCalls ?? []
      if (calls.length === 0)
        return Stream.succeed(done(reply, turnFinish(reply), { usage, step: state.step }))
      if (state.step >= spec.maxSteps)
        return Stream.succeed(done(reply, 'tool-limit', { usage, step: state.step }))
      const messages: ReadonlyArray<ChatMessage> = [
        ...state.messages,
        { role: 'assistant', content: reply.content, toolCalls: calls },
      ]
      const results = yield* resolveCalls(spec, calls, messages, spec.maxSteps - state.step)
      const events: ReadonlyArray<AgentTurnEvent> = calls.flatMap((call, index) => {
        const result = results[index] ?? notRun(call)
        return [
          { type: 'tool_call' as const, id: call.id, name: call.name, arguments: call.arguments },
          { type: 'tool_result' as const, ...result },
        ]
      })
      const paused = results.some(pauses)
      const allDenied = results.every((result) => result.outcome === 'denied')
      const rest: Stream.Stream<AgentTurnEvent, AiError, R | AgentTurnRequirements> =
        paused || allDenied
          ? Stream.succeed(done(reply, 'stop', { usage, step: state.step }))
          : runStep(spec, {
              messages: [...messages, ...results.map(toolMessage)],
              step: state.step,
              usage,
            })
      return Stream.concat(Stream.fromIterable(events), rest)
    })
  )

/** One model call, then whatever its reply calls for. */
const runStep = <R>(
  spec: AgentTurnSpec<R>,
  state: TurnState
): Stream.Stream<AgentTurnEvent, AiError, R | AgentTurnRequirements> => {
  const next: TurnState = { ...state, step: state.step + 1 }
  const input = chatInput(spec, state.messages)
  const call = spec.stream === true ? streamedStep(input) : bufferedStep(spec.callModel, input)
  const items =
    state.step === 0
      ? call
      : call.pipe(
          Stream.tapError((error) =>
            Effect.sync(() => {
              logError('[agent-runtime] a later model call failed; the turn ends on error', error, {
                surface: spec.surface,
              })
            })
          ),
          // effect-swallow: the work earlier steps did stands; the turn ends with `done { finishReason: 'error' }` and the failure is logged above.
          Stream.catch(() => Stream.succeed(failedStep(state)))
        )
  return items.pipe(
    Stream.flatMap((item) =>
      item.kind === 'event'
        ? Stream.succeed(item.event)
        : item.reply.finishReason === 'error' && item.reply.model === ''
          ? Stream.succeed(done(item.reply, 'error', state))
          : afterReply(spec, next, item.reply)
    )
  )
}

/** A later step's provider failure, as the reply that ends the turn on `error`. */
const failedStep = (state: TurnState): StepItem => ({
  kind: 'reply',
  reply: {
    content: '',
    model: '',
    finishReason: 'error',
    ...(state.usage !== undefined && { usage: state.usage }),
  },
})

/**
 * Run one agent turn, as a stream of its events.
 *
 * Whatever the surface, the agent's external MCP tools — of the servers its
 * `mcp.servers` names, and only those — join the tools the surface brings, and
 * an agent with skills carries their index and the `load_skill` tool. On a
 * streamed chat with a signed-in person, the agent can also ask her a question
 * (`ask_user`), which pauses the turn until she answers — and so can an
 * external MCP server the agent calls, whose question is relayed to her.
 */
export const runAgentTurn = <R>(
  spec: AgentTurnSpec<R>
): Stream.Stream<AgentTurnEvent, AiError, R | AgentTurnRequirements> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const skilled = yield* withAgentSkills(spec.agent, spec)
      const asking = yield* withAskUser(spec, skilled.tools)
      const advertised = [
        ...spec.toolDefinitions,
        ...skilled.toolDefinitions,
        ...asking.toolDefinitions,
      ]
      const external = yield* withAgentMcpTools(
        spec.agent,
        asking.tools,
        advertised,
        canShowAForm(spec)
      )
      return runStep(
        {
          ...spec,
          tools: external.tools,
          toolDefinitions: [...advertised, ...external.toolDefinitions],
        },
        { messages: skilled.messages, step: 0, usage: undefined }
      )
    })
  )

/** What a whole turn did. */
export interface AgentTurnResult {
  readonly events: ReadonlyArray<AgentTurnEvent>
  /** The text of the last model reply. */
  readonly reply: string
  readonly model: string
  /** `undefined` when the provider cut the turn short. */
  readonly finishReason: ChatFinishReason | undefined
  readonly usage: ChatUsage | undefined
  /** Model calls the turn made. */
  readonly steps: number
  /** Every resolved tool call, in order. */
  readonly toolResults: ReadonlyArray<AgentToolResult>
}

type DoneEvent = Extract<AgentTurnEvent, { readonly type: 'done' }>

/** A turn's events, summarised; a turn cut short has no `done` to read. */
const summarise = (events: ReadonlyArray<AgentTurnEvent>): AgentTurnResult => {
  const last = events.findLast((event): event is DoneEvent => event.type === 'done')
  return {
    events,
    reply: last?.reply ?? '',
    model: last?.model ?? '',
    finishReason: last?.finishReason,
    usage: last?.usage,
    steps: last?.steps ?? 0,
    toolResults: events.flatMap((event) => (event.type === 'tool_result' ? [event] : [])),
  }
}

/** Run one agent turn to its end, for a surface that returns it whole. */
export const runAgentTurnToEnd = <R>(
  spec: AgentTurnSpec<R>
): Effect.Effect<AgentTurnResult, AiError, R | AgentTurnRequirements> =>
  Stream.runCollect(runAgentTurn(spec)).pipe(
    Effect.map((collected) => summarise([...collected])),
    Effect.withSpan('agents.run-agent-turn', { attributes: { 'agent.surface': spec.surface } })
  )
