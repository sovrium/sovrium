/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `browser/agent` action handler — a model drives the browser towards a goal,
 * inside limits the driver holds.
 *
 * One run, in order:
 *
 * 1. **Model.** No AI provider at all fails the step with `agent_unavailable`
 *    before a browser opens.
 * 2. **Session.** The start address must be on `allowedHosts`; a browser is
 *    opened (from the stored `session` when one is named) on it.
 * 3. **Loop.** `browser-agent-loop.ts`: observe → act → observe, at most
 *    `maxSteps` actions, under the run's time limit.
 * 4. **Submission.** A gesture whose request sends data (any method but GET or
 * HEAD, [internal ref]) is held unanswered in the browser and parks the
 *    run (`browser-agent-park.ts`) unless `approveSubmit: false`; approved, the
 *    run re-enters here, takes the held browser back and releases the held
 *    requests once each — never replays them — and the agent carries on.
 * 5. **End.** Done: the session is saved and the output carries `summary`,
 *    the checked `result`, the address and the trace. Failed: a screenshot
 *    (unless off), nothing saved. The browser is closed either way, unless held.
 */

import { Effect, Exit, Ref } from 'effect'
import { AiService } from '@/application/ports/services/ai-service'
import {
  BrowserDriver,
  type BrowserSendGate,
  type BrowserSession,
} from '@/application/ports/services/browser-driver'
import {
  hostOf,
  isAllowedHost,
} from '@/domain/models/app/automations/actions/browser/browser-host-service'
import { saveJar, storedJar } from './browser'
import { describeSend, type AgentProgress } from './browser-agent-actions'
import { resumeAgentLoop, runAgentLoop, type AgentEnd } from './browser-agent-loop'
import {
  parkedAgentOf,
  parkSubmission,
  outputTypesOf,
  type ParkedAgent,
} from './browser-agent-park'
import {
  browserRunOptionsOf,
  pageShot,
  shotStore,
  type BrowserRunOptions,
} from './browser-run-support'
import { fillValue } from './browser-step-values'
import { actionAttributes } from './shared'
import type { ScreenshotRef } from './browser-run-scope'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { StepRequirements } from '../run/types'
import type { ChatToolCall } from '@/application/ports/services/ai-service'

type Props = Readonly<Record<string, unknown>>

const recordOf = (value: unknown): Props =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Props) : {}

const failed = (error: string, output?: Props): ActionOutcome => ({
  status: 'failure',
  error,
  // An agent's actions are not replayed blindly: a failure is answered by a
  // person or a new run, never by the automation's retry.
  retryable: false,
  ...(output === undefined ? {} : { output }),
})

/** What the agent was asked, read from its props. */
interface AgentOptions {
  readonly goal: string
  readonly startUrl: string
  readonly maxSteps: number
  readonly approveSubmit: boolean
  readonly credentials: Readonly<Record<string, string>>
  readonly output: ReturnType<typeof outputTypesOf>
}

const agentOptionsOf = (action: Props): AgentOptions => {
  const props = recordOf(action['props'])
  const credentials = recordOf(props['credentials'])
  return {
    goal: typeof props['goal'] === 'string' ? props['goal'] : '',
    startUrl: typeof props['startUrl'] === 'string' ? props['startUrl'] : '',
    maxSteps: typeof props['maxSteps'] === 'number' ? props['maxSteps'] : 20,
    approveSubmit: props['approveSubmit'] !== false,
    credentials: Object.fromEntries(
      Object.entries(credentials).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    ),
    output: outputTypesOf(props['output']),
  }
}

/** Every credential's value, filled in from `$env` (or a one-time code) now, inside the run. */
const credentialValues = (
  options: AgentOptions,
  runContext: ActionRunContext | undefined,
  stepName: string
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(options.credentials).map(([name, written]) => [
      name,
      fillValue({ runContext, stepName, extracted: {} }, written),
    ])
  )

/** The step output: what later steps read as `{{steps.<name>.*}}`. Never a credential value. */
const outputOf = (
  progress: AgentProgress,
  shots: readonly ScreenshotRef[],
  extra: Props = {}
): Props => ({
  ...(progress.url === undefined ? {} : { url: progress.url }),
  steps: progress.steps,
  trace: progress.trace,
  ...(shots.length === 0 ? {} : { screenshots: shots }),
  ...extra,
})

