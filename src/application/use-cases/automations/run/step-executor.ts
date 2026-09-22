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
import {
  actionKey,
  missingActionHandler,
  type ActionHandler,
  type ActionOutcome,
} from '../action-handlers'
import { redactSecretsForApp } from '../redact-secrets'
import { resolveEnvInValue } from '../resolve-env-vars'
import { resolveTriggerInValue } from '../resolve-trigger-data'
import { buildNativeActionInvoker, buildTemplateInvoker } from './action-invokers'
import {
  resolveRetryForAction,
  retrySchedule,
  truncateError,
  type AutomationInvoker,
  type ExecutedStep,
  type ResolvedRetryConfig,
  type RunAccumulator,
  type StepContext,
  type StepRequirements,
} from './types'
import type { App } from '@/domain/models/app'

/**
 * Coerce `app.connections` to the shape `redactSecretsForApp` expects (a
 * generic record array, free of the discriminated-union noise from the
 * domain schema). The redactor only reads `type` and `props.<secretKey>`
 * — anything else is irrelevant to redaction.
 */
const connectionsForRedaction = (
  app: App
): ReadonlyArray<Readonly<Record<string, unknown>>> | undefined =>
  app.connections as unknown as ReadonlyArray<Readonly<Record<string, unknown>>> | undefined

/**
 * Redact env values AND literal connection secrets (clientSecret,
 * apiKey.key, basic.password, bearer.token) from a free-form string
 * (e.g., upstream error messages), then cap the length to avoid bloating
 * run-history rows or HTTP responses. Falls back to the original input if
 * redaction returned a non-string (cannot happen with current
 * implementation but keeps the call site total).
 *
 * [internal ref]: connection literals are now scrubbed alongside env values,
 * so a `clientSecret: 'sk-test-key-abc'` (literal, not `$env.X`) cannot
 * leak into an error message even if no env var declares the same value.
 */
const redactString = (
  input: string,
  app: App,
  env: Readonly<Record<string, string | undefined>>
): string => {
  const redacted = redactSecretsForApp(input, app.env, env, connectionsForRedaction(app))
  return truncateError(typeof redacted === 'string' ? redacted : input)
}

/**
 * Redact env values AND literal connection secrets from a STRUCTURED value
 * (a step's `props` or `output`) before it is persisted. Companion to
 * {@link redactString}, which covers the free-form string channel (`error`);
 * this one walks nested objects and arrays, rewriting every string leaf.
 *
 * Non-string leaves (numbers, booleans, nulls) pass through untouched, so
 * structural markers merged into an outcome — `attempts[].attemptNumber`,
 * `retryCount`, `exhausted` — survive the pass intact.
 */
const redactRecord = (
  value: Readonly<Record<string, unknown>>,
  ctx: StepContext
): Readonly<Record<string, unknown>> =>
  redactSecretsForApp(
    value,
    ctx.app.env,
    ctx.processEnv,
    connectionsForRedaction(ctx.app)
  ) as Record<string, unknown>

/**
 * Build an `ExecutedStep` from a raw action and its dispatch outcome.
 *
 * This is the ONLY place a step becomes a durable history record, so it is
 * also the redaction boundary. EVERY field carrying runtime data is scrubbed
 * of env values and literal connection secrets BEFORE the record is appended
 *:
 *
 *   - `props`  → {@link redactRecord} — resolved `$env.X` values land here
 *   - `error`  → {@link redactString} — a thrown Error may embed a secret
 *   - `output` → {@link redactRecord} — user code can RETURN a secret, e.g.
 *     a code action returning `{ token: context.env.API_KEY }`
 *
 * INVARIANT: the only fields safe to copy through verbatim are the identity
 * fields (`name`, `type`, `operator`, `status`) — they come from the config's
 * own action declaration, never from runtime values. Any further field added
 * to `ExecutedStep` that carries runtime data REQUIRES a redaction pass here;
 * an unredacted channel is a secret leak into `GET /api/automations/runs/:id`.
 *
 * Ordering: redaction runs AFTER {@link dispatchWithRetry} has merged its
 * `attempts` / `retryCount` / `exhausted` markers into `outcome.output`, so
 * those markers survive (only string leaves are rewritten) and a secret echoed
 * in a per-attempt `error` is scrubbed too. Redacting earlier — inside the
 * handler or {@link projectRetryResult} — would ALSO poison `outcome.output`
 * itself, which the run accumulator forwards raw to step chaining and to the
 * synchronous trigger response; those deliberately keep the real value
 *. Only the persisted copy is masked.
 */
