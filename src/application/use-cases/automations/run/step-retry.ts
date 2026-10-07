/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Single-step dispatch for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Owns: per-step
 * prop resolution, the action-template / native-action sandbox invokers,
 * the per-action retry + timeout machinery, and the pure folds that merge
 * an action's outcome into the run accumulator.
 *
 * The `automation:call` invoker is supplied by the orchestrator as a
 * parameter (`buildAutomationInvoker`) so this module need not import
 * `run-automation.ts` — that would form an import cycle.
 */

import { Duration, Effect, Ref } from 'effect'
import { announceRecordWrites } from '@/application/use-cases/tables/record-change-announcement'
import { type ActionHandler, type ActionOutcome } from '../action-handlers'
import { actionAttributes } from '../action-handlers/shared'
import {
  isTransientFailure,
  MAX_RETRY_AFTER_MS,
  requestedRetryDelayMs,
} from './retry-classification'
import {
  retrySchedule,
  type ResolvedRetryConfig,
  type StepContext,
  type StepRequirements,
} from './types'
import type { App } from '@/domain/models/app'

/**
 * One action's dispatch under its timeout and retry policy, and the attempt
 * records the run keeps of each try.
 */

/**
 * Resolve the per-action timeout (top-level `action.timeout`) to a positive
 * millisecond value, or undefined when no timeout applies. The schema gates
 * the range (1_000 – 900_000) at decode time so we trust the value here.
 */
const resolveActionTimeoutMs = (action: Readonly<Record<string, unknown>>): number | undefined => {
  const raw = action['timeout']
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

/**
 * Wrap a handler invocation with a per-action timeout. On timeout the
 * wrapper resolves with a synthetic `{ status: 'failure', error: ... }`
 * outcome so the run loop can record the step's failure (and honour
 * `continueOnError` / retry) instead of letting the underlying handler
 * wedge the entire run.
 *
 * When no timeout is configured the original invocation is returned
 * unchanged — no extra fiber scheduling cost.
 */
const withActionTimeout = (
  invocation: Effect.Effect<ActionOutcome, never, StepRequirements>,
  timeoutMs: number | undefined,
  action: Readonly<Record<string, unknown>>
): Effect.Effect<ActionOutcome, never, StepRequirements> => {
  if (timeoutMs === undefined) return invocation
  const stepName = String(action['name'] ?? 'action')
  // EFFECT 4: see `overview-block-timeout.ts` — `timeoutTo` -> `timeoutOrElse`
  // with an Effect fallback; `onSuccess` was the identity.
  return Effect.timeoutOrElse(invocation, {
    duration: Duration.millis(timeoutMs),
    orElse: (): Effect.Effect<ActionOutcome> =>
      Effect.succeed({
        status: 'failure',
        error: `action '${stepName}' timed out after ${String(timeoutMs)}ms`,
      }),
  })
}

/**
 * A single attempt record captured by {@link dispatchWithRetry}. Surfaced on
 * the action's outcome `output.attempts` so the runs-by-name endpoint can
 * expose per-attempt history at `run.attempts[]` for retry-exhaustion specs.
 */
interface AttemptRecord {
  readonly attemptNumber: number
  readonly timestamp: string
  readonly error?: string
}

/** Everything {@link dispatchWithRetry} knows once the retry loop has settled. */
interface RetryOutcome {
  readonly outcome: ActionOutcome
  readonly attempts: ReadonlyArray<AttemptRecord>
}

const buildAttemptRecord = (outcome: ActionOutcome, attemptNumber: number): AttemptRecord => ({
  attemptNumber,
  timestamp: new Date().toISOString(),
  ...(outcome.error !== undefined ? { error: outcome.error } : {}),
})

/**
 * Project the settled retry state into the augmented outcome surfaced to
 * the run loop. Carries `attempts`, `retryCount`, and (on final failure
 * with `maxAttempts > 1`) the `exhausted: true` marker that lets the run
 * loop set `runStatus: 'exhausted'` instead of `'failure'`.
 *
 * `retryCount` counts RETRIES, not attempts — one fewer than the number of
 * recorded attempts — so `maxAttempts: 2` reports `retryCount: 1`, which is
 * what the failure-handler fan-out reads as `trigger.data.attempt`.
 */
const projectRetryResult = (result: RetryOutcome, retry: ResolvedRetryConfig): ActionOutcome => {
  if (result.outcome.status !== 'failure') {
    return {
      ...result.outcome,
      output: { ...(result.outcome.output ?? {}), attempts: result.attempts },
    }
  }
  // Exhausted means the budget was SPENT. A failure the loop declined to retry
  // (a non-transient 4xx, or a Retry-After longer than the loop will wait)
  // ends the run as an ordinary failure instead.
  const isExhausted = retry.maxAttempts > 1 && result.attempts.length >= retry.maxAttempts
  return {
    ...result.outcome,
    output: {
      ...(result.outcome.output ?? {}),
      retryCount: Math.max(0, result.attempts.length - 1),
      attempts: result.attempts,
      ...(isExhausted ? { exhausted: true } : {}),
    },
  }
}

/**
 * Decide what one settled attempt means to the retry loop.
 *
 * A failure goes into the error channel — the one `Effect.retry` retries —
 * only when another attempt could succeed ({@link isTransientFailure}). A
 * non-transient failure is handed back as a value, which ends the loop at once.
 * When a `429` or `503` names a `Retry-After`, the loop waits that long before
 * the next attempt (on top of the schedule's own delay, so never sooner than
 * asked), and does not retry at all when the wait exceeds
 * {@link MAX_RETRY_AFTER_MS}. No wait is spent after the last attempt.
 */
const settleAttempt = (
  outcome: ActionOutcome,
  attemptNumber: number,
  maxAttempts: number
): Effect.Effect<ActionOutcome, ActionOutcome> => {
  if (outcome.status !== 'failure') return Effect.succeed(outcome)
  if (!isTransientFailure(outcome)) return Effect.succeed(outcome)
  const requested = requestedRetryDelayMs(outcome, Date.now())
  if (requested === undefined || attemptNumber >= maxAttempts) return Effect.fail(outcome)
  if (requested > MAX_RETRY_AFTER_MS) return Effect.succeed(outcome)
  return Effect.sleep(Duration.millis(requested)).pipe(Effect.andThen(Effect.fail(outcome)))
}

/**
 * Run the handler under the action's retry policy, recording one
 * {@link AttemptRecord} per invocation.
 *
 * An action handler reports failure as a VALUE (`outcome.status === 'failure'`)
 * on an effect whose error channel is `never`, so there is nothing for
 * `Effect.retry` to retry until we lift that value into the error channel —
 * which is what the `Effect.fail` below does, and what the trailing
 * `Effect.catch` immediately undoes once the schedule is exhausted. The failing
 * outcome is therefore never lost: it is carried through the error channel and
 * handed back verbatim.
 *
 * The attempt log lives in a `Ref` because `Effect.retry` gives the caller no
 * per-attempt hook; reading it back also yields the attempt NUMBER to pass into
 * the next invocation, which the code action surfaces as `context.run.attempt`.
 */
const runWithRetrySchedule = (
  retry: ResolvedRetryConfig,
  invoke: (attempt: number) => Effect.Effect<ActionOutcome, never, StepRequirements>
): Effect.Effect<RetryOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const log = yield* Ref.make<ReadonlyArray<AttemptRecord>>([])
    const attempt = Ref.get(log).pipe(
      Effect.flatMap((prior) => invoke(prior.length + 1)),
      Effect.tap((outcome) =>
        Ref.update(log, (prior) => [...prior, buildAttemptRecord(outcome, prior.length + 1)])
      ),
      Effect.flatMap((outcome) =>
        Ref.get(log).pipe(
          Effect.flatMap((prior) => settleAttempt(outcome, prior.length, retry.maxAttempts))
        )
      )
    )
    const outcome = yield* Effect.retry(attempt, retrySchedule(retry)).pipe(
      Effect.catch((failed) => Effect.succeed(failed))
    )
    return { outcome, attempts: yield* Ref.get(log) }
  })

