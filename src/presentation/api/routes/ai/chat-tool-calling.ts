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
import {
  countDynamicRecords,
  listDynamicRecords,
} from '@/application/use-cases/ai/dynamic-record-query'
import { hasReadPermissionForRoles } from '@/domain/validators/permission-evaluators'
import { type ReadPrincipal } from '@/domain/validators/read-access-plan'
import { recordActivityLogRow, recordChatActivity } from './chat-activity-log'
import { appendConversationTurn } from './chat-conversation-store'
import { persistChatTurnDurably } from './chat-durable-memory'
import {
  projectAppTables,
  readableColumnsForTable,
  type ProjectedField,
} from './chat-table-projection'
import {
  buildStructuredCount,
  buildStructuredQuery,
  type StructuredQueryValidation,
} from './chat-tool-structured-query'
import { provideAiLive, provideDynamicRecordRepoLive } from './effect-runner'
import type { ChatAction, ChatResponse } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
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
  userRole: string,
  effectiveRoles: ReadonlyArray<string>
): ReadonlyArray<ToolCallTable> => {
  const tables = projectAppTables(app)
  // The caller resolves group memberships, so the principal carries the full
  // effective-role set. A `group:<name>` entry can never match a bare role
  // string, so passing `[userRole]` here would leave BOTH the table gate below
  // and the field-level column projection group-blind.
  const principal: ReadPrincipal = {
    role: userRole,
    effectiveRoles,
    isAuthenticated: userRole !== '',
  }
  return tables
    .filter((table) =>
      hasReadPermissionForRoles(
        table as { name: string; permissions?: { read?: unknown } },
        effectiveRoles,
        tables as ReadonlyArray<{ name: string; permissions?: never }>
      )
    )
    .map((table) => ({
      name: table.name,
      fields: table.fields,
      readableColumns: readableColumnsForTable(app, table, principal),
      ...(table.permissions !== undefined && { permissions: table.permissions }),
    }))
}

/** Inputs for running the tool-calling loop after an initial AI reply. */
export interface ToolCallingInput {
  /** The provider's first reply — inspected for `toolCalls`. */
  readonly initialReply: ChatReply
  /** The system + history + user message list sent on the first request. */
  readonly baseMessages: ReadonlyArray<ChatMessage>
  /** The tool definitions advertised to the provider. */
  readonly tools: ReadonlyArray<ChatToolDefinition>
  /** Tables the acting principal may reach — drives per-table RBAC. */
  readonly tables: ReadonlyArray<ToolCallTable>
  /** The acting user's role — table-level read RBAC. */
  readonly userRole: string
  /**
   * The acting user's role plus their `group:<name>` memberships. A `group:`
   * permission entry can never match a bare role string, so the per-tool table
   * gate consults this rather than {@link ToolCallingInput.userRole}.
   */
  readonly effectiveRoles: ReadonlyArray<string>
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
  const table = input.tables.find((candidate) => candidate.name === parsed.table)
  const action: ChatAction = {
    type: 'query',
    ...(parsed.table !== undefined && { table: parsed.table }),
    description: `Tool ${call.name} executed.`,
  }

  // Unknown tool family — the model fabricated a tool name we do not emit.
  if (parsed.kind === 'unknown') {
    return { content: `Error: unknown tool "${call.name}".`, action, denied: false }
  }

  // RBAC gate — the role must be able to read the target table
  //. An unknown table or a denied role both yield an
  // error tool result; no query is run.
  if (
    table === undefined ||
    !hasReadPermissionForRoles(
      table as { name: string; permissions?: { read?: unknown } },
      input.effectiveRoles,
      input.tables as ReadonlyArray<{ name: string; permissions?: never }>
    )
  ) {
    return {
      content: `Error: permission denied — you cannot access the "${parsed.table ?? call.name}" data.`,
      action,
      denied: true,
    }
  }

  return parsed.kind === 'count'
    ? executeCount(call, table, action)
    : executeQuery(call, table, action)
}

/** Execute a validated structured `query_<table>` call. */
const executeQuery = async (
  call: ChatToolCall,
  table: ToolCallTable,
  action: ChatAction
): Promise<ToolExecution> => {
  const validation: StructuredQueryValidation = buildStructuredQuery(
    callArgs(call),
    table.readableColumns
  )
  if (!validation.ok) {
    return {
      content: `Error: invalid query arguments — ${validation.error}`,
      action,
      denied: false,
    }
  }
  const { inputs } = validation
  // Run the structured query via the safe, parameterized builder. `Effect.either`
  // turns a DB failure into a Left → the same error tool-result fed back to the
  // model (never throws / never 500s, [internal ref]).
  const result = await Effect.runPromise(
    listDynamicRecords({
      table: table.name,
      ...(inputs.columns !== undefined && { columns: inputs.columns }),
      conditions: inputs.conditions,
      ...(inputs.sortColumn !== undefined && { sortColumn: inputs.sortColumn }),
      ...(inputs.sortDirection !== undefined && { sortDirection: inputs.sortDirection }),
      limit: inputs.limit,
    }).pipe(provideDynamicRecordRepoLive, Effect.result)
  )
  if (result._tag === 'Failure') {
    const { cause } = result.failure
    return {
      content: `Error: query execution failed — ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      action,
      denied: false,
    }
  }
  // Project every returned row to the role-readable columns (field-level
  // scoping defence-in-depth) before handing it to the model.
  const rows = result.success.map((row) => projectRow(row, table.readableColumns))
  return { content: JSON.stringify({ rows }), action, denied: false }
}

/** Execute a validated structured `count_<table>` call. */
const executeCount = async (
  call: ChatToolCall,
  table: ToolCallTable,
  action: ChatAction
): Promise<ToolExecution> => {
  const validation = buildStructuredCount(callArgs(call), table.readableColumns)
  if (!validation.ok) {
    return {
      content: `Error: invalid count arguments — ${validation.error}`,
      action,
      denied: false,
    }
  }
  const result = await Effect.runPromise(
    countDynamicRecords({ table: table.name, conditions: validation.inputs.conditions }).pipe(
      provideDynamicRecordRepoLive,
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    const { cause } = result.failure
    return {
      content: `Error: count execution failed — ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
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
  messages: ReadonlyArray<ChatMessage>,
  tools: ReadonlyArray<ChatToolDefinition>
): Promise<ChatReply | undefined> => {
  const result = await Effect.runPromise(
    callProvider(messages, tools).pipe(provideAiLive, Effect.result)
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
  const executions = await Promise.all(toolCalls.map((call) => executeToolCall(call, input)))
  // Record each executed tool call in activity monitoring — best-effort, a
  // logging failure must never break the chat turn. Awaiting the settled
  // array keeps the writes ordered before the function returns; the resolved
  // value (`void[]`) carries no information and is intentionally unused.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect; the void result is discarded
  await Promise.all(
    executions.map((execution) =>
      recordActivityLogRow({
        actorType: 'user',
        actorName: input.actorName,
        action: 'ai.chat.tool',
        ...(execution.action.table !== undefined && { targetTable: execution.action.table }),
      })
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
  const next = await runProvider(messages, input.tools)
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
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistChatTurnDurably({
    userId: input.actorName,
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    assistantReply: reply,
    ...(input.agentName !== undefined && { agentName: input.agentName }),
  })
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })

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
