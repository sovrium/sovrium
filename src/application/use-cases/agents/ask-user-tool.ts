/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The built-in `ask_user` tool as a turn uses it ([internal ref] D3).
 *
 * {@link withAskUser} is what the agent runtime does to every turn. The tool is
 * offered only where a person can answer: a CHAT turn of a declared agent,
 * started by someone signed in. An automation's `ai:agent` step and a
 * scheduled run have nobody to ask, and are never offered it; nor is a visitor
 * signed in to nothing, whom no answer could be checked against.
 *
 * A call with a flat form asks the question: its result carries the question
 * (`elicitation`), and the runtime pauses the turn on it, as on a call held
 * for approval. The streamed chat then emits `elicit` and ends waiting for
 * input, and the answer goes on with the turn. A nested form is refused,
 * worded for the model, and the turn goes on. On the buffered chat, which can
 * draw no form, the model is told to ask in prose.
 */

import { Effect } from 'effect'
import {
  ASK_USER_TOOL_NAME,
  askUserToolDefinition,
  parseAskUserArguments,
} from '@/domain/models/app/agents/ask-user-service'
import type { AgentTurnTools, OtherToolResult } from './agent-tool-call'
import type { AgentSurface } from '@/application/ports/services/agent-approval-store'
import type { ChatToolCall, ChatToolDefinition } from '@/application/ports/services/ai-service'

/** The parts of a turn that decide whether its agent may ask. */
export interface AskUserScope {
  readonly surface: AgentSurface
  readonly agent?: { readonly name: string } | undefined
  /** The account that started the turn; absent for a visitor signed in to nothing. */
  readonly requestedById?: string | undefined
  /** Whether the turn is streamed, the one transport that can draw the form. */
  readonly stream?: boolean | undefined
  /** What the turn already advertises — a resumed turn already carries `ask_user`. */
  readonly toolDefinitions: ReadonlyArray<ChatToolDefinition>
}

/** A turn's tools, with `ask_user` added where it is offered. */
export interface AskUserTurnTools<R> {
  /** The definitions to advertise, after the turn's own. */
  readonly toolDefinitions: ReadonlyArray<ChatToolDefinition>
  readonly tools: AgentTurnTools<R>
}

/** Whether a person is there to answer the agent's question. */
const offersAskUser = (scope: AskUserScope): boolean =>
  scope.surface === 'chat' && scope.agent !== undefined && scope.requestedById !== undefined

/**
 * Whether a form can be put to that person on this turn: she is there, and the
 * turn is streamed. An external MCP server's question is relayed only here.
 */
export const canShowAForm = (scope: Omit<AskUserScope, 'toolDefinitions'>): boolean =>
  offersAskUser({ ...scope, toolDefinitions: [] }) && scope.stream === true

/** What one `ask_user` call does: ask the question, or tell the model why it cannot. */
const runAskUser = (call: ChatToolCall, streamed: boolean): OtherToolResult => {
  if (!streamed) {
    return {
      content: 'Error: this conversation cannot show a form. Ask your question in prose instead.',
      denied: false,
      failed: true,
    }
  }
  const parsed = parseAskUserArguments(call.arguments)
  if (parsed.kind === 'invalid') {
    return { content: `Error: ${parsed.message}`, denied: false, failed: true }
  }
  return {
    content: 'The question is shown to the person. Waiting for the answer.',
    denied: false,
    elicitation: { id: `elc_${crypto.randomUUID()}`, ...parsed.question },
  }
}

/**
 * Add `ask_user` to a turn where a person can answer: advertised once, and run
 * through `runOther`. Any other call goes to the turn's own `runOther`.
 */
export const withAskUser = <R>(
  scope: AskUserScope,
  tools: AgentTurnTools<R>
): Effect.Effect<AskUserTurnTools<R>> =>
  Effect.sync((): AskUserTurnTools<R> => {
    if (!offersAskUser(scope)) return { toolDefinitions: [], tools }
    const advertised = scope.toolDefinitions.some(
      (definition) => definition.function.name === ASK_USER_TOOL_NAME
    )
    const { runOther } = tools
    return {
      toolDefinitions: advertised ? [] : [askUserToolDefinition()],
      tools: {
        ...tools,
        runOther: (call: ChatToolCall) =>
          call.name === ASK_USER_TOOL_NAME
            ? Effect.succeed(runAskUser(call, scope.stream === true))
            : runOther === undefined
              ? Effect.succeed({
                  content: `Error: unknown tool "${call.name}".`,
                  denied: false,
                  failed: true,
                })
              : runOther(call),
      },
    }
  }).pipe(Effect.withSpan('agents.ask-user.turn-tools'))
