/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Go on with a turn an approval paused, as a stream, once the person it
 * answered decided — for a surface that forwards the turn as it happens.
 *
 * Approved, the held call runs exactly as `resumeApprovedTurn` runs it: under
 * the agent's gates, as the person the turn answered, through the same activity
 * log. Denied, nothing runs and the model is told so in the call's result. In
 * both cases the stream opens with that result, then the turn goes on with the
 * steps it had left, each model call streamed. A turn whose continuation is
 * gone (the server restarted while it waited) streams nothing.
 */

import { Effect, Option, Stream } from 'effect'
import { AgentApprovalStore } from '@/application/ports/services/agent-approval-store'
import { answerUnanswered } from './agent-approval-resume'
import {
  runAgentTurn,
  type AgentTurnEvent,
  type AgentTurnRequirements,
  type AgentTurnSpec,
} from './agent-runtime'
import { runAgentAction, type AgentToolResult } from './agent-tool-call'
import type { AiError, ChatToolCall } from '@/application/ports/services/ai-service'

/** What the person the turn answered decided about its held call. */
export type HeldCallDecision = 'approve' | 'reject'

/** What the model reads for a call its person refused. */
export const DENIED_CALL_TEXT =
  'The person you are answering denied this action, so it did not run. Do not try it again unless they ask.'

const deniedResult = (call: ChatToolCall): AgentToolResult => ({
  id: call.id,
  name: call.name,
  outcome: 'denied',
  content: DENIED_CALL_TEXT,
})

/** The `done` of a turn that had no model call left to make after its held call. */
const lastStepDone: AgentTurnEvent = {
  type: 'done',
  model: '',
  finishReason: 'stop',
  reply: '',
  steps: 0,
}

/**
 * The rest of the turn `approvalId` paused: the held call's result, then the
 * turn's remaining steps. `spec` is the paused turn's own — its tools, its
 * agent, its model settings — so the turn goes on as it started.
 */
export const resumeDecidedTurn = <R>(input: {
  readonly approvalId: string
  readonly decision: HeldCallDecision
  readonly spec: AgentTurnSpec<R>
}): Stream.Stream<AgentTurnEvent, AiError, R | AgentTurnRequirements> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const { spec, approvalId } = input
      const store = yield* AgentApprovalStore
      const continuation = yield* store.takeContinuation(approvalId)
      if (Option.isNone(continuation) || spec.agent === undefined) return Stream.empty
      const { call, caller, messages, tools, remainingSteps } = continuation.value
      const result =
        input.decision === 'approve'
          ? yield* runAgentAction(spec.agent, call, { ...spec, caller }).pipe(
              Effect.tap(() => store.markExecuted(approvalId))
            )
          : deniedResult(call)
      const answered: AgentTurnEvent = { type: 'tool_result', ...result }
      if (remainingSteps <= 0) return Stream.make(answered, lastStepDone)
      const rest = runAgentTurn({
        ...spec,
        caller,
        messages: [
          ...messages,
          ...answerUnanswered(messages, call.id),
          { role: 'tool', content: result.content, toolCallId: call.id },
        ],
        toolDefinitions: tools,
        maxSteps: remainingSteps,
        stream: true,
      })
      return Stream.concat(Stream.succeed(answered), rest)
    })
  )
