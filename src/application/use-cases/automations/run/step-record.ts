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

import { redactBoundQueryValues } from '@/domain/kernel/sanitize/bound-value-redaction'
import { type ActionOutcome } from '../action-handlers'
import { CALLER_REFUSAL } from '../action-handlers/record-caller-gate'
import { redactSecretsForRunHistory } from '../redact-secrets'
import { readActionIdentity } from './action-identity'
import { redactedReads } from './read-tracker'
import { maskSecretOutput, maskSecretProps, runSecretValues } from './secret-props'
import { truncateError, type ExecutedStep, type RunAccumulator, type StepContext } from './types'
import { maskValues, writeOnlyValuesIn, writeOnlyValuesOfStep } from './write-only-values'
import type { App } from '@/domain/models/app'

/** The write-only values the runs this run's chain called have read so far. */
const calledWriteOnlyValues = (ctx: Partial<Pick<StepContext, 'automation'>>): readonly string[] =>
  ctx.automation?.writeOnly?.called.values() ?? []

/**
 * The step record a run keeps of one action: what it was given and what it
 * answered, with secret values redacted before anything is stored.
 */

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
 *
 * A failed query's bound values go too (`redactBoundQueryValues`): a record
 * action whose write the database refused carries the row it tried to write in
 * the driver's text, and run history is read back by every operator.
 */
export const redactString = (
  input: string,
  app: App,
  env: Readonly<Record<string, string | undefined>>
): string => {
  const scrubbed = redactBoundQueryValues(input)
  const redacted = redactSecretsForRunHistory(scrubbed, app.env, env, app.connections)
  return truncateError(typeof redacted === 'string' ? redacted : scrubbed)
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
  redactSecretsForRunHistory(value, ctx.app.env, ctx.processEnv, ctx.app.connections) as Record<
    string,
    unknown
  >

/**
 * The error a reader who does not read every run is shown instead of the
 * step's own: a hand-started write the database refused because another record
 * holds the value reads as any other refused write, whether or not its starter
 * may read that record. The operator keeps the write's own failure.
 */
const clientErrorOf = (
  outcome: ActionOutcome,
  ctx: Pick<StepContext, 'automation'>
): { readonly clientError?: string } =>
  outcome.status === 'failure' &&
  outcome.refusedWrite?.unique === true &&
  ctx.automation.startedByHand === true
    ? { clientError: CALLER_REFUSAL }
    : {}

/**
 * The status a step records. `'skipped'` is set by the run loop's
 * `buildSkippedStep`, and by an action that halted because its connection is
 * not configured; a loop or a path the run parked inside records `'waiting'`
 * until the run resumes and completes its row.
 */
const stepStatusOf = (outcome: ActionOutcome): ExecutedStep['status'] => {
  if (outcome.status === 'failure') return 'failure'
  if (outcome.unconfigured !== undefined) return 'skipped'
  if (outcome.status === 'filtered') return 'filtered'
  return outcome.park?.container === undefined ? 'success' : 'waiting'
}

/**
 * Build an `ExecutedStep` from a raw action and its dispatch outcome.
 *
 * This is the ONLY place a step becomes a durable history record, so it is
 * also the redaction boundary. EVERY field carrying runtime data is scrubbed
 * of env values and literal connection secrets BEFORE the record is appended:
 *
 *   - `props`  → {@link redactRecord} — resolved `$env.X` values land here;
 *     a prop secret by its place (upload `headers`) is masked whole first
 *   - `error`  → {@link redactString} — a thrown Error may embed a secret
 *   - `output` → {@link redactRecord} — user code can RETURN a secret, e.g.
 *     a code action returning `{ token: context.env.API_KEY }`
 *   - `logs`   → {@link redactString} per entry — user code can LOG a secret
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
 * synchronous trigger response; those deliberately keep the real value. Only the persisted copy is masked.
 */
export const buildStep = (
  rawAction: Readonly<Record<string, unknown>>,
  resolvedProps: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  ctx: StepContext
): ExecutedStep => {
  const identity = readActionIdentity(rawAction)
  const redactedProps = redactRecord(maskSecretProps(identity, resolvedProps), ctx)
  // A write-only value the step wrote or read is masked in its record, by value.
  // So is one a run it called read, which it may hand back under any name.
  const writeOnly = [
    ...writeOnlyValuesOfStep(
      ctx.app,
      { type: identity.type, props: resolvedProps },
      outcome.output
    ),
    ...calledWriteOnlyValues(ctx),
  ]

  return maskValues<ExecutedStep>(
    {
      ...identity,
      status: stepStatusOf(outcome),
      ...(outcome.error !== undefined
        ? { error: redactString(outcome.error, ctx.app, ctx.processEnv) }
        : {}),
      ...clientErrorOf(outcome, ctx),
      props: redactedProps,
      ...(outcome.output !== undefined
        ? { output: redactRecord(maskSecretOutput(identity, outcome.output), ctx) }
        : {}),
      ...(outcome.logs !== undefined && outcome.logs.length > 0
        ? {
            logs: outcome.logs.map((entry) => ({
              level: entry.level,
              message: redactString(entry.message, ctx.app, ctx.processEnv),
            })),
          }
        : {}),
      ...redactedReads(outcome.reads, ctx),
      // The steps a path or a loop ran: each one already built here, so masked.
      ...outcome.nestedSteps,
    },
    writeOnly
  )
}

/**
 * A step record with how long the step took, as its dispatcher measured it —
 * a number, so it needs no redaction. Unset, the record keeps no duration.
 */
export const withDuration = (step: ExecutedStep, durationMs: number | undefined): ExecutedStep =>
  durationMs === undefined ? step : { ...step, durationMs }

/**
 * `value` with every secret an earlier step of the run answered (see
 * {@link runSecretValues}) replaced by `***` — for the record of a step, or the
 * run's error, written after it. {@link buildStep} masks the step's OWN
 * secret output by its place; a value a step was handed by template from an
 * earlier one matches no place, so it is found by value here. Runs on the
 * persisted copy only: the live output the next step reads is untouched.
 */
export const maskRunSecrets = <T>(
  value: T,
  acc: Pick<RunAccumulator, 'steps' | 'actions'>,
  ctx: Pick<StepContext, 'app' | 'triggerData'> & Partial<Pick<StepContext, 'automation'>>,
  /** Write-only values the step being recorded carries, not yet in `acc`. */
  current: readonly string[] = []
): T =>
  maskValues(value, [
    ...runSecretValues(acc.steps, acc.actions),
    // Every write-only value an earlier record step read or wrote...
    ...acc.steps.flatMap((step) => writeOnlyValuesOfStep(ctx.app, step, acc.actions[step.name])),
    // ...every one held under a write-only name in what the steps answered (a
    // loop's items, a path's branch, a called automation's return) or in what
    // the run was handed (a form's answers, a webhook's body)...
    ...writeOnlyValuesIn(ctx.app, [acc.actions, ctx.triggerData]),
    // ...every one a run it called read, whatever name it came back under...
    ...calledWriteOnlyValues(ctx),
    // ...and the step's own.
    ...current,
  ])
