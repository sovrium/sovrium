/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resume the agent turn an approval paused, once a human approved it.
 *
 * The held call runs — under the agent's identity, never the approver's, and
 * as the person the paused turn answered when it answered one —
 * through the same execution and activity log as any other call, its result is
 * handed to the model with the rest of the conversation, and the turn goes on
 * with the steps it had left. A turn whose continuation is gone (the server
 * restarted while it waited) runs nothing: an approval never runs a call the
 * server no longer holds.
 */

import { Effect, Option } from 'effect'
import { AgentApprovalStore } from '@/application/ports/services/agent-approval-store'
import { logError } from '@/infrastructure/logging/logger'
import { NOT_RUN_CONTENT, runAgentTurnToEnd, type AgentTurnRequirements } from './agent-runtime'
import { runApprovedToolCall, type AgentActionRunner } from './agent-tool-call'
import { withAgentMcpTools } from './mcp-agent-tools'
import type { AgentCaller } from '@/application/ports/services/agent-approval-store'
import type { ChatMessage } from '@/application/ports/services/ai-service'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/** Answer every call of the paused step the continuation holds no result for. */
export const answerUnanswered = (
  messages: ReadonlyArray<ChatMessage>,
  approvedId: string
): ReadonlyArray<ChatMessage> => {
  const answered = new Set(messages.flatMap((message) => message.toolCallId ?? []))
  const calls = messages.findLast((message) => message.role === 'assistant')?.toolCalls ?? []
  return calls
    .filter((call) => call.id !== approvedId && !answered.has(call.id))
    .map((call) => ({
      role: 'tool' as const,
      content: NOT_RUN_CONTENT,
      toolCallId: call.id,
    }))
}

/** Run the approved call of `approvalId` and finish the turn it paused. */
export const resumeApprovedTurn = <R>(input: {
  readonly approvalId: string
  readonly agent: Agent
  readonly app: App
  /** How an action runs, for the person the paused turn answered (none for a scheduled run). */
  readonly runActionFor: (caller: AgentCaller | undefined) => AgentActionRunner<R>
}): Effect.Effect<void, never, R | AgentTurnRequirements> =>
  Effect.gen(function* () {
    const store = yield* AgentApprovalStore
    const continuation = yield* store.takeContinuation(input.approvalId)
    if (Option.isNone(continuation)) return
    const { call, surface, caller, messages, tools, remainingSteps } = continuation.value
    // The approved call may be an external MCP tool, which `runOther` runs.
    const external = yield* withAgentMcpTools(input.agent, {
      runAction: input.runActionFor(caller),
    })
    const context = {
      surface,
      agent: input.agent,
      app: input.app,
      caller,
      tools: external.tools,
    }
    const result = yield* runApprovedToolCall(input.agent, call, context)
    yield* store.markExecuted(input.approvalId)
    if (remainingSteps <= 0) return
    yield* runAgentTurnToEnd({
      ...context,
      messages: [
        ...messages,
        ...answerUnanswered(messages, call.id),
        { role: 'tool', content: result.content, toolCallId: call.id },
      ],
      toolDefinitions: tools,
      maxSteps: remainingSteps,
      model: {
        model: input.agent.model,
        temperature: input.agent.temperature,
        maxTokens: input.agent.maxTokens,
      },
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[agent-runtime] resumed turn failed after its approved call ran', cause)
        })
      ),
      // effect-swallow: the approved call has run and been logged; a failure summarising it afterwards must not undo the approval.
      Effect.catchCause(() => Effect.void)
    )
  }).pipe(Effect.withSpan('agents.resume-approved-turn'))
