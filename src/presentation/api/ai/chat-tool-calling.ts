/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat function/tool-calling executor.
 *
 * Orchestration layer for `[internal ref]`
 *. When the AI provider responds with `tool_calls`
 * instead of (or alongside) text, this module:
 *
 *  - executes each requested tool — a `query_<table>` tool runs the
 * AI-supplied read query against `<table>`;
 *  - RBAC-gates execution by the tool's target table — a role lacking `read`
 *    on the table yields an error tool result, never data
 *;
 *  - feeds each tool result back to the provider as a `role: 'tool'` message
 * and re-queries so the model can continue;
 *  - caps the request/response loop at `AI_CHAT_MAX_TOOL_ITERATIONS`
 *    iterations so a model that keeps requesting tools cannot loop forever
 *;
 *  - records every executed tool call in `system.ai_activity_logs` under the
 * `ai.chat.tool` action;
 *  - surfaces each executed tool call as a `type: 'query'` entry in the chat
 * response `actions` array.
 *
 * SECURITY (Finding #1): the model NO LONGER supplies SQL. Each `query_<table>`
 * / `count_<table>` tool advertises a STRUCTURED schema (select/filters/sort/
 * limit) scoped to its own table's role-readable columns. `executeToolCall`
 * parses + re-validates those structured args (the security boundary) and
 * translates them into the safe, parameterized query builder via
 * `listDynamicRecords` / `countDynamicRecords`. Consequences:
 *   • cross-table reads are structurally impossible (no table-name arg);
 *   • writes / DDL are structurally impossible (read-only builder);
 *   • all values are bound; a fabricated SQL string lands in a filter `value`
 * and is treated as data, never as SQL;
 *   • field-level read permissions scope the `select` enum and result rows
 *;
 *   • a hard row cap of `MAX_QUERY_ROWS` is enforced server-side regardless of
 * the requested `limit`.
 */

import { Effect } from 'effect'
import {
  AiService,
  type ChatMessage,
  type ChatReply,
  type ChatToolCall,
  type ChatToolDefinition,
  type AiError,
} from '@/application/ports/services/ai-service'
import { toolSafeTableName } from '@/domain/models/app/auth/ai-access'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { recordActivityLogRow, recordChatActivity } from '@/presentation/api/ai/chat-activity-log'
import { appendConversationTurn } from './chat-conversation-store'
import { persistChatTurnDurably } from './chat-durable-memory'
import {
  chatReadableColumns,
  passesChatTableGate,
  readScopeOf,
  resolveChatRowScope,
  type ChatReader,
  type ChatRowScope,
} from './chat-read-scope'
import { projectAppTables, type ProjectedField } from './chat-table-projection'
import { toolCountProgram, toolQueryProgram } from './chat-tool-lookup-scope'
import {
  buildStructuredCount,
  buildStructuredQuery,
  type StructuredQueryValidation,
} from './chat-tool-structured-query'
import type { ChatAction, ChatResponse } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/**
 * Table shape carrying the permissions block (table-level RBAC re-check) plus
 * the role-readable column projection (drives the structured-arg validation and
 * the result-row projection).
 */
export interface ToolCallTable {
  readonly name: string
  readonly permissions?: unknown
  /** All fields (name/type/options) — used to derive readable columns. */
  readonly fields: ReadonlyArray<ProjectedField>
  /** Column names the acting role may READ (field-level RBAC applied). */
  readonly readableColumns: ReadonlyArray<string>
  /**
   * Columns a declared agent reads but the person it answers may not. Never
   * advertised and never returned; a `select` naming one is narrowed away, a
   * filter or sort naming one is refused like any unknown field.
   */
  readonly withheldColumns?: ReadonlyArray<string>
}

/**
 * Resolve the set of tables the acting role may *read* — the RBAC-scoped table
 * list used to build the function/tool definitions advertised to the AI
 * provider. A table the role cannot read is omitted
 * entirely, so the produced tool list never exposes an unauthorized table
 *. Each surviving table carries its role-readable column
 * projection so the tool enums and result rows are field-level scoped
 *.
 */
export const toToolCallTables = (
  app: App | undefined,
  reader: ChatReader
): ReadonlyArray<ToolCallTable> => {
  const tables = projectAppTables(app)
  return tables.flatMap((table) => {
    // The records route's own effective roles for this table: the account role,
    // a `group:<name>` entry per group (a bare role can never match one,
    // [internal ref]) and, under row-level rules, every assignment role —
    // so a table the records API lists for her is advertised to her.
    // An agent answering a person passes only where she passes too, and its
    // columns are the ones both may read (`chatReadableColumns`).
    if (!passesChatTableGate(app, tables, table, reader)) return []
    return [
      {
        name: table.name,
        fields: table.fields,
        ...chatReadableColumns(app, table, reader),
        ...(table.permissions !== undefined && { permissions: table.permissions }),
      },
    ]
  })
}

/** Inputs for running the tool-calling loop after an initial AI reply. */
export interface ToolCallingInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  /** The provider's first reply — inspected for `toolCalls`. */
  readonly initialReply: ChatReply
  /** The system + history + user message list sent on the first request. */
  readonly baseMessages: ReadonlyArray<ChatMessage>
  /** The tool definitions advertised to the provider. */
  readonly tools: ReadonlyArray<ChatToolDefinition>
  /** Tables the acting principal may reach — drives per-table RBAC. */
  readonly tables: ReadonlyArray<ToolCallTable>
  /** The app the tables come from — the records gates read its declarations. */
  readonly app: App | undefined
  /**
   * Who the tools read as: the table gate asks the records route's effective
   * roles for each table, and the row-level read rule narrows every call.
   */
  readonly reader: ChatReader
  /** The acting user's identifier — written to the activity log. */
  readonly actorName: string
  /** The session this turn belongs to — used for durable conversation persistence. */
  readonly sessionId: string
  /** The originating user message — persisted alongside the reply. */
  readonly userMessage: string
  /**
   * The declared agent this turn is bound to, when it is agent-bound. Threaded
   * through so the persisted conversation row keeps its attribution — a tool
   * call is the one path where an agent turn does NOT return through the
   * route's own completion, so without this the attribution would be lost
   * precisely on the turns that did the most work.
   */
  readonly agentName?: string
}

