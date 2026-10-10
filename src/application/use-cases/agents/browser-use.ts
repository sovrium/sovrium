/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import { BrowserDriver } from '@/application/ports/services/browser-driver'
import {
  hostOf,
  isAllowedHost,
} from '@/domain/models/app/automations/actions/browser/browser-host-service'
import { logError } from '@/infrastructure/logging/logger'
import { storedJar } from '../automations/action-handlers/browser'
import { runAgentLoop, type AgentEnd } from '../automations/action-handlers/browser-agent-loop'
import { outputTypesOf } from '../automations/action-handlers/browser-agent-park'
import type { BrowserSessionRepository } from '@/application/ports/repositories/automations/browser-session-repository'
import type { Agent } from '@/domain/models/app/agents/agent'

/**
 * The `browser.use` agent tool: a declared agent
 * granted `browser.use` and `tools.browser` drives a browser from a chat.
 *
 * Narrower than `browser/agent` on purpose:
 *
 * - **No secrets.** There are no credentials; pages behind a sign-in are
 *   reached only through a stored session listed in `tools.browser.sessions`,
 *   which is read, never saved back.
 * - **No sends.** A chat turn has no run to park, so nothing with a method other
 * than GET or HEAD leaves the browser: a send an action
 *   caused is refused at the network and the call ends with
 *   `submit_requires_approval`; one the page sends on its own, or a beacon, is
 *   refused and the call goes on. On WebKit, which cannot hold a request, the
 *   call is refused before a page opens (`browser_backend_refused`).
 * - **Refused before a browser opens**: a start address off
 *   `tools.browser.allowedHosts` (`host_not_allowed`) and a session outside
 *   `tools.browser.sessions` (`session_not_allowed`).
 *
 * The answer is the tool result the chat model reads: what the browser agent
 * reported, or the typed refusal. Never a page of its own: the inner agent's
 * pages reach only the inner model.
 */

/** The most actions one `browser_use` call may take. */
const MAX_STEPS = 20

type Args = Readonly<Record<string, unknown>>

const text = (args: Args, key: string): string | undefined =>
  typeof args[key] === 'string' && args[key] !== '' ? args[key] : undefined

/** Why the arguments are refused before a browser opens, or `undefined`. */
const argumentRefusal = (
  browser: NonNullable<NonNullable<Agent['tools']>['browser']>,
  args: Args
): string | undefined => {
  const startUrl = text(args, 'startUrl')
  if (text(args, 'goal') === undefined || startUrl === undefined) {
    return 'error: browser_use needs a "goal" and a "startUrl"'
  }
  if (!/^https?:\/\//i.test(startUrl) || !isAllowedHost(startUrl, browser.allowedHosts)) {
    return `host_not_allowed: ${startUrl} goes to ${hostOf(startUrl)}, which this agent may not reach (${browser.allowedHosts.join(', ')})`
  }
  const session = text(args, 'session')
  return session !== undefined && !(browser.sessions ?? []).includes(session)
    ? `session_not_allowed: the stored session "${session}" is not one this agent may use`
    : undefined
}

/** Why the call is refused before a browser opens, or `undefined`. */
const refusalOf = (agent: Agent, args: Args): string | undefined => {
  const browser = agent.tools?.browser
  return browser === undefined || agent.tools?.actions.includes('browser.use') !== true
    ? 'error: this agent is not granted browser.use'
    : argumentRefusal(browser, args)
}

/** The tool result of a finished browser agent. */
const answerOf = (end: AgentEnd): string =>
  end.kind === 'done'
    ? JSON.stringify({ summary: end.summary, result: end.result, url: end.progress.url })
    : end.kind === 'failed'
      ? end.error
      : 'error: the browser agent stopped'

/**
 * A browser for the call, gated to refuse every send, or
 * the text the chat model reads instead.
 */
const openBrowser = (agent: Agent, args: Args) =>
  Effect.gen(function* () {
    const driver = yield* BrowserDriver
    const session = text(args, 'session')
    const cookies = yield* storedJar(session)
    const opened = yield* Effect.result(
      driver.open({
        allowedHosts: agent.tools?.browser?.allowedHosts ?? [],
        sendGate: 'refuse',
        ...(cookies === undefined ? {} : { cookies }),
        ...(session === undefined ? {} : { sessionName: session }),
      })
    )
    if (opened._tag === 'Success') return { kind: 'open', browser: opened.success } as const
    // WebKit is refused by rule, and the reason names the fix: shown as it is.
    if (opened.failure.code === 'browser_backend_refused') {
      return { kind: 'refused', refused: opened.failure.message } as const
    }
    // The launch detail (paths, sandbox switches) is the operator's: logged, never
    // shown to whoever is chatting.
    yield* Effect.sync(() =>
      logError('[browser] browser_use could not open a browser', opened.failure, {
        agent: agent.name,
      })
    )
    return { kind: 'refused', refused: 'error: the browser could not be opened' } as const
  })

/**
 * Run one `browser_use` call for `agent`. Never fails: every outcome is the
 * text the chat model reads as the tool result.
 */
export const runBrowserUse = (
  agent: Agent,
  args: Args
): Effect.Effect<string, never, AiService | BrowserDriver | BrowserSessionRepository> =>
  Effect.gen(function* () {
    const refusal = refusalOf(agent, args)
    if (refusal !== undefined) return refusal
    const ai = yield* AiService
    if (!ai.isConfigured()) return 'agent_unavailable: no AI provider is configured'
    const driver = yield* BrowserDriver
    const opened = yield* openBrowser(agent, args)
    if (opened.kind === 'refused') return opened.refused
    const { browser } = opened
    const ms = driver.limits.stepTimeoutMs
    const startUrl = text(args, 'startUrl') ?? ''
    return yield* Effect.gen(function* () {
      const went = yield* Effect.result(browser.goto(startUrl, ms))
      if (went._tag === 'Failure') return `error: ${went.failure.message}`
      const end = yield* runAgentLoop(
        {
          session: browser,
          goal: text(args, 'goal') ?? '',
          credentials: {},
          output: outputTypesOf(args['output']),
          maxSteps: MAX_STEPS,
          submitPolicy: 'refuse',
          stepTimeoutMs: ms,
          ...(agent.model === undefined ? {} : { model: agent.model }),
        },
        { steps: 0, trace: [], url: startUrl }
      )
      return answerOf(end)
    }).pipe(Effect.ensuring(browser.close))
  }).pipe(Effect.withSpan('agents.browser-use', { attributes: { 'agent.name': agent.name } }))