const buildStep = (
  rawAction: Readonly<Record<string, unknown>>,
  resolvedProps: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  ctx: StepContext
): ExecutedStep => {
  const stepOperator = rawAction['operator'] as string | undefined
  const redactedProps = redactRecord(resolvedProps, ctx)

  // `outcome.status` is `'success' | 'failure' | 'filtered'`. Filtered
  // outcomes are routed to {@link buildFilteredStep} (records the filter
  // action itself with `status: 'filtered'`); subsequent steps remain
  // omitted from `steps[]` via the `acc.halted` short-circuit in the run
  // loop. `'skipped'` is only set by {@link buildSkippedStep}; never by
  // buildStep.
  const stepStatus: 'success' | 'failure' | 'filtered' =
    outcome.status === 'failure'
      ? 'failure'
      : outcome.status === 'filtered'
        ? 'filtered'
        : 'success'
  return {
    name: String(rawAction['name'] ?? ''),
    type: String(rawAction['type'] ?? ''),
    ...(stepOperator !== undefined ? { operator: stepOperator } : {}),
    status: stepStatus,
    ...(outcome.error !== undefined
      ? { error: redactString(outcome.error, ctx.app, ctx.processEnv) }
      : {}),
    props: redactedProps,
    ...(outcome.output !== undefined ? { output: redactRecord(outcome.output, ctx) } : {}),
  }
}

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
 * expose per-attempt history at `run.attempts[]` for retry-exhaustion specs
 *.
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
 * loop set `runStatus: 'exhausted'` instead of `'failure'`
 *.
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
  const isExhausted = retry.maxAttempts > 1
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
 * the next invocation, which the code action surfaces as `context.run.attempt`
 *.
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
        outcome.status === 'failure' ? Effect.fail(outcome) : Effect.succeed(outcome)
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
const dispatchWithRetry = (input: {
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
      return withActionTimeout(
        handler(action, app, automation, contextForAttempt),
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
  })

/**
 * Last-write-wins selector for `responseOverride`: the most recent
 * `webhook/response` action shapes the synchronous response. Extracted
 * so {@link appendStepToAccumulator} stays inside the complexity cap
 * (the inline `??` pushed the function to 11; the project cap is 10).
 */
const pickResponseOverride = (
  outcome: ActionOutcome,
  acc: RunAccumulator
): Readonly<Record<string, unknown>> | undefined =>
  outcome.responseOverride !== undefined ? outcome.responseOverride : acc.responseOverride

/**
 * `automation:return` hands back a payload AND halts the rest of the callee
 * (early-exit). Only the FIRST `return` wins — keeps the contract
 * unambiguous when an automation has two `return` actions on different
 * branches. Returns `{ returnData, halt }`: `halt` joins `acc.halted` so a
 * `return` short-circuits the reduce loop just like a filter step.
 */
const pickReturnData = (
  outcome: ActionOutcome,
  acc: RunAccumulator
): {
  readonly returnData: Readonly<Record<string, unknown>> | undefined
  readonly halt: boolean
} => {
  const isReturn = outcome.returnData !== undefined && acc.returnData === undefined
  return { returnData: isReturn ? outcome.returnData : acc.returnData, halt: isReturn }
}

/**
 * Decide whether an action's failure should propagate to the run-level
 * status. A failed action with `continueOnError: true` is treated as
 * handled (the step still records as `failure`, but the run stays
 * `success` so the dispatcher returns 200 instead of 500) —
 * [internal ref].
 */
const shouldPropagateFailure = (
  rawAction: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome
): boolean => outcome.status === 'failure' && rawAction['continueOnError'] !== true

/**
 * Fold a step's `output` into `{ actions, lastOutput }`: append it under
 * `stepName` AND shallow-merge it into the run's rolling `lastOutput`. A
 * step with no output (or an unnamed step) leaves both unchanged.
 */
const foldStepOutput = (
  acc: RunAccumulator,
  stepName: string,
  out: Readonly<Record<string, unknown>> | undefined
): {
  readonly actions: RunAccumulator['actions']
  readonly lastOutput: RunAccumulator['lastOutput']
} =>
  out !== undefined
    ? {
        actions: { ...acc.actions, [stepName]: out },
        lastOutput: { ...(acc.lastOutput ?? {}), ...out },
      }
    : { actions: acc.actions, lastOutput: acc.lastOutput }

/**
 * Expose each prior step's output under a `.result` alias as well as its
 * bare keys, so a downstream action can reference either `{{step.key}}` or
 * `{{step.result.key}}`. The `.result` alias is the canonical step-chaining
 * path the file-action specs depend on (`{{generateReport.result.key}}`) and
 * mirrors the `automation:call` output, whose payload natively nests under
 * `result`. An output that ALREADY carries a `result` key (automation:call)
 * is passed through untouched so its own `result` is not double-wrapped.
 */
const buildStepsResultView = (
  actions: Readonly<Record<string, Record<string, unknown>>>
): Readonly<Record<string, Record<string, unknown>>> =>
  Object.fromEntries(
    Object.entries(actions).map(([name, output]) => [
      name,
      'result' in output ? output : { ...output, result: output },
    ])
  )

/**
 * Decide the new run-level status when an action propagates a failure.
 * `'exhausted'` wins over `'failure'`: an action that consumed its full
 * retry budget marks the run as exhausted (distinct terminal status —
 * [internal ref]). The marker is `outcome.output.exhausted`,
 * set by {@link dispatchWithRetry} when `retry.maxAttempts > 1` and all
 * attempts failed.
 */
const resolveFailureRunStatus = (outcome: ActionOutcome): 'failure' | 'exhausted' => {
  const exhausted = outcome.output?.['exhausted']
  return exhausted === true ? 'exhausted' : 'failure'
}

/**
 * Resolve the new run-level status when a step finished. Three cases:
 *
 *  1. The step propagated a failure (no `continueOnError`) — the run becomes
 *     `'failure'` or `'exhausted'` per {@link resolveFailureRunStatus}. The
 *     downstream loop will then skip every remaining action.
 *  2. The step FAILED but declared `continueOnError: true` — the run becomes
 *     `'completed-with-errors'` (unless it was already in a terminal failure
 * state, in which case we preserve that). [internal ref].
 *  3. The step succeeded (or filtered) — the run status is unchanged.
 */
const resolveRunStatusAfterStep = (
  rawAction: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  acc: RunAccumulator
): RunAccumulator['runStatus'] => {
  const propagateFailure = shouldPropagateFailure(rawAction, outcome)
  if (propagateFailure) return resolveFailureRunStatus(outcome)
  // A failure that didn't propagate (continueOnError === true) downgrades the
  // run to 'completed-with-errors' — but only if no earlier step has already
  // moved it to a stronger terminal state. Failure / exhausted / timed-out
  // win over completed-with-errors so a mixed run records the worst outcome.
  if (outcome.status === 'failure' && acc.runStatus === 'success') {
    return 'completed-with-errors'
  }
  return acc.runStatus
}

/**
 * Append a step's outcome to the accumulator, recording status/error/output
 * fields. Extracted from {@link foldOutcome} to keep complexity under the
 * project cap once the `'filtered'` branch was added.
 */
const appendStepToAccumulator = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Record<string, unknown>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { acc, rawAction, resolvedProps, outcome, ctx } = input
  const stepName = String(rawAction['name'] ?? '')
  const out =
    outcome.output !== undefined && stepName !== ''
      ? (outcome.output as Record<string, unknown>)
      : undefined
  const propagateFailure = shouldPropagateFailure(rawAction, outcome)
  const ret = pickReturnData(outcome, acc)
  const { actions, lastOutput } = foldStepOutput(acc, stepName, out)
  return {
    steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
    runStatus: resolveRunStatusAfterStep(rawAction, outcome, acc),
    runError: propagateFailure
      ? redactString(outcome.error ?? 'Action failed', ctx.app, ctx.processEnv)
      : acc.runError,
    actions,
    lastOutput,
    halted: acc.halted || ret.halt,
    responseOverride: pickResponseOverride(outcome, acc),
    returnData: ret.returnData,
  }
}