/** Outcome of the tool-calling loop. */
export interface ToolCallingResult {
  /** The final assistant text reply after the loop settled. */
  readonly reply: string
  /** One `type: 'query'` action per executed tool call. */
  readonly actions: ReadonlyArray<ChatAction>
  /** True when at least one tool call was executed. */
  readonly executed: boolean
}

/**
 * Default tool-calling iteration cap when `AI_CHAT_MAX_TOOL_ITERATIONS` is
 * unset. Each iteration is one provider round-trip that may emit tool calls.
 */
const DEFAULT_MAX_TOOL_ITERATIONS = 5

/** Resolve the operator-tunable tool-iteration cap from the environment. */
const resolveMaxToolIterations = (): number => {
  const raw = process.env.AI_CHAT_MAX_TOOL_ITERATIONS
  if (raw === undefined) return DEFAULT_MAX_TOOL_ITERATIONS
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOOL_ITERATIONS
}

/**
 * Parse a structured tool name into its `{ kind, table }`. Recognises the two
 * read-only tool families `query_<table>` and `count_<table>`; anything else is
 * `kind: 'unknown'` (an error tool-result, never executed).
 */
interface ParsedToolName {
  readonly kind: 'query' | 'count' | 'unknown'
  readonly table?: string
}
const parseToolName = (toolName: string): ParsedToolName => {
  if (toolName.startsWith('query_'))
    return { kind: 'query', table: toolName.slice('query_'.length) }
  if (toolName.startsWith('count_'))
    return { kind: 'count', table: toolName.slice('count_'.length) }
  return { kind: 'unknown' }
}

/** The result of executing a single tool call. */
interface ToolExecution {
  /** Content placed in the `role: 'tool'` follow-up message. */
  readonly content: string
  /** The `type: 'query'` action surfaced in the chat response. */
  readonly action: ChatAction
  /** True when the call was blocked by the per-table RBAC gate. */
  readonly denied: boolean
}

