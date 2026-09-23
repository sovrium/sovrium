/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared types and small pure helpers for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition) so the
 * orchestrator, step-executor, prop-substitution, run-status and
 * run-persistence modules can all import a single source of truth for
 * the run-loop type contract without re-declaring it.
 */

import { Duration, Effect, Schedule } from 'effect'
import type { ActionHandler, ActionKey, ActionOutcome, AutomationContext } from '../action-handlers'
import type { TriggerData } from '../resolve-trigger-data'
import type { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import type { AutomationDigestRepository } from '@/application/ports/repositories/automations/automation-digest-repository'
import type { AutomationRepository } from '@/application/ports/repositories/automations/automation-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { ImageTransformService } from '@/application/ports/services/image-transform-service'
import type { ServerOrigin } from '@/application/ports/services/server-origin'
import type { SpeechService } from '@/application/ports/services/speech-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'

/**
 * Step record retained in run history.
 *
 * Mirrors `AutomationRunRecord['steps'][number]` so the run loop can build
 * an array of these directly without reshaping at the end. `output` is the
 * action handler's `outcome.output` — needed by the runs detail endpoint
 * so callers wanting per-step outputs (intermediate-step
 * assertions in multi-action regressions) can read them from the steps[]
 * array in `GET /api/automations/runs/:id`.
 */
export interface ExecutedStep {
  readonly name: string
  readonly type: string
  readonly operator?: string
  /**
   * Per-step terminal status:
   *  - `'success'` — handler returned `outcome.status === 'success'`
   *  - `'failure'` — handler returned `outcome.status === 'failure'` (whether or
   *    not the action declared `continueOnError`)
   *  - `'filtered'` — a `filter`/`continue` action evaluated false and halted
   *    the run via `onFalse: 'stop'`. The filter step itself is recorded with
   *    this status so the runs-API surface (`GET /api/automations/runs/:id`)
   *    can observe the filter outcome; subsequent steps remain omitted from
   * `steps` — [internal ref].
   *  - `'skipped'` — the run loop short-circuited before this step ran because
   *    an earlier step propagated a failure (no `continueOnError`). The step
   *    is still recorded in `steps[]` so callers can observe which actions
   * were intentionally not executed — [internal ref].
   */
  readonly status: 'success' | 'failure' | 'filtered' | 'skipped'
  readonly error?: string
  readonly props?: Record<string, unknown>
  readonly output?: Record<string, unknown>
}

/**
 * Accumulator type for `Effect.reduce` over the action list.
 */
export interface RunAccumulator {
  readonly steps: ReadonlyArray<ExecutedStep>
  /**
   * Engine-internal run status. The terminal variants are
   * `'success'|'failure'|'timed-out'|'exhausted'|'completed-with-errors'|'skipped'|'cancelled'`.
   * The transient variants `'queued'`/`'running'` are observable in the
   * persisted runs table only — the reduce-loop accumulator itself never
   * carries them (the scheduler updates `system.automation_runs.status`
   * directly before/while the loop runs). They are listed in the union so
   * the status mappers (toApiStatus, toApiStepStatus, etc.) can propagate
   * them verbatim when reading rows back from the DB.
   */
  readonly runStatus:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'waiting-approval'
    | 'queued'
    | 'running'
  readonly runError: string | undefined
  /** Per-action `output` collected from each step's `ActionOutcome`. */
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  /**
   * Shallow-merged outputs from every step that produced one (later steps
   * win on collisions). Surfaces as `output` in webhook/manual responses;
   * per-step isolation lives in `actions[stepName]` + the runs API
   *. Single-step runs behave like "last action's output".
   */
  readonly lastOutput: Record<string, unknown> | undefined
  /**
   * Set true when a filter action returns `status: 'filtered'`. Causes
   * the run loop to short-circuit subsequent steps without recording
   * them — matches [internal ref]'s
   * "premiumStep === undefined" branch.
   */
  readonly halted: boolean
  /**
   * Last `responseOverride` surfaced by an action handler in this run.
   * Last-write-wins lets a multi-action automation layer overrides
   * (rare — typically there is at most one `webhook/response` per
   * automation). Not persisted; consumed only by the synchronous
   * webhook dispatcher.
   */
  readonly responseOverride: Readonly<Record<string, unknown>> | undefined
  /**
   * Payload from the first `automation:return` action this run executed
   * (early-exit semantics — once `return` fires, `halted` is set so no
   * later action runs). `undefined` when the run declared no `return`
   * action; the `automation:call` caller then receives `{ result: {} }`.
   * Surfaces as `RunAutomationResult.returnData`.
   */
  readonly returnData: Readonly<Record<string, unknown>> | undefined
}

/**
 * Per-step context passed to the run loop. Bundles the inputs that
 * stay constant across steps so the inner generator stays compact.
 */
export interface StepContext {
  readonly app: App
  /**
   * Run a sub-program on the services THIS run is already using, returning a
   * Promise.
   *
   * The code-action sandbox and the `automation:call` invoker both have to hand
   * user code a Promise, so one of the two sides of that boundary has to make
   * the crossing. Carrying the runner on the context means the run loop makes
   * it once, from the fiber that holds the services — instead of each invoker
   * rebuilding the whole automation runtime per dispatched step, which is what
   * they did before. Supplied by `buildStepContext`; see
   * `infrastructure/automations/runtime-layer.ts` for the bridge itself.
   */
  readonly runProgram: <A, E>(program: Effect.Effect<A, E, RunRequirements>) => Promise<A>
  readonly envLookup: Readonly<Record<string, string>>
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  /** `{ trigger: { data: TriggerData } }` — used to resolve `{{trigger.X}}`. */
  readonly templateContext: Readonly<Record<string, unknown>>
  /** Identity of the running automation; threaded into each handler call. */
  readonly automation: AutomationContext
  /** Raw trigger payload — code action sandbox flattens this for `context.trigger.data`. */
  readonly triggerData: Readonly<Record<string, unknown>>
  /**
   * Automation-level retry config (from `automation.retry`), used as the
   * fallback when an action does not declare its own `retry`. A per-action
   * `retry` REPLACES this entirely (it does not merge field-by-field).
   * Undefined when neither the automation nor the action sets retry.
   */
  readonly automationRetry: ResolvedRetryConfig | undefined
  /**
   * Call-stack depth of this run: 0 for a top-level trigger (webhook /
   * manual / cron / record-event), N for the Nth nested `automation:call`
   * hop. Threaded so the `automation:call` invoker can enforce `maxDepth`.
   */
  readonly callDepth: number
  /**
   * Names of every automation currently on the call stack (this run and
   * all its callers). The `automation:call` invoker rejects a re-entry of
   * any name in this set with a `circular-reference` error so an
   * A→B→A chain terminates instead of running away.
   */
  readonly visitedAutomations: ReadonlySet<string>
}

/**
 * Normalised retry config the run loop acts on. `delayMs` is resolved to a
 * concrete number (a per-action override like `{ maxAttempts: 1 }`
 * deliberately drops the automation-level `delayMs`, resolving to a small
 * default). `strategy` decides how the inter-attempt delay grows:
 *
 *   - `'fixed'` (default): every retry waits `delayMs`.
 *   - `'exponential'`: retry N (1-indexed) waits `delayMs * 2^(N-1)`.
 */
export interface ResolvedRetryConfig {
  readonly maxAttempts: number
  readonly delayMs: number
  readonly strategy: 'fixed' | 'exponential'
}

/**
 * Service requirement set shared by the step executor and the retry loop.
 */
export type StepRequirements =
  | TableRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | AutomationApprovalRepository
  | AuthRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | AnalyticsRepository
  | AiService
  | AiEmbeddingRepository
  | StorageService
  | ImageTransformService
  | SpeechService
  | LinkRepository
  | ServerOrigin

/**
 * Combined service requirement for the run-loop entry points. Aliased so
 * the function signatures stay one line (max-lines-per-function compliance).
 */
export type RunRequirements =
  | TableRepository
  | AutomationRepository
  | AutomationRunRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | AutomationApprovalRepository
  | AuthRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | AnalyticsRepository
  | AiService
  | AiEmbeddingRepository
  | StorageService
  | ImageTransformService
  | SpeechService
  | LinkRepository
  | ServerOrigin

/**
 * Locally re-typed `app.actions[]` template entry. The runtime invoker
 * only reads `name`, `action`, and `variables` — keeping the type
 * lookup-shaped here avoids dragging the encoded-vs-decoded ActionTemplate
 * generics into the run loop.
 */
export interface RuntimeActionTemplate {
  readonly name: string
  readonly action: Readonly<Record<string, unknown>>
  readonly variables?: Readonly<Record<string, unknown>>
}

/**
 * Result of running an automation. `actions` is retained for run-history
 * persistence; the public trigger response exposes only `lastOutput` as
 * `output`. `error` is the first action failure (already redacted).
 *
 * `responseOverride` — when set — is the (status, body, headers) payload
 * a `webhook/response` action emitted via its `ActionOutcome.responseOverride`
 * side-channel. The synchronous webhook dispatcher uses it to override the
 * default sync response. Last-write-wins across multiple `webhook/response`
 * actions in a single run (rare). Not persisted to run-history.
 */
export interface RunAutomationResult {
  readonly runId: string
  /**
   * Engine-internal status:
   *  - `'success'` — every action completed without propagating failure
   *  - `'failure'` — at least one action failed (and lacked `continueOnError`)
   *  - `'timed-out'` — the run loop exceeded `automation.timeout`; persisted
   *    runs surface this status verbatim so callers can distinguish a hard
   * timeout from a routine failure ([internal ref]..008).
   *  - `'exhausted'` — an action's retry policy was configured (`maxAttempts >
   *    1`) AND all attempts failed; distinct from `'failure'` so callers can
   *    tell a single-shot failure apart from a fully-exhausted retry budget
   * ([internal ref]..011).
   *  - `'completed-with-errors'` — at least one action failed BUT every failing
   *    action declared `continueOnError: true`, so subsequent actions still
   *    executed. Distinguishes "all green" from "partially-degraded green"
   *.
   *  - `'skipped'` — a `filter`/`continue` action evaluated false and halted
   *    the run via `onFalse: 'stop'` before any non-filter action completed
   *. Surfaces as `'skipped'` on the runs API.
   */
  readonly status:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'waiting-approval'
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  readonly lastOutput?: Record<string, unknown>
  readonly error?: string
  readonly responseOverride?: Readonly<Record<string, unknown>>
  /**
   * Payload from the run's first `automation:return` action (early-exit).
   * The `automation:call` invoker reads this and hands `{ result }` back
   * to the caller; absent when the callee declared no `return` action
   * (the caller then sees `{ result: {} }`).
   */
  readonly returnData?: Readonly<Record<string, unknown>>
}

/**
 * Inputs for `executeAutomationRun`. Reused across entry points
 * (webhook, manual, record-event) so the persistence + dispatch contract
 * stays identical.
 */
export interface ExecuteAutomationRunInput {
  readonly name: string
  readonly automation: NonNullable<App['automations']>[number]
  readonly automationId: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  /**
   * Call-stack depth for this run. Top-level triggers omit it (treated as
   * 0); nested `automation:call` hops pass `callerDepth + 1`.
   */
  readonly callDepth?: number
  /**
   * Names of every automation already on the call stack — used by the
   * `automation:call` invoker's cycle guard. Omitted for top-level runs.
   */
  readonly visitedAutomations?: ReadonlySet<string>
  /**
   * Action names that the run loop should record as `'skipped'` WITHOUT
   * executing. Used by the replay endpoint so a
   * resumed run preserves the previously-successful side-effects of those
   * steps without re-running them — a record/create that fired in the
   * original run is NOT fired again on replay (no duplicate insert).
   *
   * Undefined / empty set means "execute every action normally" (the
   * default top-level run shape).
   */
  readonly skipActionNames?: ReadonlySet<string>
  /**
   * Optional callback invoked synchronously by the scheduler the moment
   * the `'queued'` run row lands in `system.automation_runs`. Threaded
   * through so the async webhook dispatcher (`respondImmediately: true`)
   * can surface the persisted runId in its 202 response BEFORE the loop
   * has finished — [internal ref] depends on this so the cancel
   * endpoint can locate the in-flight run by id.
   *
   * When omitted (the synchronous webhook path, manual-trigger, replay,
   * cron, record-event), the runId surfaces only via the
   * {@link RunAutomationResult} returned at completion time.
   */
  readonly onPersisted?: (runId: string) => void
}

/**
 * The `automation:call` runtime callback threaded into every step's run
 * context. Built per-run by the orchestrator and passed into the step
 * executor so the step-dispatch module need not import the orchestrator
 * (avoids a cyclic import).
 */
export type AutomationInvoker = (input: {
  readonly name: string
  readonly inputData: Readonly<Record<string, unknown>>
  readonly mode: 'sync' | 'async'
  readonly maxDepth: number
}) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>

/**
 * Empty starting accumulator for the action-reduce loop.
 */
export const EMPTY_RUN_ACCUMULATOR: RunAccumulator = {
  steps: [],
  runStatus: 'success',
  runError: undefined,
  actions: {},
  lastOutput: undefined,
  halted: false,
  responseOverride: undefined,
  returnData: undefined,
}

/**
 * Base delay used when a retry config sets `maxAttempts` but no `delayMs`.
 * Kept small so the E2E specs (which exercise real retries through a real
 * scheduler) stay fast — exponential growth from 50ms is 50/100/200/…,
 * well under the spec wait windows.
 */
const DEFAULT_RETRY_DELAY_MS = 50

/**
 * Cap on any single inter-attempt sleep — guards against a misconfigured
 * `delayMs` plus exponential growth wedging a request handler for minutes.
 */
const MAX_RETRY_DELAY_MS = 30_000

/**
 * The retry policy for one action, as an Effect `Schedule`.
 *
 * Emits one delay before each RETRY — none before the first attempt, and none
 * after the last failure — so a `maxAttempts: N` config yields `N - 1` delays
 * and exactly `N` invocations. `'exponential'` doubles from the base
 * (`base * 2^(n-1)`, matching `Schedule.exponential`'s 1-indexed `attempt`);
 * `'fixed'` holds the base constant. Every delay is capped at
 * {@link MAX_RETRY_DELAY_MS}, and a `delayMs` of 0 (the shape `toResolvedRetry`
 * produces when the config omits it) falls back to
 * {@link DEFAULT_RETRY_DELAY_MS}.
 *
 * The exact sequence is pinned in `retry-schedule.test.ts` — no E2E spec can
 * observe it, so that unit test is the only guard against silent drift.
 */
export const retrySchedule = (retry: ResolvedRetryConfig): Schedule.Schedule<Duration.Duration> => {
  const base = retry.delayMs > 0 ? retry.delayMs : DEFAULT_RETRY_DELAY_MS
  // `exponential` computes `base * factor^(attempt - 1)`, so a factor of 1 is
  // precisely the `'fixed'` strategy — one constructor covers both, and both
  // branches then share the `Duration` output type.
  const growth = Schedule.exponential(
    Duration.millis(base),
    retry.strategy === 'exponential' ? 2 : 1
  )
  return growth.pipe(
    Schedule.modifyDelay(({ duration }) =>
      Effect.succeed(Duration.min(duration, Duration.millis(MAX_RETRY_DELAY_MS)))
    ),
    // `maxAttempts` counts TOTAL attempts and the first one is not a retry, so
    // the schedule may recur at most `maxAttempts - 1` times.
    Schedule.upTo({ times: Math.max(0, retry.maxAttempts - 1) })
  )
}

/**
 * Coerce a raw `retry` object (from `automation.retry` or `action.retry`)
 * into the {@link ResolvedRetryConfig} shape, or undefined if the input is
 * not a usable retry config. `maxAttempts` is the only required field; an
 * absent `delayMs` resolves to 0.
 */
export const toResolvedRetry = (raw: unknown): ResolvedRetryConfig | undefined => {
  if (raw === null || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const maxAttempts = typeof r['maxAttempts'] === 'number' ? r['maxAttempts'] : undefined
  if (maxAttempts === undefined || !Number.isFinite(maxAttempts) || maxAttempts < 1) {
    return undefined
  }
  const delayMs =
    typeof r['delayMs'] === 'number' && Number.isFinite(r['delayMs']) ? r['delayMs'] : 0
  const strategy: 'fixed' | 'exponential' =
    r['strategy'] === 'exponential' ? 'exponential' : 'fixed'
  return { maxAttempts: Math.floor(maxAttempts), delayMs, strategy }
}

/**
 * Resolve the retry policy for one action: a per-action `retry` REPLACES the
 * automation-level one; falling back to the automation-level config when the
 * action does not declare its own. Returns undefined when neither is set.
 */
export const resolveRetryForAction = (
  rawAction: Readonly<Record<string, unknown>>,
  automationRetry: ResolvedRetryConfig | undefined
): ResolvedRetryConfig | undefined => {
  const actionRetry = toResolvedRetry(rawAction['retry'])
  return actionRetry ?? automationRetry
}

export const cryptoRandomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}

/**
 * Cap on `error` field length surfaced to the trigger response and
 * persisted to `system.automation_runs.error` — guards against a
 * misbehaving upstream inflating run-history payloads.
 */
export const MAX_ERROR_LENGTH = 500
const TRUNCATION_SUFFIX = '… (truncated)'

/**
 * Truncate AFTER redaction. If we truncated first and the secret straddled
 * the cut point, redaction would not match the literal string and a partial
 * secret could leak into history. Always: redact -> truncate.
 *
 * @internal — exported for unit tests; production callers go through
 * `redactString` which composes redaction + truncation in the correct order.
 */
export const truncateError = (input: string): string => {
  if (input.length <= MAX_ERROR_LENGTH) return input
  return input.slice(0, MAX_ERROR_LENGTH) + TRUNCATION_SUFFIX
}

/**
 * True when an earlier step has already propagated a failure that should
 * short-circuit the remaining actions in the run. `'failure'` and
 * `'exhausted'` halt the loop; `'completed-with-errors'` does NOT (its
 * defining property is that subsequent actions still run after a
 * `continueOnError` failure). `'timed-out'` is produced only by the
 * outer timeout wrapper, never reaches the per-step loop.
 */
export const isTerminalFailureStatus = (status: RunAccumulator['runStatus']): boolean =>
  status === 'failure' || status === 'exhausted' || status === 'cancelled'

export type { ActionOutcome }
