/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** Shared types and small pure helpers for the automation run loop: its one type contract. */

import { Duration, Effect, Schedule } from 'effect'
import type { ActionHandler, ActionKey, AutomationContext } from '../action-handlers'
import type { ClientErrorField, RunClientErrorField } from './client-error'
import type { RecordEventChannel } from './record-event-channel'
import type { RunLedgers } from './run-ledger-persistence'
import type { StepWindowField } from './step-window'
import type { WriteOnlyInheritance } from './write-only-values'
import type { AuthStepRequirements } from '../action-handlers/auth-grants'
import type { BrowserStepRequirements } from '../action-handlers/browser-run-scope'
import type { EmailStepRequirements } from '../action-handlers/email'
import type { ContainerResume } from '../action-handlers/run-park'
import type { StepLogEntry } from '../action-handlers/shared'
import type { TriggerData } from '../resolve-trigger-data'
import type { StepMetadataMap } from './step-metadata'
import type { MediaStepRequirements } from '../action-handlers/file-extract-audio'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type { AiComputeStatusRepository } from '@/application/ports/repositories/ai/ai-compute-status-repository'
import type { AiEmbeddingRepository } from '@/application/ports/repositories/ai/ai-embedding-repository'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { UserDirectoryRepository } from '@/application/ports/repositories/auth/user-directory-repository'
import type { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import type { AutomationDigestRepository } from '@/application/ports/repositories/automations/automation-digest-repository'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { AutomationRepository } from '@/application/ports/repositories/automations/automation-repository'
import type { AutomationRunOutcomeRepository } from '@/application/ports/repositories/automations/automation-run-outcome-repository'
import type { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import type { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import type { NotificationRepository } from '@/application/ports/repositories/automations/notification-repository'
import type { CommentRepository } from '@/application/ports/repositories/comment-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { ConfigAccountProvisioner } from '@/application/ports/services/account-provisioner'
import type { AiService } from '@/application/ports/services/ai-service'
import type { AppSelfSeeder } from '@/application/ports/services/app-self-seeder'
import type { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import type { DocumentRenderer } from '@/application/ports/services/document-renderer'
import type { InstanceSupervisor } from '@/application/ports/services/instance-supervisor'
import type { OAuthClientRegistrar } from '@/application/ports/services/oauth-client-registrar'
import type { OAuthTokenClient } from '@/application/ports/services/oauth-token-client'
import type { OfficeConverter } from '@/application/ports/services/office-converter'
import type { PdfEditor } from '@/application/ports/services/pdf-editor'
import type { PdfToolkit } from '@/application/ports/services/pdf-toolkit'
import type { RecordWebhookDispatcher } from '@/application/ports/services/record-webhook-dispatcher'
import type { SentinelTokens } from '@/application/ports/services/sentinel-tokens'
import type { ServerOrigin } from '@/application/ports/services/server-origin'
import type { SpeechService } from '@/application/ports/services/speech-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { SvgRasterizer } from '@/application/ports/services/svg-rasterizer'
import type { TemplateEngine, TemplateRenderer } from '@/application/ports/services/template-engine'
import type { AgentToolRequirements } from '@/application/use-cases/agents/agent-tool-call'
import type { App } from '@/domain/models/app'
import type { RunRelay } from '@/domain/models/app/automations/run-relay-service'
import type { ResumeFrame } from '@/domain/models/app/automations/run-resume-cursor-service'
import type { StepRead } from '@/domain/models/app/automations/step-read-service'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/** A step record in run history, as `GET /api/automations/runs/:id` reads it back. */
export interface ExecutedStep extends ClientErrorField, StepWindowField {
  readonly name: string
  readonly type: string
  readonly operator?: string
  /**
   * Per-step terminal status:
   *  - `'success'` — handler returned `outcome.status === 'success'`
   *  - `'failure'` — handler returned `outcome.status === 'failure'` (whether or
   *    not the action declared `continueOnError`)
   *  - `'filtered'` — a `filter`/`continue` evaluated false and halted the run via
   *    `onFalse: 'stop'`; recorded so the runs API sees it, later steps omitted from `steps[]`.
   *  - `'skipped'` — never ran: an earlier step propagated a failure (no
   *    `continueOnError`); still recorded in `steps[]` so callers see which actions did not run.
   *  - `'waiting'` — a loop or a path the run parked inside, until it resumes.
   */
  readonly status: 'success' | 'failure' | 'filtered' | 'skipped' | 'waiting'
  readonly error?: string
  /** Whole ms from dispatch to settle, retries included; unset for a step that was not timed. */
  readonly durationMs?: number
  readonly props?: Record<string, unknown>
  readonly output?: Record<string, unknown>
  /** Redacted `context.log` entries of a code step, in call order. */
  readonly logs?: readonly StepLogEntry[]
  /** What the step recorded reading as it ran (`read-tracker.ts`), when it did. */
  readonly reads?: readonly StepRead[]
  /** A `path/branch` step's paths and a `loop/each` step's items, with the steps run inside. */
  readonly paths?: readonly { readonly name: string; readonly steps: readonly ExecutedStep[] }[]
  readonly iterations?: readonly {
    readonly index: number
    readonly steps: readonly ExecutedStep[]
  }[]
}

/** The steps a `path` or a `loop` ran, as its outcome hands them to its step record. */
export type NestedStepRuns = Pick<ExecutedStep, 'paths' | 'iterations'>

/** Accumulator type for `Effect.reduce` over the action list. */
export interface RunAccumulator extends RunClientErrorField {
  readonly steps: ReadonlyArray<ExecutedStep>
  /** Engine-internal run status; `'queued'`/`'running'` only on rows the scheduler persists. */
  readonly runStatus:
    | 'success'
    | 'failure'
    | 'timed-out'
    | 'exhausted'
    | 'completed-with-errors'
    | 'skipped'
    | 'cancelled'
    | 'waiting-approval'
    | 'waiting-delay'
    | 'queued'
    | 'running'
  readonly runError: string | undefined
  /** Per-action `output` collected from each step's `ActionOutcome`. */
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  /** What later steps read beside each output, never recorded (`./step-metadata`). */
  readonly stepMetadata?: StepMetadataMap
  /**
   * Shallow-merged outputs from every step that produced one (later steps
   * win on collisions). Surfaces as `output` in webhook/manual responses;
   * per-step isolation lives in `actions[stepName]` + the runs API
   * Single-step runs behave like "last action's output".
   */
  readonly lastOutput: Record<string, unknown> | undefined
  /**
   * Set true when a filter action returns `status: 'filtered'`: the run loop
   * then skips the later steps without recording them.
   */
  readonly halted: boolean
  /**
   * Last `responseOverride` surfaced by an action handler in this run
   * (last write wins; usually one `webhook/response` per automation). Not
   * persisted; consumed only by the synchronous webhook dispatcher.
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
  /** Set when a wait parked the run: when it resumes, and where (its resume cursor). */
  readonly park?: { readonly resumeAt: number; readonly frames: readonly ResumeFrame[] }
  /** Set when a `flow/stop` with `status: error` ended the run (`runStatus` is then `'failure'`). */
  readonly stopped?: boolean
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
  /** The template engine, read once from the `TemplateEngine` port by the run loop. */
  readonly templates: TemplateRenderer
  /** Identity of the running automation; threaded into each handler call. */
  readonly automation: AutomationContext
  /** The type of the trigger entry that started the run (a `webhook/response` step answers only `webhook`). */
  readonly triggerType: Trigger['type']
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
  /**
   * How many automation writes separate this run from the write a person or
   * an external caller made: 0 for a run a records API write, a webhook, a
   * schedule or a manual trigger started; N+1 for a run a record event of an
   * N-deep run's step started.
   */
  readonly recordEventDepth: number
  /** The record-event channel handed to every step (`action-handlers/shared.ts`). */
  readonly recordEvents: RecordEventChannel
  /** See `ExecuteAutomationRunInput.propsFinal`. */
  readonly propsFinal?: true
  /** A resumed segment: its first action's index in the run, and the container it re-enters. */
  readonly resume?: { readonly base: number; readonly container?: ContainerResume }
}

/** Normalised retry config: concrete `delayMs`; `strategy` `'fixed'` (default) or `'exponential'`. */
export interface ResolvedRetryConfig {
  readonly maxAttempts: number
  readonly delayMs: number
  readonly strategy: 'fixed' | 'exponential'
}

/** Service requirement set shared by the step executor and the retry loop. */
export type StepRequirements =
  | TableRepository
  | RecordWebhookDispatcher
  | AutomationPauseRepository
  | DataSourceRepository // the caller gate a hand-started run's record actions run before writing
  | AutomationStateRepository
  | AutomationDigestRepository
  | AutomationApprovalRepository
  | AuthRepository
  | AuthStepRequirements // the `auth` group, access-grant and invitation operators' services
  | CommentRepository // `comment` steps; record automations a write starts hydrate users too
  | UserDirectoryRepository // the people a comment step's mentions resolve to
  | NotificationRepository // the store a `notification` step writes
  | ConnectionRepository
  | ConnectionTokenRepository
  | SentinelTokens
  | TemplateEngine
  | AnalyticsRepository
  | AiService
  | AiEmbeddingRepository
  | StorageService
  | MediaStepRequirements // the image transform and the audio remux the `file` steps run
  | DocumentRenderer
  | SvgRasterizer
  | PdfToolkit
  | PdfEditor
  | OfficeConverter
  | SpeechService
  | LinkRepository
  | ServerOrigin
  | AuditLogRepository
  | EmailStepRequirements // the sender, and the CSS inliner a templated body runs
  | AiComputeStatusRepository
  | OAuthTokenClient
  | ConfigAccountProvisioner
  | OAuthClientRegistrar
  | InstanceSupervisor
  | AppSelfSeeder // `app/seed`: the seeder `sovrium start` installs
  | BrowserStepRequirements
  | AgentToolRequirements // an `ai:agent` step's tool calls go through the agent's gates

/** Combined service requirement for the run-loop entry points. */
export type RunRequirements =
  | StepRequirements
  | AutomationRepository
  | AutomationRunRepository
  // The failure history the post-run alert and the automatic pause read.
  | AutomationRunOutcomeRepository
  | AutomationFiberBridge // the sandbox's Promise boundary, the background event registry

/**
 * Locally re-typed `app.actions[]` template entry. The runtime invoker only
 * reads `name`, `action` and `variables`; lookup-shaped, the type keeps the
 * encoded-vs-decoded ActionTemplate generics out of the run loop.
 */
export interface RuntimeActionTemplate {
  readonly name: string
  readonly action: Readonly<Record<string, unknown>>
  readonly variables?: Readonly<Record<string, unknown>>
}

/**
 * Result of running an automation. `actions` is retained for run-history
 * persistence; the manual-trigger response exposes only `lastOutput` as
 * `output`; a webhook's default answer is the run id and status. `error` is the first action failure (already redacted).
 *
 * `responseOverride` — when set — is the (status, body, headers) payload
 * a `webhook/response` action emitted via its `ActionOutcome.responseOverride`
 * side-channel. The synchronous webhook dispatcher uses it to override the
 * default sync response. Last-write-wins across multiple `webhook/response`
 * actions in a single run (rare). Not persisted to run-history.
 */
export interface RunAutomationResult extends ClientErrorField {
  readonly runId: string
  /**
   * Engine-internal status:
   *  - `'success'` — every action completed without propagating failure
   *  - `'failure'` — at least one action failed (and lacked `continueOnError`)
   *  - `'timed-out'` — the run loop exceeded `automation.timeout`; persisted
   *    runs surface this status verbatim so callers can distinguish a hard
   *    timeout from a routine failure.
   *  - `'exhausted'` — an action's retry policy was configured (`maxAttempts >
   *    1`) AND all attempts failed; distinct from `'failure'` so callers can
   *    tell a single-shot failure apart from a fully-exhausted retry budget.
   *  - `'completed-with-errors'` — at least one action failed BUT every failing
   *    action declared `continueOnError: true`, so subsequent actions still
   *    executed. Distinguishes "all green" from "partially-degraded green".
   *  - `'skipped'` — a `filter`/`continue` action evaluated false and halted
   *    the run via `onFalse: 'stop'` before any non-filter action completed
   * Surfaces as `'skipped'` on the runs API.
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
    | 'waiting-delay'
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  readonly lastOutput?: Record<string, unknown>
  readonly error?: string
  readonly responseOverride?: Readonly<Record<string, unknown>>
  /**
   * Payload from the run's first `automation:return` action (early-exit), which the
   * `automation:call` invoker hands back as `{ result }`; absent when the callee
   * declared no `return` action (the caller then sees `{ result: {} }`).
   */
  readonly returnData?: Readonly<Record<string, unknown>>
  /** True when an error `flow/stop` ended the run: its answer stands, never escalated to 500. */
  readonly stopped?: boolean
  /** The write-only values the runs it called read: masked in its answer like its own. */
  readonly calledWriteOnly?: readonly string[]
}

/** Inputs for `executeAutomationRun`, shared by every entry point (webhook, manual, record-event…). */
export interface ExecuteAutomationRunInput {
  readonly name: string
  readonly automation: NonNullable<App['automations']>[number]
  /** The entry of `automation.triggers` that started the run: recorded by name, read at `{{trigger.*}}`. */
  readonly trigger: Trigger
  readonly automationId: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  /**
   * A person started this run by hand (a manual trigger, a table or page button, a
   * `session` webhook, an MCP tool): its record actions write AS `userId` under the
   * table's rules. With `startedAsGuest`, a visitor who is not signed in pressed a page
   * button: `userId` is omitted and she acts as the records API lets a visitor. Omitted
   * for a run nobody started (cron, other webhooks, events, forms): the system's.
   */
  readonly startedByHand?: boolean
  readonly startedAsGuest?: boolean
  /**
   * The actions' props are values already filled in once (an action template
   * a caller invoked with arguments, see `fillInvokedTemplateAction`): no step
   * resolves `$env.` or renders `{{...}}` in them again, and each handler takes
   * them as given. Omitted for a run of authored actions.
   */
  readonly propsFinal?: boolean
  /**
   * Call-stack depth for this run. Top-level triggers omit it (treated as
   * 0); nested `automation:call` hops pass `callerDepth + 1`.
   */
  readonly callDepth?: number
  /** See `StepContext.recordEventDepth`; omitted means 0. */
  readonly recordEventDepth?: number
  /**
   * Names of every automation already on the call stack — used by the
   * `automation:call` invoker's cycle guard. Omitted for top-level runs.
   */
  readonly visitedAutomations?: ReadonlySet<string>
  /**
   * Action names the run loop records as `'skipped'` WITHOUT executing (an
   * approval resume, a replay): their side effects already happened once.
   * Undefined / empty: every action runs.
   */
  readonly skipActionNames?: ReadonlySet<string>
  /** Failures `continueOnError` let the skipped steps go past: still `completed-with-errors`. */
  readonly priorTolerated?: number
  /** Step outputs a resumed run starts with, by name: what a skipped step decided (`decision`). */
  readonly seedOutputs?: Readonly<Record<string, Record<string, unknown>>>
  /** The file ledgers a resumed run starts with, restored from its pause; omitted, empty ones. */
  readonly ledgers?: RunLedgers
  /**
   * Set by a resume (the approval resolution): a hand-started run first checks
   * that its starter still stands — not banned, not deleted — and fails before
   * any step otherwise. Omitted: no check (a fresh run's caller holds a session).
   */
  readonly checkStarterStanding?: boolean
  /**
   * Invoked by the scheduler the moment the `'queued'` run row lands, so the
   * async webhook dispatcher (`respondImmediately: true`) can answer 202 with
   * the run id before the loop has finished (the cancel endpoint finds it by
   * id). Omitted: the id surfaces only in the {@link RunAutomationResult}.
   */
  readonly onPersisted?: (runId: string) => void
  /** A called run's inheritance about write-only values (`automation-call-invoker.ts`). */
  readonly writeOnly?: WriteOnlyInheritance
  /**
   * The run that handed this one its trigger data — a call's caller, a failure
   * handler's failed run — or `outside` for a replay an admin supplied new
   * trigger data for. Recorded on the run, so a reader is shown what it was
   * handed only as far as she may read what the feeding run had read. Omitted
   * for every other run.
   */
  readonly relay?: RunRelay
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
  /** Told the id of the run the call started, once it has one. */
  readonly onRun?: (runId: string) => void
}) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>

/** Empty starting accumulator for the action-reduce loop. */
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

/** Cap on any single inter-attempt sleep, so exponential growth cannot wedge a handler. */
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
 * True for a terminal failure: the run loop skips the remaining actions, and a
 * synchronous `automation:call` fails. `'completed-with-errors'` is NOT one —
 * later actions still run past a `continueOnError` failure. `'timed-out'`
 * comes only from the outer timeout wrapper, never the per-step loop.
 */
export const isTerminalFailureStatus = (status: RunAccumulator['runStatus']): boolean =>
  status === 'failure' || status === 'exhausted' || status === 'cancelled' || status === 'timed-out'

export { MAX_ERROR_LENGTH, truncateError } from './error-truncation'