/** What one run plays with. */
interface AgentRun {
  readonly session: BrowserSession
  readonly options: AgentOptions
  readonly base: BrowserRunOptions
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
  readonly storeShot: ReturnType<typeof shotStore>
  readonly shots: readonly ScreenshotRef[]
  readonly stepTimeoutMs: number
  readonly runMs: number
}

/** A picture of the page, stored; none when it could not be taken or stored. */
const shoot = (run: AgentRun, name: string) =>
  Effect.gen(function* () {
    const bytes = yield* pageShot(run.session)
    if (bytes._tag === 'None') return []
    const shot = yield* run.storeShot(bytes.value, name)
    return shot === undefined ? [] : [shot]
  })

/** Settle how the loop ended: done, failed, or parked on a submission. */
const finish = (
  run: AgentRun,
  end: AgentEnd
): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    if (end.kind === 'done') {
      yield* saveJar(run.base.session, run.session)
      yield* run.session.close
      return {
        status: 'success',
        output: outputOf(end.progress, run.shots, { summary: end.summary, result: end.result }),
      } satisfies ActionOutcome
    }
    if (end.kind === 'failed') {
      const shot = run.base.screenshots === 'off' ? [] : yield* shoot(run, 'failure')
      yield* run.session.close
      return failed(end.error, outputOf(end.progress, [...run.shots, ...shot]))
    }
    const shot = yield* shoot(run, 'confirm')
    const shots = [...run.shots, ...shot]
    const { runId } = run.automation
    if (runId === undefined) {
      yield* run.session.close
      return failed(
        'submission_rejected: the run was not recorded, so it cannot wait for a person to approve the submission; nothing was sent',
        outputOf(end.progress, shots)
      )
    }
    const parked = yield* parkSubmission({
      runId,
      runContext: run.runContext,
      session: run.session,
      goal: run.options.goal,
      held: end.held,
    })
    return {
      status: 'success',
      pause: true,
      output: outputOf(end.progress, shots, {
        status: 'waiting-approval',
        held: end.held.map(describeSend),
        pendingCall: end.call,
        holdMs: parked.holdMs,
      }),
    } satisfies ActionOutcome
  })

/** The loop's input for this run. */
const loopInput = (run: AgentRun) => ({
  session: run.session,
  goal: run.options.goal,
  credentials: credentialValues(run.options, run.runContext, run.base.stepName),
  output: run.options.output,
  maxSteps: run.options.maxSteps,
  submitPolicy: sendGateOf(run.options),
  stepTimeoutMs: run.stepTimeoutMs,
})

/** The session's submission gate: held for a person, unless `approveSubmit: false`. */
const sendGateOf = (options: AgentOptions): BrowserSendGate =>
  options.approveSubmit ? 'approve' : 'allow'

/** Run the loop (or `resumed`, the loop carrying on after a release) under the run's time limit. */
const play = (
  run: AgentRun,
  progress: AgentProgress,
  resumed?: { readonly call: ChatToolCall; readonly result: string }
) =>
  (resumed === undefined
    ? runAgentLoop(loopInput(run), progress)
    : resumeAgentLoop(loopInput(run), progress, resumed.call, resumed.result)
  ).pipe(
    Effect.timeoutOrElse({
      duration: run.runMs,
      orElse: () =>
        Effect.succeed<AgentEnd>({
          kind: 'failed',
          code: 'step_failed',
          error: `the agent took longer than its ${String(run.runMs)} ms limit (timeouts.runMs), so the browser was closed`,
          progress,
        }),
    })
  )

/** Open a browser on the start address, or answer why it cannot be. */
const openOnStart = (base: BrowserRunOptions, options: AgentOptions, stepTimeoutMs: number) =>
  Effect.gen(function* () {
    if (!isAllowedHost(options.startUrl, base.allowedHosts)) {
      return {
        refused: `host_not_allowed: the start address ${options.startUrl} goes to ${hostOf(options.startUrl)}, which is not in allowedHosts (${base.allowedHosts.join(', ')})`,
      } as const
    }
    const driver = yield* BrowserDriver
    const cookies = yield* storedJar(base.session)
    const opened = yield* Effect.result(
      driver.open({
        allowedHosts: base.allowedHosts,
        sendGate: sendGateOf(options),
        ...(cookies === undefined ? {} : { cookies }),
        ...(base.session === undefined ? {} : { sessionName: base.session }),
      })
    )
    if (opened._tag === 'Failure') return { refused: opened.failure.message } as const
    const session = opened.success
    const went = yield* Effect.result(session.goto(options.startUrl, stepTimeoutMs))
    if (went._tag === 'Failure') {
      yield* session.close
      return { refused: went.failure.message } as const
    }
    return { session, refused: undefined } as const
  })

