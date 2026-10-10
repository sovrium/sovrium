/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import type { AgentAction } from './browser-agent-tools'
import type {
  BrowserFailure,
  BrowserLocator,
  BrowserSend,
  BrowserSends,
  BrowserSession,
} from '@/application/ports/services/browser-driver'

/**
 * Performing a browser agent's actions and recording them.
 *
 * A credential is typed by the driver into a field it marks sensitive, so the
 * page shows it masked to the model from then on; the trace records `***` in
 * its place. Nothing here returns or records a credential value.
 */

/** What an action is performed with. `credentials` maps each name to its value. */
export interface ActionInput {
  readonly session: BrowserSession
  readonly credentials: Readonly<Record<string, string>>
  readonly stepTimeoutMs: number
}

/** One action the agent took, for the trace. Never holds a credential value. */
export interface AgentTraceEntry {
  readonly step: number
  readonly do: string
  readonly target?: BrowserLocator
  readonly value?: string
  readonly status: 'ok' | 'failed'
  readonly url?: string
  readonly error?: string
  /** Sends the page made on its own, or beacons, that the gate refused meanwhile (`POST <url>`). */
  readonly heldBack?: readonly string[]
}

/** How a send reads in a trace or an approval: its method and address, never its body. */
export const describeSend = (send: BrowserSend): string => `${send.method} ${send.url}`

/** What the agent has done so far. */
export interface AgentProgress {
  readonly steps: number
  readonly trace: readonly AgentTraceEntry[]
  readonly url?: string
}

/** Perform one gesture. Credential values are typed sensitive and never returned. */
const performAction = (
  input: ActionInput,
  action: AgentAction
): Effect.Effect<void, BrowserFailure> => {
  const { session, stepTimeoutMs: ms } = input
  switch (action.tool) {
    case 'browser_goto':
      return session.goto(action.url, ms)
    case 'browser_click':
      return session.click(action.target, ms)
    case 'browser_fill': {
      const { fill } = action
      const secret = 'credential' in fill
      const text = secret ? (input.credentials[fill.credential] ?? '') : fill.value
      return session.fill({ target: action.target, text, sensitive: secret, timeoutMs: ms })
    }
    case 'browser_select':
      return session.select(action.target, action.option, ms)
    case 'browser_check':
      return session.check(action.target, action.checked, ms)
    case 'browser_press':
      return session.press(action.key, action.target, ms)
    case 'browser_done':
      return Effect.void
  }
}

/** What an action typed or chose, for the trace: `***` for a credential. */
const shownValue = (action: AgentAction): string | undefined => {
  switch (action.tool) {
    case 'browser_fill':
      return 'credential' in action.fill ? '***' : action.fill.value
    case 'browser_select':
      return action.option
    case 'browser_press':
      return action.key
    case 'browser_goto':
      return action.url
    case 'browser_click':
    case 'browser_check':
    case 'browser_done':
      return undefined
  }
}

/** The trace entry of an action, its value shown unless it is a credential. */
const traceEntryOf = (
  step: number,
  action: AgentAction,
  outcome: {
    readonly url?: string
    readonly error?: string
    readonly heldBack?: readonly BrowserSend[]
  }
): AgentTraceEntry => {
  const target = 'target' in action ? action.target : undefined
  const value = shownValue(action)
  return {
    step,
    do: action.tool.replace('browser_', ''),
    ...(target === undefined ? {} : { target }),
    ...(value === undefined ? {} : { value }),
    status: outcome.error === undefined ? 'ok' : 'failed',
    ...(outcome.url === undefined ? {} : { url: outcome.url }),
    ...(outcome.error === undefined ? {} : { error: outcome.error }),
    ...(outcome.heldBack === undefined || outcome.heldBack.length === 0
      ? {}
      : { heldBack: outcome.heldBack.map(describeSend) }),
  }
}

/**
 * Perform one action and fold it into the progress; answers the result the
 * model reads, and what the submission gate did with the sends meanwhile.
 */
export const actAndRecord = Effect.fn('automations.browser-agent-act')(function* (
  input: ActionInput,
  progress: AgentProgress,
  action: AgentAction
) {
  const done = yield* Effect.result(performAction(input, action))
  const sends: BrowserSends = yield* input.session.takeSends
  const url = yield* input.session.currentUrl.pipe(
    // effect-swallow: a page that cannot say where it is keeps the last address known; the action's own outcome is what is reported.
    Effect.orElseSucceed(() => progress.url)
  )
  const error = done._tag === 'Failure' ? done.failure.message : undefined
  const entry = traceEntryOf(progress.steps + 1, action, {
    ...(url === undefined ? {} : { url }),
    ...(error === undefined ? {} : { error }),
    heldBack: sends.heldBack,
  })
  const next: AgentProgress = {
    steps: progress.steps + 1,
    trace: [...progress.trace, entry],
    ...(url === undefined ? {} : { url }),
  }
  return {
    progress: next,
    failedAction: error !== undefined,
    sends,
    content: error === undefined ? `done; the address is ${url ?? 'unknown'}` : `error: ${error}`,
  }
})