/**
 * User-facing reply text when every tool the model requested in a turn was
 * blocked by RBAC. Surfaced verbatim so the caller learns the request was
 * denied rather than receiving an empty reply.
 */
const RBAC_DENIED_REPLY =
  'I cannot complete that request — you do not have permission to access the requested data.'

/**
 * Reply text for a turn that EXECUTED tools but settled without any assistant
 * prose — the model kept requesting tools until the iteration budget ran out
 *, or the follow-up provider call failed.
 *
 * Deliberately not a fabricated answer: it reports what is actually known —
 * that the lookups ran and no summary came back — and points at the `actions[]`
 * that accompany it, which carry the real record of what happened. The
 * alternative shipped today is an EMPTY assistant bubble, which a chat surface
 * renders as a turn that silently did nothing, hiding work that in fact
 * executed against the operator's data.
 */
const NO_SUMMARY_REPLY =
  'I completed the requested lookups, but the assistant did not return a final summary. The actions taken are listed alongside this reply.'

/** The tool-call args object, normalised to a record (model may omit it). */
const callArgs = (call: ChatToolCall): Record<string, unknown> =>
  call.arguments !== null && typeof call.arguments === 'object'
    ? (call.arguments as Record<string, unknown>)
    : {}

/**
 * Project a result row to the role-readable columns only — defence-in-depth so
 * a restricted column never reaches the model even if it slipped into a `*`
 * select.
 */
const projectRow = (
  row: Record<string, unknown>,
  readableColumns: ReadonlyArray<string>
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => readableColumns.includes(key)))

/**
 * Execute one structured tool call. The tool name is parsed to `{kind, table}`;
 * table-level RBAC is re-checked (defence-in-depth); the structured args are
 * validated against the role-readable columns (the security boundary) and
 * translated into the safe parameterized query builder. A blocked/invalid/
 * failing call yields an error string fed back to the model (never throws) so
 * the provider can recover gracefully.
 */
const executeToolCall = async (
  call: ChatToolCall,
  input: ToolCallingInput
): Promise<ToolExecution> => {
  const parsed = parseToolName(call.name)
  // The tool carries the table's tool-safe name (`query_Open_Deals`); the
  // action and every message name the table as the config does.
  const table = input.tables.find((candidate) => toolSafeTableName(candidate.name) === parsed.table)
  const tableName = table?.name ?? parsed.table
  const action: ChatAction = {
    type: 'query',
    ...(tableName !== undefined && { table: tableName }),
    description: `Tool ${call.name} executed.`,
  }

  // Unknown tool family — the model fabricated a tool name we do not emit.
  if (parsed.kind === 'unknown') {
    return { content: `Error: unknown tool "${call.name}".`, action, denied: false }
  }

  // RBAC gate — the role must be able to read the target table
  //. An unknown table or a denied role both yield an
  // error tool result; no query is run.
  const scope = await toolRowScope(table, input)
  if (table === undefined || scope.kind === 'refused') {
    return {
      content: `Error: permission denied — you cannot access the "${tableName ?? call.name}" data.`,
      action,
      denied: true,
    }
  }

  const run = { services: input.services, app: input.app, reader: input.reader }
  return parsed.kind === 'count'
    ? executeCount({ ...run, call, table, action, scope })
    : executeQuery({ ...run, call, table, action, scope })
}

/**
 * The rows of the tool's table the reader may read: refused without the
 * table's read grant (over the records route's effective roles), otherwise the
 * records read gate's row-level answer.
 */
const toolRowScope = async (
  table: ToolCallTable | undefined,
  input: ToolCallingInput
): Promise<ChatRowScope> =>
  table !== undefined && passesChatTableGate(input.app, input.tables, table, input.reader)
    ? resolveChatRowScope(input.services, input.app, table.name, input.reader)
    : { kind: 'refused' }

/** One validated tool call, with the rows its reader may read. */
interface ToolCallRun {
  readonly services: DomainContext
  /** The app the table comes from — its lookups are judged by its declarations. */
  readonly app: App | undefined
  /** Who the call reads as — the lookups are judged for the person it answers. */
  readonly reader: ChatReader
  readonly call: ChatToolCall
  readonly table: ToolCallTable
  readonly action: ChatAction
  readonly scope: ChatRowScope
}