/**
 * Fold an action's `outcome` into the run accumulator. Pure synchronous;
 * tracks `lastOutput` as a shallow merge of every step's output (later
 * steps win on key collisions; see RunAccumulator docstring).
 */
const foldOutcome = (input: {
  readonly acc: RunAccumulator
  readonly rawAction: Readonly<Record<string, unknown>>
  readonly resolvedProps: Readonly<Record<string, unknown>>
  readonly outcome: ActionOutcome
  readonly ctx: StepContext
}): RunAccumulator => {
  const { acc, rawAction, resolvedProps, outcome, ctx } = input
  // Filter halt: record the filter action itself with `status: 'filtered'`
  // and set runStatus to `'skipped'` so the runs-API surfaces the halt
  //. Subsequent steps remain omitted from
  // `steps[]` via the `acc.halted` short-circuit in the run loop.
  // [internal ref]'s contract accepts either
  // "step omitted" or "step recorded as filtered/skipped" for the
  // FOLLOWING action — recording only the filter itself is compatible.
  if (outcome.status === 'filtered') {
    return {
      ...acc,
      steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
      runStatus: 'skipped',
      halted: true,
    }
  }
  // Approval pause: the `approval/request` handler returns a
  // successful outcome flagged `pause: true`. The run SUSPENDS — the approval
  // step is recorded (success, with its `output.status: 'pending'` so the
  // webhook/manual dispatcher surfaces it) but `halted` withholds every
  // subsequent action until an out-of-band approve/reject resolves the run.
  // The non-terminal `waiting-approval` status persists to the run row so the
  // resolution endpoint can identify a resumable run. `lastOutput` is still
  // folded so the synchronous response carries the pending status.
  if (outcome.pause === true) {
    const stepName = String(rawAction['name'] ?? '')
    const out =
      outcome.output !== undefined && stepName !== ''
        ? (outcome.output as Record<string, unknown>)
        : undefined
    const { actions, lastOutput } = foldStepOutput(acc, stepName, out)
    return {
      ...acc,
      steps: [...acc.steps, buildStep(rawAction, resolvedProps, outcome, ctx)],
      runStatus: 'waiting-approval',
      actions,
      lastOutput,
      halted: true,
    }
  }
  return appendStepToAccumulator({
    acc,
    rawAction,
    resolvedProps: resolvedProps as Record<string, unknown>,
    outcome,
    ctx,
  })
}