/** Close the browser when the run ends any way other than a settled outcome. */
const closingOnDefect = <A, E, R>(session: BrowserSession, program: Effect.Effect<A, E, R>) =>
  program.pipe(Effect.onExit((exit) => (Exit.isSuccess(exit) ? Effect.void : session.close)))

/**
 * Release what the browser holds, then let the agent carry on — or park
 * again when the page sends more before the release settled.
 */
const releaseAndCarryOn = (resumed: AgentRun, parked: ParkedAgent) =>
  Effect.gen(function* () {
    const held = resumed.session
    const released = yield* Effect.result(held.releaseSends(resumed.stepTimeoutMs))
    if (released._tag === 'Failure') {
      return yield* finish(resumed, {
        kind: 'failed',
        code: 'step_failed',
        error: released.failure.message,
        progress: parked.progress,
      })
    }
    const sends = yield* held.takeSends
    // What the page sends after the release is not what the person approved: it waits again.
    if (sends.held.length > 0) {
      return yield* finish(resumed, {
        kind: 'submit',
        call: parked.pendingCall,
        held: sends.held,
        progress: parked.progress,
      })
    }
    const url = yield* held.currentUrl.pipe(
      // effect-swallow: a page that cannot say where it is keeps the last address known; the release itself went through.
      Effect.orElseSucceed(() => parked.progress.url)
    )
    const result = `done: a person approved, and the held request(s) were sent (${parked.held.map(describeSend).join(', ')}); the address is ${url ?? 'unknown'}`
    const progress = { ...parked.progress, ...(url === undefined ? {} : { url }) }
    return yield* finish(
      resumed,
      yield* play(resumed, progress, { call: parked.pendingCall, result })
    )
  })

/** An approved submission: take the held browser back, release what it holds, carry on. */
const resumeParked = (run: Omit<AgentRun, 'session'>, parked: ParkedAgent) =>
  Effect.gen(function* () {
    const driver = yield* BrowserDriver
    const { runId } = run.automation
    const held = runId === undefined ? undefined : yield* driver.takeHeld(runId)
    if (held === undefined) {
      return failed(
        'submission_rejected: the browser held open for the approval is gone (its hold ran out, or the server restarted), so nothing was sent'
      )
    }
    return yield* closingOnDefect(held, releaseAndCarryOn({ ...run, session: held }, parked))
  })

/** A new run: a model to ask, a browser on the start address, the loop. */
const startFresh = (run: Omit<AgentRun, 'session'>) =>
  Effect.gen(function* () {
    const ai = yield* AiService
    if (!ai.isConfigured()) {
      return failed(
        'agent_unavailable: no AI provider is configured (AI_PROVIDER), so no model can drive the browser'
      )
    }
    const opened = yield* openOnStart(run.base, run.options, run.stepTimeoutMs)
    if (opened.refused !== undefined) return failed(opened.refused)
    const fresh: AgentRun = { ...run, session: opened.session }
    const start: AgentProgress = { steps: 0, trace: [], url: run.options.startUrl }
    return yield* closingOnDefect(
      opened.session,
      Effect.gen(function* () {
        return yield* finish(fresh, yield* play(fresh, start))
      })
    )
  })

/** `browser/agent` — let a model drive a browser towards a goal. */
export const handleBrowserAgent: ActionHandler = (action, _app, automation, runContext) =>
  Effect.gen(function* () {
    const base = browserRunOptionsOf(action)
    const driver = yield* BrowserDriver
    const parked = parkedAgentOf(runContext)
    const runId = automation.runId ?? globalThis.crypto.randomUUID()
    const counter = yield* Ref.make((parked?.screenshots.length ?? 0) + 1)
    const run: Omit<AgentRun, 'session'> = {
      options: agentOptionsOf(action),
      base,
      automation,
      runContext,
      storeShot: shotStore({ runId, bucket: base.bucket, automation, counter }),
      shots: parked?.screenshots ?? [],
      stepTimeoutMs: base.stepMs ?? driver.limits.stepTimeoutMs,
      runMs: base.runMs ?? driver.limits.runTimeoutMs,
    }
    return yield* parked === undefined ? startFresh(run) : resumeParked(run, parked)
  }).pipe(
    Effect.withSpan('automations.handle-browser-agent', { attributes: actionAttributes(action) })
  )
