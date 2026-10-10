/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Clock, Effect } from 'effect'
import {
  BrowserDriver,
  type BrowserSend,
  type BrowserSession,
} from '@/application/ports/services/browser-driver'
import { insertApprovalRequest } from './approval'
import { describeSend } from './browser-agent-actions'
import { abandon } from './browser-confirm'
import type { AgentProgress, AgentTraceEntry } from './browser-agent-loop'
import type { OutputType } from './browser-agent-tools'
import type { ScreenshotRef } from './browser-run-scope'
import type { ActionRunContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { ChatToolCall } from '@/application/ports/services/ai-service'

/**
 * A browser agent's submission waiting for a person.
 *
 * The gesture already happened: the requests it sent are held UNANSWERED in
 * the LIVE browser, which is kept for at most `BROWSER_HOLD_MAX_MS`. The run
 * parks with a picture of the page (still showing what was filled) and names
 * each held request by method and address — never its body, which may hold
 * the very values the person is approving. Approved, the run re-enters the
 * agent step, takes the held browser back and releases each request once, in
 * order; the page receives its own answer and the agent carries on. Rejected,
 * or unanswered in time, the browser is closed with the requests failed, and
 * the site receives nothing (`submission_rejected`).
 *
 * The step output a parked run keeps is what the resumed step starts from:
 * the gesture's call, the held requests, the actions taken, the pictures.
 * Never a page outline and never a credential value.
 */

/** What a parked agent keeps in its step output. */
export interface ParkedAgent {
  /** The gesture whose requests are held, as the model made it: the resumed turn answers it. */
  readonly pendingCall: ChatToolCall
  /** The requests held in the browser, by method and address. */
  readonly held: readonly BrowserSend[]
  readonly progress: AgentProgress
  readonly screenshots: readonly ScreenshotRef[]
}

/** The refusal a submission nobody approved ends with. */
export const unansweredSubmission = (holdMs: number): string =>
  `submission_rejected: nobody approved the submission within ${String(holdMs)} ms, so the browser was closed and nothing was sent`

/** Park the run on the approval road, the browser held on the filled form. */
export const parkSubmission = (input: {
  readonly runId: string
  readonly runContext: ActionRunContext | undefined
  readonly session: BrowserSession
  readonly goal: string
  readonly held: readonly BrowserSend[]
}): Effect.Effect<{ readonly holdMs: number }, never, StepRequirements> =>
  Effect.gen(function* () {
    const driver = yield* BrowserDriver
    const holdMs = driver.limits.holdMaxMs
    const now = yield* Clock.currentTimeMillis
    yield* insertApprovalRequest({
      message: `The browser agent is about to send ${input.held.map(describeSend).join(', ')}, for the goal: ${input.goal}`,
      timeoutSeconds: Math.ceil(holdMs / 1000),
      expiresAt: new Date(now + holdMs),
      runId: input.runId,
      stepIndex: input.runContext?.stepIndex ?? 0,
      approvers: undefined,
    })
    yield* driver.hold({
      runId: input.runId,
      session: input.session,
      holdMs,
      onExpire: abandon(input.runId, holdMs, unansweredSubmission(holdMs)),
    })
    return { holdMs }
  }).pipe(Effect.withSpan('automations.browser-agent-park'))

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {}

/** What a resumed agent starts from, or `undefined` when the step is not resuming. */
export const parkedAgentOf = (
  runContext: ActionRunContext | undefined
): ParkedAgent | undefined => {
  const prior = recordOf(runContext?.resume?.prior.output)
  const pending = recordOf(prior['pendingCall'])
  if (typeof pending['name'] !== 'string') return undefined
  // Kept as `METHOD address` lines: a stored object would not keep its keys in order.
  const held = Array.isArray(prior['held'])
    ? (prior['held'] as readonly unknown[]).flatMap((line) => {
        const match = typeof line === 'string' ? /^(\S+) (.+)$/.exec(line) : null
        return match === null ? [] : [{ method: match[1] ?? '', url: match[2] ?? '' }]
      })
    : []
  const trace = Array.isArray(prior['trace']) ? (prior['trace'] as readonly AgentTraceEntry[]) : []
  return {
    pendingCall: {
      id: typeof pending['id'] === 'string' ? pending['id'] : 'pending',
      name: pending['name'],
      arguments: { ...recordOf(pending['arguments']) },
    },
    held,
    progress: {
      steps: typeof prior['steps'] === 'number' ? prior['steps'] : trace.length,
      trace,
      ...(typeof prior['url'] === 'string' ? { url: prior['url'] } : {}),
    },
    screenshots: Array.isArray(prior['screenshots'])
      ? (prior['screenshots'] as readonly ScreenshotRef[])
      : [],
  }
}

/** The output types an agent's `output` declares. */
export const outputTypesOf = (value: unknown): Readonly<Record<string, OutputType>> | undefined => {
  const record = recordOf(value)
  const entries = Object.entries(record).filter(
    (entry): entry is [string, OutputType] =>
      entry[1] === 'string' || entry[1] === 'number' || entry[1] === 'boolean'
  )
  return entries.length === 0 ? undefined : Object.fromEntries(entries)
}