/**
 * Execute one action: resolve `$env.VAR` references in its props, dispatch
 * to the registered handler, retry per policy, and fold the outcome into
 * the accumulator.
 *
 * `buildAutomationInvoker` is supplied by the orchestrator so the
 * `automation:call` runtime callback can be threaded into the per-step run
 * context without this module importing `run-automation.ts`.
 */
export const executeStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>,
  ctx: StepContext,
  buildAutomationInvoker: (ctx: StepContext) => AutomationInvoker
): Effect.Effect<RunAccumulator, never, StepRequirements> =>
  Effect.gen(function* () {
    // Code actions skip global trigger pass — sandbox re-resolves inputData itself.
    const props = rawAction['props'] ?? {}
    const isCode = String(rawAction['type'] ?? '') === 'code'
    // Non-code actions get prior step outputs exposed three ways in their
    // props: under `{{steps.X.Y}}` (e.g. `automation:return`'s `data`
    // referencing `{{steps.charge.transactionId}}`), at the top level as
    // `{{X.Y}}`, and under a `.result` alias as `{{X.result.Y}}` /
    // `{{steps.X.result.Y}}`. The `.result` alias is the canonical chaining
    // path the file-action specs use (`{{generateReport.result.key}}`) and
    // mirrors the `automation:call` output which natively nests under
    // `result`. The code sandbox already exposes `context.steps.X` via its
    // own internal context, so it skips this.
    const stepsView = buildStepsResultView(acc.actions)
    const stepTemplateContext = isCode
      ? ctx.templateContext
      : { ...ctx.templateContext, ...stepsView, steps: stepsView }
    const subst = isCode ? props : resolveTriggerInValue(props, stepTemplateContext)
    const resolvedProps = resolveEnvInValue(subst, ctx.envLookup) as Record<string, unknown>
    // An unregistered key FAILS the step rather than silently succeeding. Every
    // action AppSchema can declare has a handler — asserted by
    // `registry-schema-coverage.test.ts` — so no config an author can write
    // reaches the fallback. `ref` never arrives here either: `expandRefActions`
    // rewrites it to its target before the run loop starts.
    const handler =
      ctx.handlers.get(
        actionKey(String(rawAction['type'] ?? ''), rawAction['operator'] as string | undefined)
      ) ?? missingActionHandler
    const runContext = {
      previousSteps: acc.actions,
      triggerData: ctx.triggerData,
      rawAction,
      envLookup: ctx.envLookup,
      // The 0-indexed position of this action: the count of steps already
      // recorded equals the index of the action about to run. Threaded so the
      // approval handler can record the paused step's index.
      stepIndex: acc.steps.length,
      invokeTemplate: buildTemplateInvoker(ctx, acc, new Set()),
      invokeNativeAction: buildNativeActionInvoker(ctx, acc, new Set()),
      invokeAutomation: buildAutomationInvoker(ctx),
    }
    const outcome: ActionOutcome = yield* dispatchWithRetry({
      handler,
      action: { ...rawAction, props: resolvedProps },
      app: ctx.app,
      automation: ctx.automation,
      runContext,
      retry: resolveRetryForAction(rawAction, ctx.automationRetry),
    })
    return foldOutcome({ acc, rawAction, resolvedProps, outcome, ctx })
  }).pipe(Effect.withSpan('automations.execute-step'))

/**
 * Build a `'skipped'` step record for an action that was never executed
 * because a previous step propagated a failure. Records the action's
 * identifying metadata (name/type/operator) but omits `props`/`output`/`error`
 * — the action never ran, so there is nothing to surface. Used by the
 * post-failure short-circuit in the run loop so callers can see every
 * action's terminal state, not just those that executed.
 *
 * [internal ref]: "when action N fails actions before N show
 * completed and actions after N show skipped".
 */
const buildSkippedStep = (rawAction: Readonly<Record<string, unknown>>): ExecutedStep => {
  const operator = rawAction['operator'] as string | undefined
  return {
    name: String(rawAction['name'] ?? ''),
    type: String(rawAction['type'] ?? ''),
    ...(operator !== undefined ? { operator } : {}),
    status: 'skipped',
  }
}

/**
 * Append a `'skipped'` step record without executing the action. The run
 * accumulator's runStatus / actions map / lastOutput remain unchanged —
 * skipped steps contribute nothing to the run's data flow, they're recorded
 * purely for observability.
 */
export const appendSkippedStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>
): RunAccumulator => ({
  ...acc,
  steps: [...acc.steps, buildSkippedStep(rawAction)],
})
