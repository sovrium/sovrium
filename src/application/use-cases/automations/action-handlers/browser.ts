/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `browser/run` action handler — drive a real browser through fixed steps on a
 * site that has no API.
 *
 * One run, in order:
 *
 * 1. **Idempotency.** With `idempotencyKey`, a key that already went through
 *    skips the run and answers the reference stored the first time; a key whose
 *    earlier run stopped after its irreversible click without confirming it
 *    answers `outcome_unknown`, for a person to check — never a replay.
 * 2. **Session.** A browser session is opened (one at a time on Chrome),
 *    starting from the stored `session` when one is named.
 * 3. **Steps.** Played one at a time (`browser-steps.ts`), each value filled
 *    in when its step is reached, under the run's time limit.
 * 4. **Irreversible click.** The key turns `pending` just before it; a failure
 *    from then on is `outcome_unknown` and is never retried. A `confirm` parks
 *    the run with the browser held on the filled form (`browser-confirm.ts`);
 *    approved, the run resumes here, in the same browser.
 * 5. **End.** A run that succeeded saves its session and marks its key `done`
 *    with the reference; a run that failed keeps a screenshot and saves
 *    nothing. The browser is closed either way, unless it is held.
 */

import { Effect, Exit, Option, Ref } from 'effect'
import { BrowserSessionRepository } from '@/application/ports/repositories/automations/browser-session-repository'
import { BrowserDriver, type BrowserSession } from '@/application/ports/services/browser-driver'
import { logError } from '@/infrastructure/logging/logger'
import { parkForConfirmation } from './browser-confirm'
import { EMPTY_PROGRESS, type BrowserRunScope, type StepsResult } from './browser-run-scope'
import {
  browserRunOptionsOf,
  browserRunOutputOf,
  idempotencyStateKey,
  pageShot,
  readIdempotencyKey,
  resumedFrom,
  shotStore,
  writeIdempotencyKey,
  type BrowserRunOptions,
} from './browser-run-support'
import { healPolicyOf } from './browser-self-heal'
import { runSteps } from './browser-steps'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

/** Failures that answer the same way on every try. */
const NEVER_RETRIED: ReadonlySet<string> = new Set([
  'browser_unavailable',
  'browser_closed',
  'host_not_allowed',
  'frame_cross_origin',
  'navigation_not_document',
  'upload_too_large',
])

const failed = (
  error: string,
  retryable?: boolean,
  output?: Readonly<Record<string, unknown>>
): ActionOutcome => ({
  status: 'failure',
  error,
  ...(retryable === undefined ? {} : { retryable }),
  ...(output === undefined ? {} : { output }),
})

/** The stored jar of a named session; a store that cannot answer starts the run signed out. */
export const storedJar = Effect.fn('automations.browser-load-session')(function* (
  name: string | undefined
) {
  if (name === undefined) return undefined
  const repo = yield* BrowserSessionRepository
  const jar = yield* repo.load(name).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[browser] the stored session could not be read', cause))
    ),
    // effect-swallow: logged above; the run starts signed out, as with no stored session, and signs in with its own steps.
    Effect.option
  )
  return Option.getOrUndefined(jar)
})

/** Save the jar of a run that succeeded. Never fails the run. */
export const saveJar = Effect.fn('automations.browser-save-session')(
  function* (name: string | undefined, session: BrowserSession) {
    if (name === undefined) return
    const jar = yield* session.exportCookies
    if (jar === undefined) return
    const repo = yield* BrowserSessionRepository
    yield* repo.save(name, jar)
  },
  (saved) =>
    saved.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[browser] the session could not be saved', cause))
      ),
      // effect-swallow: logged above; the run itself succeeded, and the next one signs in again.
      Effect.ignoreCause
    )
)

/** What a key already says, as the run's answer — or `undefined` to go on. */
const answerForKey = (
  automation: AutomationContext,
  options: BrowserRunOptions,
  stateKey: string | undefined
) =>
  Effect.gen(function* () {
    if (stateKey === undefined) return undefined
    const known = yield* readIdempotencyKey(automation.id, stateKey)
    if (known === undefined) return undefined
    if (known.state === 'done') {
      return {
        status: 'success',
        output: {
          skipped: 'already-submitted',
          ...(known.reference === undefined ? {} : { reference: known.reference }),
        },
      } satisfies ActionOutcome
    }
    return failed(
      `outcome_unknown: an earlier run with the idempotency key "${options.idempotencyKey ?? ''}" stopped after its irreversible click without confirming it went through. Check on the site whether it did; this run submits nothing.`,
      false
    )
  })