/** Execute a validated structured `query_<table>` call. */
const executeQuery = async (run: ToolCallRun): Promise<ToolExecution> => {
  const { call, table, action, scope } = run
  const validation: StructuredQueryValidation = buildStructuredQuery(
    callArgs(call),
    table.readableColumns,
    table.withheldColumns
  )
  if (!validation.ok) {
    return {
      content: `Error: invalid query arguments — ${validation.error}`,
      action,
      denied: false,
    }
  }
  const { inputs } = validation
  // A row-level rule that admits no row answers no row, as the records API does.
  if (scope.kind === 'nothing') {
    return { content: JSON.stringify({ rows: [] }), action, denied: false }
  }
  // `Effect.result` turns a failure into the error tool-result fed back to the
  // model (never throws / never 500s, [internal ref]).
  const result = await Effect.runPromise(
    toolQueryProgram({
      app: run.app,
      tableName: table.name,
      reader: run.reader,
      readScope: readScopeOf(scope),
      inputs,
    }).pipe(Effect.provide(run.services), Effect.result)
  )
  if (result._tag === 'Failure') {
    return {
      content: `Error: query execution failed — ${failureMessage(result.failure)}`,
      action,
      denied: false,
    }
  }
  // Project every returned row to the columns asked for (or every readable
  // one), the role-readable columns only — field-level scoping
  // defence-in-depth — before handing it to the model.
  const shown = (inputs.columns ?? table.readableColumns).filter((column) =>
    table.readableColumns.includes(column)
  )
  const rows = result.success.map((row) => projectRow(row, shown))
  return { content: JSON.stringify({ rows }), action, denied: false }
}

/** The text of a failed tool read: its cause's message, else the failure itself. */
const failureMessage = (failure: unknown): string => {
  const cause =
    failure !== null && typeof failure === 'object' && 'cause' in failure
      ? (failure as { readonly cause: unknown }).cause
      : failure
  return cause instanceof Error ? cause.message : String(cause)
}

/** Execute a validated structured `count_<table>` call. */
const executeCount = async (run: ToolCallRun): Promise<ToolExecution> => {
  const { services, call, table, action, scope } = run
  const validation = buildStructuredCount(callArgs(call), table.readableColumns)
  if (!validation.ok) {
    return {
      content: `Error: invalid count arguments — ${validation.error}`,
      action,
      denied: false,
    }
  }
  if (scope.kind === 'nothing') {
    return { content: JSON.stringify({ count: 0 }), action, denied: false }
  }
  const result = await Effect.runPromise(
    toolCountProgram({
      app: run.app,
      tableName: table.name,
      reader: run.reader,
      readScope: readScopeOf(scope),
      conditions: validation.inputs.conditions,
    }).pipe(Effect.provide(services), Effect.result)
  )
  if (result._tag === 'Failure') {
    return {
      content: `Error: count execution failed — ${failureMessage(result.failure)}`,
      action,
      denied: false,
    }
  }
  return { content: JSON.stringify({ count: result.success }), action, denied: false }
}

/** One provider round-trip carrying the accumulated message list + tools. */
const callProvider = (
  messages: ReadonlyArray<ChatMessage>,
  tools: ReadonlyArray<ChatToolDefinition>
): Effect.Effect<ChatReply, AiError, AiService> =>
  Effect.gen(function* () {
    const ai = yield* AiService
    return yield* ai.chat({ messages, tools })
  })

/** Run a single provider round-trip and return the reply, or undefined on error. */
const runProvider = async (
  services: DomainContext,
  messages: ReadonlyArray<ChatMessage>,
  tools: ReadonlyArray<ChatToolDefinition>
): Promise<ChatReply | undefined> => {
  const result = await Effect.runPromise(
    callProvider(messages, tools).pipe(Effect.provide(services), Effect.result)
  )
  return result._tag === 'Success' ? result.success : undefined
}

/**
 * Append the assistant `tool_calls` message and one `role: 'tool'` result
 * message per executed call onto the running message list.
 */