/**
 * Invoke an action's handler, retrying on failure per the action's resolved
 * retry policy. On a successful attempt the outcome is returned unchanged.
 * On a final failure (all attempts exhausted) the failing outcome is
 * augmented with `output: { ...outcome.output, retryCount }` so callers can
 * observe how many retries were performed. When no retry config applies the
 * handler is invoked exactly once and its outcome returned verbatim.
 */
export const dispatchWithRetry = (input: {
  readonly handler: ActionHandler
  readonly action: Readonly<Record<string, unknown>>
  readonly app: App
  readonly automation: StepContext['automation']
  readonly runContext: Parameters<ActionHandler>[3]
  readonly retry: ResolvedRetryConfig | undefined
}): Effect.Effect<ActionOutcome, never, StepRequirements> =>
  Effect.gen(function* () {
    const { handler, action, app, automation, runContext, retry } = input
    const timeoutMs = resolveActionTimeoutMs(action)
    // The handler receives a per-attempt runContext so the code action can
    // surface `attempt` via `context.run.attempt`. Other handlers ignore
    // the field — it's optional on `ActionRunContext`.
    const invoke = (attempt: number): Effect.Effect<ActionOutcome, never, StepRequirements> => {
      const contextForAttempt = runContext === undefined ? runContext : { ...runContext, attempt }
      // One announcing scope per attempt: every record the step writes — a
      // loop of a thousand rows included — is announced as ONE write, so the
      // per-write resync threshold counts the step, not each row of it.
      return withActionTimeout(
        announceRecordWrites(app)(handler(action, app, automation, contextForAttempt)),
        timeoutMs,
        action
      )
    }
    if (retry === undefined) return yield* invoke(1)
    const result = yield* runWithRetrySchedule(retry, invoke)
    // A first-attempt success is returned VERBATIM — no `attempts` key. Only a
    // run that actually retried carries the attempt log, which is what keeps
    // `computeAttemptCount` reporting 1 for ordinary successful runs.
    if (result.outcome.status !== 'failure' && result.attempts.length <= 1) {
      return result.outcome
    }
    return projectRetryResult(result, retry)
  }).pipe(
    Effect.withSpan('automations.dispatch-with-retry', {
      attributes: actionAttributes(input.action),
    })
  )
