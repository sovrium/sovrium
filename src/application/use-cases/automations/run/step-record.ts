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

import { gotoAddressVariables } from '@/domain/models/app/automations/actions/browser/browser-run-validation'
import { type ActionOutcome } from '../action-handlers'
import { redactSecretsForApp, redactSecretsInValue } from '../redact-secrets'
import { readActionIdentity } from './action-identity'
import { redactedReads } from './read-tracker'
import { maskSecretOutput, maskSecretProps, runSecretValues } from './secret-props'
import { truncateError, type ExecutedStep, type RunAccumulator, type StepContext } from './types'
import type { App } from '@/domain/models/app'

/**
 * The step record a run keeps of one action: what it was given and what it
 * answered, with secret values redacted before anything is stored.
 */

/**
 * The variables whose values are scrubbed from a step record: every one the app
 * declares, except those a browser `goto` address reads. Start-up lets an
 * address read only a variable declared `secret: false`, and the run shows the
 * address it opened as it is. A value another variable also holds is
 * still scrubbed under that variable.
 */
const scrubbedEnvOf = (app: App): App['env'] => {
  if (app.env?.some((variable) => variable.secret === false) !== true) return app.env
  const shown = gotoAddressVariables(app)
  return shown.size === 0 ? app.env : app.env.filter((variable) => !shown.has(variable.key))
}

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
export const redactString = (
  input: string,
  app: App,
  env: Readonly<Record<string, string | undefined>>
): string => {
  const redacted = redactSecretsForApp(input, scrubbedEnvOf(app), env, app.connections)
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
  redactSecretsForApp(value, scrubbedEnvOf(ctx.app), ctx.processEnv, ctx.app.connections) as Record<
    string,
    unknown
  >

/**
 * The status a step records. `'skipped'` is only ever set by the run loop's
 * `buildSkippedStep`; a loop or a path the run parked inside records
 * `'waiting'` until the run resumes and completes its row.
 */
const stepStatusOf = (outcome: ActionOutcome): ExecutedStep['status'] => {
  if (outcome.status === 'failure') return 'failure'
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

  return {
    ...identity,
    status: stepStatusOf(outcome),
    ...(outcome.error !== undefined
      ? { error: redactString(outcome.error, ctx.app, ctx.processEnv) }
      : {}),
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
  }
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
export const maskRunSecrets = <T>(value: T, acc: Pick<RunAccumulator, 'steps' | 'actions'>): T => {
  const secrets = runSecretValues(acc.steps, acc.actions)
  return secrets.length === 0
    ? value
    : (redactSecretsInValue(
        value,
        Object.fromEntries(secrets.map((secret, index) => [String(index), secret]))
      ) as T)
}