const appendToolTurn = (
  messages: ReadonlyArray<ChatMessage>,
  toolCalls: ReadonlyArray<ChatToolCall>,
  executions: ReadonlyArray<ToolExecution>
): ReadonlyArray<ChatMessage> => {
  const assistantMessage: ChatMessage = { role: 'assistant', content: '', toolCalls }
  const toolMessages: ReadonlyArray<ChatMessage> = toolCalls.map((call, index) => ({
    role: 'tool',
    content: executions[index]?.content ?? '',
    toolCallId: call.id,
  }))
  return [...messages, assistantMessage, ...toolMessages]
}

/**
 * Execute every tool call in one iteration and record each in the activity
 * log. Returns the per-call executions in request
 * order so the caller can build the follow-up message list + action array.
 */
const executeToolCalls = async (
  toolCalls: ReadonlyArray<ChatToolCall>,
  input: ToolCallingInput
): Promise<ReadonlyArray<ToolExecution>> => {
  // Bounded, not `Promise.all`. Every executed call is one pooled read against
  // a dynamic table, and NOTHING caps how many calls the model puts in a single
  // turn — `AI_CHAT_MAX_TOOL_ITERATIONS` caps the number of provider
  // round-trips, not the width of any one of them. So the width here is chosen
  // by the model, i.e. by whatever the prompt talked it into, and firing all of
  // them at once takes the whole ten-connection pool and starves every
  // co-firing request..
  //
  // This one is BOUNDED rather than collapsed, unlike its sibling fan-outs: the
  // calls address different tables with different filters and projections, so
  // there is no single query that answers all of them.
  const executions = await Effect.runPromise(
    Effect.forEach(
      toolCalls,
      // effect-promise: total -- every branch of `executeToolCall` returns a `ToolExecution` as a VALUE: an unknown tool, a denied role and a failed query all resolve through `Effect.result` into an error tool-result fed back to the model. It has no rejection path.
      (call) => Effect.promise(() => executeToolCall(call, input)),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
  )
  // Record each executed tool call in activity monitoring — best-effort, a
  // logging failure must never break the chat turn. Awaiting the settled
  // array keeps the writes ordered before the function returns; the resolved
  // value carries no information and is intentionally unused.
  //
  // Bounded on the same grounds and at the same width: one INSERT per executed
  // call, at a width the model chose. That these writes are best-effort bounds
  // their consequence, not their cost — a swallowed failure still held a
  // connection while it ran.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect; the void result is discarded
  await Effect.runPromise(
    Effect.forEach(
      executions,
      (execution) =>
        // effect-promise: total -- `recordActivityLogRow` resolves its write through `Effect.result` + `Effect.asVoid`, so a database failure becomes a discarded value rather than a rejection. Converting it to `tryPromise` would put that failure in the E channel of the `Effect.forEach` above, and the outer `runPromise` would then throw — breaking the chat turn this write exists to stay out of the way of.
        Effect.promise(() =>
          recordActivityLogRow(input.services, {
            actorType: 'user',
            actorName: input.actorName,
            action: 'ai.chat.tool',
            ...(execution.action.table !== undefined && { targetTable: execution.action.table }),
          })
        ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
  )
  return executions
}

/** The running state of the tool-calling loop, threaded between iterations. */
interface LoopState {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly reply: ChatReply
  readonly actions: ReadonlyArray<ChatAction>
  readonly executed: boolean
  /** Set once a terminal condition is reached so the loop stops. */
  readonly done: boolean
  /** Overrides the reply text when set (e.g. an all-denied RBAC turn). */
  readonly replyOverride?: string
}

/**
 * Advance the loop by one iteration: execute the pending tool calls, then
 * either terminate (all-denied / provider error) or re-query the provider and
 * carry the new reply forward.
 */
const advanceLoop = async (state: LoopState, input: ToolCallingInput): Promise<LoopState> => {
  const { toolCalls } = state.reply
  if (toolCalls === undefined || toolCalls.length === 0) {
    return { ...state, done: true }
  }
  const executions = await executeToolCalls(toolCalls, input)
  const actions = [...state.actions, ...executions.map((execution) => execution.action)]

  // Every requested tool was blocked by RBAC — surface the denial reply and
  // stop rather than re-querying for the same denied tool.
  if (executions.every((execution) => execution.denied)) {
    return { ...state, actions, executed: true, done: true, replyOverride: RBAC_DENIED_REPLY }
  }

  const messages = appendToolTurn(state.messages, toolCalls, executions)
  const next = await runProvider(input.services, messages, input.tools)
  if (next === undefined) {
    return { ...state, actions, executed: true, done: true }
  }
  return { messages, reply: next, actions, executed: true, done: false }
}

/**
 * Recursively drive the tool-calling loop. Each step advances the state by one
 * iteration; recursion stops once a terminal state is reached or the remaining
 * iteration budget is exhausted.
 *
 * Tail recursion (rather than a `for` loop) keeps the loop body free of mutable
 * accumulators while still threading the immutable {@link LoopState}.
 */
const driveLoop = async (
  state: LoopState,
  input: ToolCallingInput,
  remaining: number
): Promise<LoopState> => {
  if (state.done || remaining <= 0) return state
  const next = await advanceLoop(state, input)
  return driveLoop(next, input, remaining - 1)
}

/**
 * Run the tool-calling loop. When the initial reply carries no tool calls the
 * loop is a no-op and the initial text reply is returned unchanged.
 *
 * Otherwise, each iteration: executes the requested tools, logs them, feeds
 * the results back, and re-queries the provider — repeating until the model
 * returns a tool-call-free reply OR the iteration cap is hit.
 */
export const runToolCallingLoop = async (input: ToolCallingInput): Promise<ToolCallingResult> => {
  const initialState: LoopState = {
    messages: input.baseMessages,
    reply: input.initialReply,
    actions: [],
    executed: false,
    done: false,
  }
  const finalState = await driveLoop(initialState, input, resolveMaxToolIterations())
  const settledReply = finalState.replyOverride ?? finalState.reply.content
  // A tool-call reply carries empty `content` by construction, so a loop that
  // ends ON one — budget exhausted, or a failed follow-up — would otherwise
  // hand the caller an empty assistant turn for work that DID run.
  const reply =
    settledReply.length > 0 ? settledReply : finalState.executed ? NO_SUMMARY_REPLY : settledReply

  // Persist the completed tool-calling exchange so the next turn on the same
  // session carries it forward, and record the interaction in activity
  // monitoring. Both are best-effort side effects.
  appendConversationTurn(input.sessionId, input.userMessage, reply)
  await persistChatTurnDurably(input.services, {
    userId: input.actorName,
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    assistantReply: reply,
    ...(input.agentName !== undefined && { agentName: input.agentName }),
  })
  await recordChatActivity(input.services, {
    action: 'ai.chat.message',
    actorName: input.actorName,
  })

  return { reply, actions: finalState.actions, executed: finalState.executed }
}

/**
 * Build the `{ reply, actions, sessionId }` 200 chat envelope, attaching the
 * `X-RateLimit-Remaining` header when rate limiting is configured. Shared by
 * the tool-calling and read-query completion paths.
 */
export const respondWithActions = (
  c: Readonly<Context>,
  parts: {
    readonly reply: string
    readonly actions: ReadonlyArray<ChatAction>
    readonly sessionId: string
    readonly rateLimitRemaining: number | undefined
  }
): Response => {
  const body: ChatResponse = {
    reply: parts.reply,
    actions: [...parts.actions],
    sessionId: parts.sessionId,
  }
  if (parts.rateLimitRemaining !== undefined) {
    return c.json(body, 200, { 'X-RateLimit-Remaining': parts.rateLimitRemaining.toString() })
  }
  return c.json(body, 200)
}

/**
 * Run the tool-calling loop for a reply that requested tools and build the
 * 200 envelope. The route delegates the entire
 * tool-calling completion path here so `ai-chat.ts` stays focused on
 * dispatch. The loop persists the exchange and records activity itself.
 */
export const completeToolCallingTurn = async (
  c: Readonly<Context>,
  input: ToolCallingInput & { readonly rateLimitRemaining: number | undefined }
): Promise<Response> => {
  const loop = await runToolCallingLoop(input)
  return respondWithActions(c, {
    reply: loop.reply,
    actions: loop.actions,
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}
