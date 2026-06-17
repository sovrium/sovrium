/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { recordActivityLogRow, recordChatActivity } from './chat-activity-log'
import { appendConversationTurn } from './chat-conversation-store'
import { persistTurnDurably } from './chat-durable-memory'
import {
  projectAppTables,
  readableColumnsForRole,
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

export interface ToolCallTable {
  readonly name: string
  readonly permissions?: unknown
  readonly fields: ReadonlyArray<ProjectedField>
  readonly readableColumns: ReadonlyArray<string>
}

export const toToolCallTables = (
  app: App | undefined,
  userRole: string
): ReadonlyArray<ToolCallTable> => {
  const tables = projectAppTables(app)
  return tables
    .filter((table) =>
      hasReadPermission(
        table as { name: string; permissions?: { read?: unknown } },
        userRole,
        tables as ReadonlyArray<{ name: string; permissions?: never }>
      )
    )
    .map((table) => ({
      name: table.name,
      fields: table.fields,
      readableColumns: readableColumnsForRole(table.fields, table.permissions, userRole),
      ...(table.permissions !== undefined && { permissions: table.permissions }),
    }))
}

export interface ToolCallingInput {
  readonly initialReply: ChatReply
  readonly baseMessages: ReadonlyArray<ChatMessage>
  readonly tools: ReadonlyArray<ChatToolDefinition>
  readonly tables: ReadonlyArray<ToolCallTable>
  readonly userRole: string
  readonly actorName: string
  readonly sessionId: string
  readonly userMessage: string
}

export interface ToolCallingResult {
  readonly reply: string
  readonly actions: ReadonlyArray<ChatAction>
  readonly executed: boolean
}

const DEFAULT_MAX_TOOL_ITERATIONS = 5

const resolveMaxToolIterations = (): number => {
  const raw = process.env.AI_CHAT_MAX_TOOL_ITERATIONS
  if (raw === undefined) return DEFAULT_MAX_TOOL_ITERATIONS
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_TOOL_ITERATIONS
}

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

interface ToolExecution {
  readonly content: string
  readonly action: ChatAction
  readonly denied: boolean
}

const RBAC_DENIED_REPLY =
  'I cannot complete that request — you do not have permission to access the requested data.'

const callArgs = (call: ChatToolCall): Record<string, unknown> =>
  call.arguments !== null && typeof call.arguments === 'object'
    ? (call.arguments as Record<string, unknown>)
    : {}

const projectRow = (
  row: Record<string, unknown>,
  readableColumns: ReadonlyArray<string>
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).filter(([key]) => readableColumns.includes(key)))

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

  if (parsed.kind === 'unknown') {
    return { content: `Error: unknown tool "${call.name}".`, action, denied: false }
  }

  if (
    table === undefined ||
    !hasReadPermission(
      table as { name: string; permissions?: { read?: unknown } },
      input.userRole,
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
  const result = await Effect.runPromise(
    listDynamicRecords({
      table: table.name,
      ...(inputs.columns !== undefined && { columns: inputs.columns }),
      conditions: inputs.conditions,
      ...(inputs.sortColumn !== undefined && { sortColumn: inputs.sortColumn }),
      ...(inputs.sortDirection !== undefined && { sortDirection: inputs.sortDirection }),
      limit: inputs.limit,
    }).pipe(provideDynamicRecordRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
    const { cause } = result.left
    return {
      content: `Error: query execution failed — ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      action,
      denied: false,
    }
  }
  const rows = result.right.map((row) => projectRow(row, table.readableColumns))
  return { content: JSON.stringify({ rows }), action, denied: false }
}

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
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    const { cause } = result.left
    return {
      content: `Error: count execution failed — ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      action,
      denied: false,
    }
  }
  return { content: JSON.stringify({ count: result.right }), action, denied: false }
}

const callProvider = (
  messages: ReadonlyArray<ChatMessage>,
  tools: ReadonlyArray<ChatToolDefinition>
): Effect.Effect<ChatReply, AiError, AiService> =>
  Effect.gen(function* () {
    const ai = yield* AiService
    return yield* ai.chat({ messages, tools })
  })

const runProvider = async (
  messages: ReadonlyArray<ChatMessage>,
  tools: ReadonlyArray<ChatToolDefinition>
): Promise<ChatReply | undefined> => {
  const result = await Effect.runPromise(
    callProvider(messages, tools).pipe(provideAiLive, Effect.either)
  )
  return result._tag === 'Right' ? result.right : undefined
}

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

const executeToolCalls = async (
  toolCalls: ReadonlyArray<ChatToolCall>,
  input: ToolCallingInput
): Promise<ReadonlyArray<ToolExecution>> => {
  const executions = await Promise.all(toolCalls.map((call) => executeToolCall(call, input)))
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

interface LoopState {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly reply: ChatReply
  readonly actions: ReadonlyArray<ChatAction>
  readonly executed: boolean
  readonly done: boolean
  readonly replyOverride?: string
}

const advanceLoop = async (state: LoopState, input: ToolCallingInput): Promise<LoopState> => {
  const { toolCalls } = state.reply
  if (toolCalls === undefined || toolCalls.length === 0) {
    return { ...state, done: true }
  }
  const executions = await executeToolCalls(toolCalls, input)
  const actions = [...state.actions, ...executions.map((execution) => execution.action)]

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

const driveLoop = async (
  state: LoopState,
  input: ToolCallingInput,
  remaining: number
): Promise<LoopState> => {
  if (state.done || remaining <= 0) return state
  const next = await advanceLoop(state, input)
  return driveLoop(next, input, remaining - 1)
}

export const runToolCallingLoop = async (input: ToolCallingInput): Promise<ToolCallingResult> => {
  const initialState: LoopState = {
    messages: input.baseMessages,
    reply: input.initialReply,
    actions: [],
    executed: false,
    done: false,
  }
  const finalState = await driveLoop(initialState, input, resolveMaxToolIterations())
  const reply = finalState.replyOverride ?? finalState.reply.content

  appendConversationTurn(input.sessionId, input.userMessage, reply)
  await persistTurnDurably(input.actorName, input.sessionId, input.userMessage, reply)
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })

  return { reply, actions: finalState.actions, executed: finalState.executed }
}

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