/** The session the run plays in: the one held for its confirmation, or a new one. */
const sessionFor = (options: BrowserRunOptions, automation: AutomationContext, resuming: boolean) =>
  Effect.gen(function* () {
    const driver = yield* BrowserDriver
    if (resuming && automation.runId !== undefined) {
      const held = yield* driver.takeHeld(automation.runId)
      return held === undefined
        ? ({
            kind: 'refused',
            refusal:
              'the browser held open for the confirmation is gone (its hold ran out, or the server restarted), so nothing was submitted',
            code: 'browser_closed',
          } as const)
        : ({ kind: 'open', session: held } as const)
    }
    const cookies = yield* storedJar(options.session)
    const opened = yield* Effect.result(
      driver.open({
        allowedHosts: options.allowedHosts,
        ...(cookies === undefined ? {} : { cookies }),
        ...(options.session === undefined ? {} : { sessionName: options.session }),
      })
    )
    return opened._tag === 'Success'
      ? ({ kind: 'open', session: opened.success } as const)
      : ({ kind: 'refused', refusal: opened.failure.message, code: opened.failure.code } as const)
  })

/** End a failed run: a screenshot (unless off), the browser closed, the reason. */
const finishFailed = (
  scope: BrowserRunScope,
  result: Extract<StepsResult, { readonly kind: 'failed' }>
) =>
  Effect.gen(function* () {
    const bytes = scope.screenshots === 'off' ? undefined : yield* pageShot(scope.session)
    const shot =
      bytes === undefined || bytes._tag === 'None'
        ? undefined
        : yield* scope.storeShot(bytes.value, 'failure')
    yield* scope.session.close
    const progress = {
      ...result.progress,
      screenshots: [...result.progress.screenshots, ...(shot === undefined ? [] : [shot])],
    }
    const where = shot === undefined ? '' : ` (screenshot: ${shot.key})`
    const output = browserRunOutputOf(progress)
    if (progress.submitted) {
      return failed(
        `outcome_unknown: the irreversible click was made, but the run could not confirm it went through — ${result.error}${where}`,
        false,
        output
      )
    }
    return failed(`${result.error}${where}`, !NEVER_RETRIED.has(result.code), output)
  })

/** End a run that played every step: its key done, its session saved, the browser closed. */
const finishDone = (
  scope: BrowserRunScope,
  options: BrowserRunOptions,
  progress: StepsResult['progress'],
  stateKey: string | undefined
) =>
  Effect.gen(function* () {
    if (stateKey !== undefined && progress.submitted) {
      yield* writeIdempotencyKey(scope.automation.id, stateKey, {
        state: 'done',
        ...(progress.reference === undefined ? {} : { reference: progress.reference }),
      })
    }
    yield* saveJar(options.session, scope.session)
    yield* scope.session.close
    return { status: 'success', output: browserRunOutputOf(progress) } satisfies ActionOutcome
  })

/** Park before a confirmation: the browser stays open, the run waits for a person. */
const finishParked = (
  scope: BrowserRunScope,
  result: Extract<StepsResult, { readonly kind: 'confirm' }>,
  holdMaxMs: number
) =>
  Effect.gen(function* () {
    const bytes = yield* pageShot(scope.session)
    const shot = bytes._tag === 'None' ? undefined : yield* scope.storeShot(bytes.value, 'confirm')
    const progress = {
      ...result.progress,
      screenshots: [...result.progress.screenshots, ...(shot === undefined ? [] : [shot])],
    }
    const parked = yield* parkForConfirmation({ scope, progress, index: result.index, holdMaxMs })
    if ('refusal' in parked) {
      yield* scope.session.close
      return failed(parked.refusal, false, browserRunOutputOf(progress))
    }
    return {
      status: 'success',
      pause: true,
      output: browserRunOutputOf(progress, {
        status: 'waiting-approval',
        confirmAt: result.index,
        holdMs: parked.holdMs,
      }),
    } satisfies ActionOutcome
  })

