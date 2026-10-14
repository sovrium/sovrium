/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  McpClient,
  McpToolCallError,
  type McpElicitationPolicy,
  type McpElicitationReply,
  type McpToolCallOutcome,
  type McpToolResult,
} from '@/application/ports/services/mcp-client'
import {
  parseAskUserArguments,
  type ElicitationAnswer,
} from '@/domain/models/app/agents/ask-user-service'
import {
  parseMcpModelToolName,
  quoteUntrustedToolResult,
  selectAgentMcpTools,
  toMcpChatToolDefinition,
  type AgentMcpScope,
  type AgentMcpTool,
} from '@/domain/models/app/agents/mcp-tool-service'
import type { AgentTurnTools, OtherToolResult } from './agent-tool-call'
import type { ChatToolCall, ChatToolDefinition } from '@/application/ports/services/ai-service'

/**
 * The external MCP tools as an agent turn uses them — the surface the agent
 * runtime consumes.
 *
 * - {@link listAgentMcpTools}: the tools to offer the model, named
 *   `<server>__<tool>`, each with the server's own argument JSON Schema and a
 *   `requiresApproval` flag (true unless the server annotated the tool
 *   `readOnlyHint: true`).
 * - {@link withAgentMcpTools}: a turn's tools with the agent's external ones
 *   added — what the agent runtime does to every turn, on every surface. A
 *   call refuses a name the agent was not offered, so a model asking for a
 *   withheld tool, or for a server its agent does not name, never reaches that
 *   server. It does NOT ask for approval: the runtime holds a
 *   `requiresApproval` call in the approval queue and runs it only once a
 *   human approved it.
 *
 * A question the server asks during a call (`elicitation/create`) is relayed
 * to the person chatting where one can answer a form, and the turn pauses on
 * it like on the agent's own `ask_user`; elsewhere it is answered `cancel`.
 *
 * The result is untrusted: the model reads it fenced as data
 * (`quoteUntrustedToolResult`), never as instructions.
 */

/** The external tools `agent` is offered. Servers not connected contribute none. */
export const listAgentMcpTools = (
  agent: AgentMcpScope
): Effect.Effect<readonly AgentMcpTool[], never, McpClient> =>
  Effect.gen(function* () {
    if ((agent.mcp?.servers ?? []).length === 0) return []
    const client = yield* McpClient
    return selectAgentMcpTools(agent, yield* client.tools)
  }).pipe(Effect.withSpan('agents.mcp.list-tools'))

/** The tool the model named, if `agent` is offered it; a typed refusal otherwise. */
const offeredTool = (
  agent: AgentMcpScope,
  modelName: string
): Effect.Effect<AgentMcpTool, McpToolCallError, McpClient> =>
  Effect.gen(function* () {
    const parsed = parseMcpModelToolName(modelName)
    const offered = yield* listAgentMcpTools(agent)
    const tool = offered.find((candidate) => candidate.modelName === modelName)
    if (parsed === undefined || tool === undefined) {
      return yield* new McpToolCallError({
        server: parsed?.server ?? '',
        tool: parsed?.tool ?? modelName,
        reason: 'unknown-tool',
        message: `the tool "${modelName}" is not available to this agent`,
      })
    }
    return tool
  })

/** What a server is told when its form cannot be shown to the person (JSON-RPC invalid params). */
const UNSHOWABLE_FORM =
  'The form cannot be shown: it must be a flat object of at most twelve string, number, integer or boolean fields.'

/**
 * How a server's question is answered on a turn: relayed to the person when
 * one can answer and its form passes the `ask_user` rule; refused `-32602`
 * when its form does not; answered `cancel` where nobody can answer.
 */
const serverQuestionPolicy =
  (canAsk: boolean): McpElicitationPolicy =>
  (request) => {
    if (!canAsk) return { action: 'cancel' }
    const parsed = parseAskUserArguments({
      message: request.message,
      requestedSchema: request.requestedSchema,
    })
    return parsed.kind === 'invalid'
      ? { error: { code: -32_602, message: UNSHOWABLE_FORM } }
      : 'relay'
  }

/** The person's answer as the server's elicitation result. */
const toReply = (answer: ElicitationAnswer): McpElicitationReply =>
  answer.action === 'accept'
    ? { action: 'accept', content: answer.content ?? {} }
    : { action: answer.action }

/** What the model reads for a finished external call. */
const readResult = (result: McpToolResult): OtherToolResult => ({
  content: quoteUntrustedToolResult(result),
  denied: false,
  failed: result.isError,
})

