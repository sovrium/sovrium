/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Go on with a turn that asked the person a question (`ask_user`), once she
 * answered — as a stream, for the chat that forwards the turn as it happens.
 *
 * The answer is the question's tool result: the model reads it with the rest
 * of the conversation, and the turn goes on with the steps it had left, each
 * model call streamed, as the person the turn answered. Nothing else is
 * re-run: the calls the model made before its question already have their
 * results in the continuation.
 */

import { Stream } from 'effect'
import { answerUnanswered } from './agent-approval-resume'
import {
  runAgentTurn,
  type AgentTurnEvent,
  type AgentTurnRequirements,
  type AgentTurnSpec,
} from './agent-runtime'
import type { ApprovalContinuation } from '@/application/ports/services/agent-approval-store'
import type { AiError } from '@/application/ports/services/ai-service'

/** The `done` of a turn that had no model call left to make after its question. */
const lastStepDone: AgentTurnEvent = {
  type: 'done',
  model: '',
  finishReason: 'stop',
  reply: '',
  steps: 0,
}

/**
 * The rest of the turn a question paused: the model reads `answer` as the
 * result of its `ask_user` call, and goes on. `spec` is the paused turn's own —
 * its tools, its agent, its model settings — so the turn goes on as it started.
 */
export const resumeAnsweredTurn = <R>(input: {
  readonly continuation: ApprovalContinuation
  /** What the model reads as the question's result. */
  readonly answer: string
  readonly spec: AgentTurnSpec<R>
}): Stream.Stream<AgentTurnEvent, AiError, R | AgentTurnRequirements> => {
  const { continuation, spec } = input
  const { call, caller, messages, tools, remainingSteps } = continuation
  if (remainingSteps <= 0) return Stream.succeed(lastStepDone)
  return runAgentTurn({
    ...spec,
    caller,
    messages: [
      ...messages,
      ...answerUnanswered(messages, call.id),
      { role: 'tool', content: input.answer, toolCallId: call.id },
    ],
    toolDefinitions: tools,
    maxSteps: remainingSteps,
    stream: true,
  })
}
