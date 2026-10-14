/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A tool call the surface runs itself — anything that is not an agent action:
 * a chat turn's table lookups, its browser tool, an external MCP server's tool,
 * `load_skill`, `ask_user`. Its result says whether it ran, was refused or
 * failed — or asked the person a question, on which the turn then waits,
 * keeping what it goes on with once she answers. Plus the best-effort
 * bookkeeping every tool call shares.
 */

import { Effect } from 'effect'
import { recordAiActivity } from '@/application/use-cases/ai/record-ai-activity'
import { logError } from '@/infrastructure/logging/logger'
import type { AgentToolContext, AgentToolResult, OtherToolResult } from './agent-tool-call'
import type { AiActivityLogRepository } from '@/application/ports/repositories/ai/ai-activity-log-repository'
import type {
  ApprovalContinuation,
  PendingElicitation,
} from '@/application/ports/services/agent-approval-store'
import type { ChatToolCall } from '@/application/ports/services/ai-service'

/**
 * Best-effort bookkeeping: an activity row or a mirror write that fails is
 * logged and never fails the tool call it describes.
 */
export const bestEffort = <E, R>(effect: Effect.Effect<void, E, R>, what: string) =>
  effect.pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError(`[agent-runtime] ${what} failed`, cause)
      })
    ),
    // effect-swallow: bookkeeping about a tool call must not undo or fail the call itself; the failure is logged above.
    Effect.ignoreCause,
    Effect.withSpan('agents.bookkeeping', { attributes: { 'agent.bookkeeping': what } })
  )

/** The outcome of a tool the surface ran. A question asked waits for input. */
const otherToolOutcome = (result: OtherToolResult): AgentToolResult['outcome'] => {
  if (result.elicitation !== undefined) return 'pending-input'
  if (result.denied) return 'denied'
  return result.failed === true ? 'failed' : 'ok'
}

/**
 * The question a call asked, with what the turn goes on with once it is
 * answered — the conversation so far, and the surface and the person it was
 * asked on; nothing when the call asked none.
 */
const askedQuestion = (
  elicitation: PendingElicitation | undefined,
  continuation: Omit<ApprovalContinuation, 'surface'> | undefined,
  turn: Pick<ApprovalContinuation, 'surface' | 'caller'>
): { readonly elicitation?: PendingElicitation } =>
  elicitation === undefined
    ? {}
    : {
        elicitation:
          continuation === undefined
            ? elicitation
            : {
                ...elicitation,
                continuation: { ...continuation, surface: turn.surface, caller: turn.caller },
              },
      }

/** A tool that is not an agent action, run by the surface; a question it asks keeps `continuation`. */
export const runOtherTool = <R>(
  call: ChatToolCall,
  context: AgentToolContext<R>,
  continuation?: Omit<ApprovalContinuation, 'call' | 'surface'>
): Effect.Effect<AgentToolResult, never, R | AiActivityLogRepository> =>
  Effect.gen(function* () {
    const { runOther } = context.tools
    if (runOther === undefined) {
      return {
        id: call.id,
        name: call.name,
        outcome: 'failed',
        content: `Error: unknown tool "${call.name}".`,
      } satisfies AgentToolResult
    }
    const result = yield* Effect.uninterruptible(runOther(call))
    if (context.chatActor !== undefined) {
      yield* bestEffort(
        recordAiActivity({
          actorType: 'user',
          actorName: context.chatActor,
          action: 'ai.chat.tool',
          targetTable: result.table,
        }),
        'activity log'
      )
    }
    return {
      id: call.id,
      name: call.name,
      outcome: otherToolOutcome(result),
      content: result.content,
      table: result.table,
      ...askedQuestion(result.elicitation, continuation && { ...continuation, call }, context),
    } satisfies AgentToolResult
  }).pipe(Effect.withSpan('agents.run-surface-tool', { attributes: { 'agent.tool': call.name } }))