/** A call paused on a server's question: the question the person is shown, and its relay. */
const askedResult = (
  outcome: Extract<McpToolCallOutcome, { readonly kind: 'asked' }>
): OtherToolResult => {
  const parsed = parseAskUserArguments({
    message: outcome.question.message,
    requestedSchema: outcome.question.requestedSchema,
  })
  if (parsed.kind === 'invalid') {
    return { content: `Error: ${UNSHOWABLE_FORM}`, denied: false, failed: true }
  }
  return {
    content: `The MCP server "${outcome.question.server}" asked the person a question. Waiting for the answer.`,
    denied: false,
    elicitation: {
      id: `elc_${crypto.randomUUID()}`,
      ...parsed.question,
      server: outcome.question.server,
      relay: (answer) =>
        outcome.answer(toReply(answer)).pipe(
          Effect.match({
            onSuccess: quoteUntrustedToolResult,
            onFailure: (error) => `Error: ${error.message}.`,
          })
        ),
    },
  }
}

/** A turn's tools, with the agent's external MCP tools added. */
export interface AgentMcpTurnTools<R> {
  /** The definitions to advertise, after the turn's own. */
  readonly toolDefinitions: ReadonlyArray<ChatToolDefinition>
  readonly tools: AgentTurnTools<R | McpClient>
}

/**
 * What the model reads for one external call. A failure — a timeout, an
 * unreachable server, a refused name — is a tool message too, so the model can
 * say so and the turn still ends with an answer.
 */
const runExternalTool = (
  agent: AgentMcpScope,
  call: ChatToolCall,
  canAsk: boolean
): Effect.Effect<OtherToolResult, never, McpClient> =>
  Effect.gen(function* () {
    const tool = yield* offeredTool(agent, call.name)
    const client = yield* McpClient
    return yield* client.startToolCall(
      tool.server,
      tool.tool,
      call.arguments,
      serverQuestionPolicy(canAsk)
    )
  }).pipe(
    Effect.match({
      onSuccess: (outcome): OtherToolResult =>
        outcome.kind === 'result' ? readResult(outcome.result) : askedResult(outcome),
      onFailure: (error): OtherToolResult => ({
        content: `Error: ${error.message}.`,
        denied: error.reason === 'unknown-tool',
        failed: error.reason !== 'unknown-tool',
      }),
    }),
    Effect.withSpan('agents.mcp.run-external-tool', { attributes: { 'mcp.tool': call.name } })
  )

/**
 * Add `agent`'s external MCP tools to a turn: advertised as `<server>__<tool>`,
 * run through `runOther`, and — unless the server marked a tool read-only —
 * held for a human's approval first. `canAsk`: a person can answer a form on
 * this turn, so a server's question during a call is relayed to her and the
 * turn pauses on it; otherwise it is answered `cancel` at once. Any other call goes to the turn's own
 * `runOther`, unchanged. An agent naming no server gets the tools as they were.
 *
 * `toolDefinitions` leaves out a name the turn already advertises, so a turn
 * resumed with the definitions it paused with is not offered a tool twice.
 */
export const withAgentMcpTools = <R>(
  agent: AgentMcpScope | undefined,
  tools: AgentTurnTools<R>,
  advertised: ReadonlyArray<ChatToolDefinition> = [],
  canAsk = false
): Effect.Effect<AgentMcpTurnTools<R>, never, McpClient> =>
  Effect.gen(function* () {
    const offered = agent === undefined ? [] : yield* listAgentMcpTools(agent)
    if (agent === undefined || offered.length === 0) return { toolDefinitions: [], tools }
    const byName = new Map(offered.map((tool) => [tool.modelName, tool]))
    const taken = new Set(advertised.map((definition) => definition.function.name))
    const { runOther, requiresApproval } = tools
    return {
      toolDefinitions: offered
        .filter((tool) => !taken.has(tool.modelName))
        .map(toMcpChatToolDefinition),
      tools: {
        ...tools,
        runOther: (call: ChatToolCall) =>
          byName.has(call.name)
            ? runExternalTool(agent, call, canAsk)
            : runOther === undefined
              ? Effect.succeed({
                  content: `Error: unknown tool "${call.name}".`,
                  denied: false,
                  failed: true,
                })
              : runOther(call),
        requiresApproval: (call: ChatToolCall) =>
          byName.get(call.name)?.requiresApproval ?? requiresApproval?.(call) ?? false,
      },
    }
  }).pipe(Effect.withSpan('agents.mcp.turn-tools'))