/**
 * Play the steps under the run's time limit; past it the browser is closed and
 * the run fails. `submitting` turns true just before the irreversible click: a
 * limit reached after it cannot say whether the click went through, so the run
 * answers `outcome_unknown` and is never retried, rather than a plain failure a
 * retry would answer with a second submission.
 */
const playWithin = (
  scope: BrowserRunScope,
  start: { readonly index: number; readonly progress: StepsResult['progress'] },
  runMs: number,
  submitting: Ref.Ref<boolean>
) =>
  runSteps(scope, start.index, start.progress).pipe(
    Effect.timeoutOrElse({
      duration: runMs,
      orElse: () =>
        Ref.get(submitting).pipe(
          Effect.map((clicked): StepsResult => ({
            kind: 'failed',
            progress: { ...start.progress, submitted: start.progress.submitted || clicked },
            code: 'step_failed',
            error: `the run took longer than its ${String(runMs)} ms limit (timeouts.runMs), so the browser was closed`,
          }))
        ),
    })
  )

/** Run the action once a session is open. */
const runInSession = (input: {
  readonly session: BrowserSession
  readonly options: BrowserRunOptions
  readonly action: Readonly<Record<string, unknown>>
  readonly app: App
  readonly automation: AutomationContext
  readonly runContext: ActionRunContext | undefined
  readonly stateKey: string | undefined
}) =>
  Effect.gen(function* () {
    const { session, options, automation, stateKey } = input
    const driver = yield* BrowserDriver
    const resumed = resumedFrom(input.runContext)
    const start = resumed ?? { index: 0, progress: EMPTY_PROGRESS }
    const submitting = yield* Ref.make(false)
    const scope: BrowserRunScope = {
      session,
      app: input.app,
      automation,
      runContext: input.runContext,
      stepName: options.stepName,
      steps: options.steps,
      allowedHosts: options.allowedHosts,
      stepTimeoutMs: options.stepMs ?? driver.limits.stepTimeoutMs,
      screenshots: options.screenshots,
      storeShot: shotStore({
        runId: automation.runId ?? globalThis.crypto.randomUUID(),
        bucket: options.bucket,
        automation,
        counter: yield* Ref.make(start.progress.screenshots.length + 1),
      }),
      beforeSubmit: Ref.set(submitting, true).pipe(
        Effect.andThen(
          stateKey === undefined
            ? Effect.void
            : writeIdempotencyKey(automation.id, stateKey, { state: 'pending' })
        )
      ),
      ...(resumed === undefined ? {} : { confirmedIndex: resumed.index }),
      healPolicy: healPolicyOf(input.action, input.app),
    }
    const runMs = options.runMs ?? driver.limits.runTimeoutMs
    const result = yield* playWithin(scope, start, runMs, submitting)
    if (result.kind === 'confirm')
      return yield* finishParked(scope, result, driver.limits.holdMaxMs)
    if (result.kind === 'failed') return yield* finishFailed(scope, result)
    return yield* finishDone(scope, options, result.progress, stateKey)
  })

/** `browser/run` — play fixed steps in a real browser. */
export const handleBrowserRun: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const options = browserRunOptionsOf(action)
    const resuming = resumedFrom(runContext) !== undefined
    const stateKey =
      options.idempotencyKey === undefined
        ? undefined
        : idempotencyStateKey(options.stepName, options.idempotencyKey)
    const answered = resuming ? undefined : yield* answerForKey(automation, options, stateKey)
    if (answered !== undefined) return answered
    const opened = yield* sessionFor(options, automation, resuming)
    if (opened.kind === 'refused') {
      return failed(opened.refusal, !NEVER_RETRIED.has(opened.code))
    }
    // Every ending closes the browser or hands it to a hold; an interruption or
    // a defect reaches none of them, so it closes the browser here, which also
    // gives the session's turn to the next run.
    return yield* runInSession({
      session: opened.session,
      options,
      action,
      app,
      automation,
      runContext,
      stateKey,
    }).pipe(Effect.onExit((exit) => (Exit.isSuccess(exit) ? Effect.void : opened.session.close)))
  }).pipe(
    Effect.catchTag('AutomationStateDatabaseError', (error) =>
      Effect.succeed(failed(`the idempotency key could not be read: ${String(error.cause)}`))
    ),
    Effect.withSpan('automations.handle-browser-run', { attributes: actionAttributes(action) })
  )
