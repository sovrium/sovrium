/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- This file orchestrates the entire automation run lifecycle (resolve → expand → reduce-with-fold → persist → record) and crossing a 400-LOC limit is the natural cost of keeping the persistence + dispatch contract identical across every entry point (webhook / manual / record-event / cron). Splitting further would require duplicating the type-thread boilerplate (RunRequirements / ExecuteAutomationRunInput) without reducing complexity. */

import { Duration, Effect } from 'effect'
import {
  AutomationRepository,
  type AutomationDatabaseError,
} from '@/application/ports/repositories/automation-repository'
import { AutomationRunRepository } from '@/application/ports/repositories/automation-run-repository'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import {
  actionKey,
  defaultActionHandlers,
  noopActionHandler,
  type ActionHandler,
  type ActionKey,
  type ActionOutcome,
  type AutomationContext,
} from './action-handlers'
import { applyTemplateVars, expandRefActions, type ActionTemplateLike } from './expand-action-refs'
import { notifyPlatformFailure } from './notify-platform-failure'
import { redactSecretsForApp } from './redact-secrets'
import { buildEnvLookup, resolveEnvInValue } from './resolve-env-vars'
import {
  buildAutomationContext,
  resolveTriggerInValue,
  type TriggerData,
} from './resolve-trigger-data'
import { recordAutomationRun, type AutomationRunRecord } from './run-history-store'
import type { AutomationDigestRepository } from '@/application/ports/repositories/automation-digest-repository'
import type { AutomationStateRepository } from '@/application/ports/repositories/automation-state-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connection-token-repository'
import type { TableRepository } from '@/application/ports/repositories/table-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'
import type { PackageResolver } from '@/infrastructure/automations/package-resolver'

/**
 * Step record retained in run history.
 *
 * Mirrors `AutomationRunRecord['steps'][number]` so the run loop can build
 * an array of these directly without reshaping at the end. `output` is the
 * action handler's `outcome.output` — needed by the runs detail endpoint
 * (DEC-021) so callers wanting per-step outputs (intermediate-step
 * assertions in multi-action regressions) can read them from the steps[]
 * array in `GET /api/automations/runs/:id`.
 */
interface ExecutedStep {
  readonly name: string
  readonly type: string
  readonly operator?: string
  /**
   * Per-step terminal status:
   *  - `'success'` — handler returned `outcome.status === 'success'`
   *  - `'failure'` — handler returned `outcome.status === 'failure'` (whether or
   *    not the action declared `continueOnError`)
   *  - `'skipped'` — the run loop short-circuited before this step ran because
   *    an earlier step propagated a failure (no `continueOnError`). The step
   *    is still recorded in `steps[]` so callers can observe which actions
   *    were intentionally not executed — APP-AUTOMATION-RETRY-012.
   */
  readonly status: 'success' | 'failure' | 'skipped'
  readonly error?: string
  readonly props?: Record<string, unknown>
  readonly output?: Record<string, unknown>
}

/**
 * Result of running an automation. `actions` is retained for run-history
 * persistence; the public trigger response exposes only `lastOutput` as
 * `output` (DEC-021). `error` is the first action failure (already redacted).
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
   *    timeout from a routine failure (APP-AUTOMATION-RETRY-006..008).
   *  - `'exhausted'` — an action's retry policy was configured (`maxAttempts >
   *    1`) AND all attempts failed; distinct from `'failure'` so callers can
   *    tell a single-shot failure apart from a fully-exhausted retry budget
   *    (APP-AUTOMATION-RETRY-009..011).
   *  - `'completed-with-errors'` — at least one action failed BUT every failing
   *    action declared `continueOnError: true`, so subsequent actions still
   *    executed. Distinguishes "all green" from "partially-degraded green"
   *    (APP-AUTOMATION-RETRY-014).
   */
  readonly status: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
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
 * Errors surfaced to the caller. `not-found` covers both "no automation by
 * that name" and "the automation is not webhook-triggered" — both should
 * result in a 4xx so the test can distinguish a triggered run from a noop.
 *
 * `AutomationRegistrySeedError` is raised when the lazy seed of
 * `system.automation_definitions` fails (DB unavailable, constraint
 * violation, etc.); the route maps it to a 500.
 */
export type RunAutomationError =
  | { readonly _tag: 'AutomationNotFound'; readonly name: string }
  | { readonly _tag: 'AutomationNotWebhookTriggered'; readonly name: string }
  | { readonly _tag: 'AutomationNotManualTriggered'; readonly name: string }
  | {
      readonly _tag: 'AutomationManualRoleRequired'
      readonly name: string
      readonly required: string
    }
  | { readonly _tag: 'AutomationRegistrySeedError'; readonly name: string; readonly cause: unknown }

/**
 * Accumulator type for `Effect.reduce` over the action list.
 */
interface RunAccumulator {
  readonly steps: ReadonlyArray<ExecutedStep>
  readonly runStatus: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
  readonly runError: string | undefined
  /** Per-action `output` collected from each step's `ActionOutcome`. */
  readonly actions: Readonly<Record<string, Record<string, unknown>>>
  /**
   * Shallow-merged outputs from every step that produced one (later steps
   * win on collisions). Surfaces as `output` in webhook/manual responses;
   * per-step isolation lives in `actions[stepName]` + the runs API
   * (DEC-021). Single-step runs behave like "last action's output".
   */
  readonly lastOutput: Record<string, unknown> | undefined
  /**
   * Set true when a filter action returns `status: 'filtered'`. Causes
   * the run loop to short-circuit subsequent steps without recording
   * them — matches APP-AUTOMATION-ACTION-FILTER-CONTINUE-001's
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
 * Per-step context passed to {@link executeStep}. Bundles the inputs that
 * stay constant across steps so the inner generator stays compact.
 */
interface StepContext {
  readonly app: App
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
 *
 * Per-attempt delay is computed in {@link retryDelayMs} and applied in
 * {@link dispatchWithRetry}.
 */
interface ResolvedRetryConfig {
  readonly maxAttempts: number
  readonly delayMs: number
  readonly strategy: 'fixed' | 'exponential'
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
 * Compute the delay (ms) before retry attempt `retryIndex` (1-indexed: the
 * 1st retry after the initial attempt). `'exponential'` doubles each step;
 * `'fixed'` is constant. Capped at {@link MAX_RETRY_DELAY_MS}.
 */
const retryDelayMs = (retry: ResolvedRetryConfig, retryIndex: number): number => {
  const base = retry.delayMs > 0 ? retry.delayMs : DEFAULT_RETRY_DELAY_MS
  const raw = retry.strategy === 'exponential' ? base * 2 ** Math.max(0, retryIndex - 1) : base
  return Math.min(raw, MAX_RETRY_DELAY_MS)
}

/**
 * Coerce a raw `retry` object (from `automation.retry` or `action.retry`)
 * into the {@link ResolvedRetryConfig} shape, or undefined if the input is
 * not a usable retry config. `maxAttempts` is the only required field; an
 * absent `delayMs` resolves to 0.
 */
const toResolvedRetry = (raw: unknown): ResolvedRetryConfig | undefined => {
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
const resolveRetryForAction = (
  rawAction: Readonly<Record<string, unknown>>,
  automationRetry: ResolvedRetryConfig | undefined
): ResolvedRetryConfig | undefined => {
  const actionRetry = toResolvedRetry(rawAction['retry'])
  return actionRetry ?? automationRetry
}

/**
 * Sleep for `ms` milliseconds inside an Effect. A 0ms delay short-circuits
 * to a no-op so retry-with-no-delay paths (a per-action `{ maxAttempts: N }`
 * override) don't pay the scheduler round-trip — keeps the E2E specs fast.
 */
const sleepEffect = (ms: number): Effect.Effect<void> =>
  ms <= 0 ? Effect.void : Effect.sleep(Duration.millis(ms))

const cryptoRandomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `run-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}

/**
 * Cap on `error` field length surfaced to the trigger response and
 * persisted to `system.automation_runs.error` — guards against a
 * misbehaving upstream inflating run-history payloads (REC-C3-5).
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
 * REC-C3-6: connection literals are now scrubbed alongside env values,
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
 * Build an `ExecutedStep` from a raw action and its dispatch outcome.
 *
 * Redacts props (and any error string) BEFORE the record is appended to
 * history so secrets cannot leak into run logs (APP-AUTOMATION-ENVIRONMENT-004).
 */
const buildStep = (
  rawAction: Readonly<Record<string, unknown>>,
  resolvedProps: Readonly<Record<string, unknown>>,
  outcome: ActionOutcome,
  ctx: StepContext
): ExecutedStep => {
  const stepOperator = rawAction['operator'] as string | undefined
  const redactedProps = redactSecretsForApp(
    resolvedProps,
    ctx.app.env,
    ctx.processEnv,
    connectionsForRedaction(ctx.app)
  ) as Record<string, unknown>

  // `outcome.status` is `'success' | 'failure' | 'filtered'`, but
  // `'filtered'` outcomes are short-circuited in `foldOutcome` before
  // `buildStep` is ever called (filtered steps are omitted from `steps[]`
  // — see APP-AUTOMATION-ACTION-FILTER-CONTINUE-001). Narrow the type
  // here so `ExecutedStep.status` stays the public contract `'success' |
  // 'failure' | 'skipped'` without leaking the engine-internal halt signal.
  // (`'skipped'` is only set by {@link buildSkippedStep}; never by buildStep.)
  const stepStatus: 'success' | 'failure' = outcome.status === 'failure' ? 'failure' : 'success'
  return {
    name: String(rawAction['name'] ?? ''),
    type: String(rawAction['type'] ?? ''),
    ...(stepOperator !== undefined ? { operator: stepOperator } : {}),
    status: stepStatus,
    ...(outcome.error !== undefined
      ? { error: redactString(outcome.error, ctx.app, ctx.processEnv) }
      : {}),
    props: redactedProps,
    ...(outcome.output !== undefined ? { output: outcome.output as Record<string, unknown> } : {}),
  }
}

/**
 * Execute one action: resolve `$env.VAR` references in its props, dispatch
 * to the registered handler, and fold the outcome into the accumulator.
 */
/**
 * Locally re-typed `app.actions[]` template entry. The runtime invoker
 * only reads `name`, `action`, and `variables` — keeping the type
 * lookup-shaped here avoids dragging the encoded-vs-decoded ActionTemplate
 * generics into the run loop.
 */
interface RuntimeActionTemplate {
  readonly name: string
  readonly action: Readonly<Record<string, unknown>>
  readonly variables?: Readonly<Record<string, unknown>>
}

const findTemplate = (app: App, name: string): RuntimeActionTemplate | undefined =>
  (app.actions as unknown as ReadonlyArray<RuntimeActionTemplate> | undefined)?.find(
    (t) => t.name === name
  )

/**
 * Resolve a template-substituted action body for handler dispatch.
 * `code` actions skip the trigger-template pass — their inner sandbox
 * re-resolves `inputData` against its own context. All other action
 * types get `{{trigger.X}}` and `$env.X` resolution before the handler
 * sees them, matching top-level-step behaviour.
 */
const resolveActionPropsForDispatch = (
  action: Readonly<Record<string, unknown>>,
  ctx: StepContext
): Record<string, unknown> => {
  const isCode = String(action['type'] ?? '') === 'code'
  const subProps = (action['props'] as Record<string, unknown> | undefined) ?? {}
  const subWithTriggers = isCode
    ? subProps
    : (resolveTriggerInValue(subProps, ctx.templateContext) as Record<string, unknown>)
  return resolveEnvInValue(subWithTriggers, ctx.envLookup) as Record<string, unknown>
}

/**
 * Shared "dispatch one action via the handler registry, return its
 * outcome.output as a Promise" helper. Used by BOTH the template
 * invoker (`context.actions.ref(...)`) AND the native-action invoker
 * (`context.actions.<type>.<op>(...)`). Threads the same
 * `invocationStack` through both invokers in the sub-runContext so
 * cross-cutting cycle detection works regardless of whether each level
 * is template- or native-flavoured.
 */
interface DispatchActionInput {
  readonly action: Readonly<Record<string, unknown>>
  readonly resolvedProps: Record<string, unknown>
  readonly ctx: StepContext
  readonly acc: RunAccumulator
  readonly invocationStack: ReadonlySet<string>
  readonly failureLabel: string
}

const dispatchActionAsPromise = (input: DispatchActionInput): Promise<unknown> => {
  const { action, resolvedProps, ctx, acc, invocationStack, failureLabel } = input
  const handlerKey = actionKey(
    String(action['type'] ?? ''),
    action['operator'] as string | undefined
  )
  const handler = ctx.handlers.get(handlerKey) ?? noopActionHandler
  const subRunContext = {
    previousSteps: acc.actions,
    triggerData: ctx.triggerData,
    rawAction: action,
    envLookup: ctx.envLookup,
    invokeTemplate: buildTemplateInvoker(ctx, acc, invocationStack),
    invokeNativeAction: buildNativeActionInvoker(ctx, acc, invocationStack),
  }
  const program = handler(
    { ...action, props: resolvedProps },
    ctx.app,
    ctx.automation,
    subRunContext
  )
  return Effect.runPromise(provideAutomationRuntime(program)).then((outcome) => {
    if (outcome.status === 'failure') {
      // eslint-disable-next-line functional/no-throw-statements -- inside .then; throw-as-rejection is the unicorn-preferred form
      throw new Error(outcome.error ?? `${failureLabel} failed`)
    }
    return outcome.output
  })
}

/**
 * Build a template-invocation dispatcher for the code sandbox's
 * `context.actions.ref('<name>', vars)` proxy method. Looks up the
 * named template in `app.actions[]`, applies caller-supplied `vars`
 * over declared `variables` defaults, dispatches the resulting concrete
 * action through the shared {@link dispatchActionAsPromise} helper,
 * and resolves with the handler's `outcome.output`.
 *
 * The proxy semantics intentionally do NOT reach sibling steps: prior
 * step outputs flow into `code` actions only via the explicit
 * `inputData` template-resolution surface (`{{steps.X.Y}}` → resolved
 * before the sandbox sees it). This keeps the code action a pure
 * function of its declared inputs.
 *
 * Cycle detection: an `invocationStack` tracks templates currently
 * mid-invocation; calling a template already on the stack rejects with
 * a path-listing error so transitive recursion (template A's code
 * calls B which calls A) cannot run away.
 */
const buildTemplateInvoker = (
  ctx: StepContext,
  acc: RunAccumulator,
  invocationStack: ReadonlySet<string>
): ((name: string, vars?: Readonly<Record<string, unknown>>) => Promise<unknown>) => {
  return (templateName, vars) => {
    if (invocationStack.has(templateName)) {
      const path = [...invocationStack, templateName].join(' → ')
      return Promise.reject(new Error(`action template cycle detected: ${path}`))
    }
    const template = findTemplate(ctx.app, templateName)
    if (template === undefined) {
      return Promise.reject(
        new Error(
          `action template '${templateName}' is not defined in app.actions[]. Declare it at the schema root before calling context.actions.ref('${templateName}', ...).`
        )
      )
    }
    const substituted = applyTemplateVars(template, vars) as Record<string, unknown>
    const resolvedProps = resolveActionPropsForDispatch(substituted, ctx)
    const newStack = new Set([...invocationStack, templateName])
    return dispatchActionAsPromise({
      action: substituted,
      resolvedProps,
      ctx,
      acc,
      invocationStack: newStack,
      failureLabel: `template '${templateName}'`,
    })
  }
}

/**
 * Build a native-action dispatcher for the code sandbox's
 * `context.actions.<actionType>.<operator>(props)` proxy. Synthesises
 * a concrete action object on the fly (no template required), resolves
 * env templates in props, and dispatches through the shared
 * {@link dispatchActionAsPromise} helper.
 *
 * Native dispatch never grows the cycle-detection stack on its own —
 * a native call is a single handler invocation that does not recurse
 * into the template registry. The stack is still THREADED through so
 * if a native action's handler is itself a `code` action whose body
 * invokes a template, the outer invocation stack remains visible to
 * the template invoker.
 */
const buildNativeActionInvoker = (
  ctx: StepContext,
  acc: RunAccumulator,
  invocationStack: ReadonlySet<string>
): ((
  type: string,
  operator: string,
  props?: Readonly<Record<string, unknown>>
) => Promise<unknown>) => {
  return (type, operator, props) => {
    const handlerKey = actionKey(type, operator)
    if (!ctx.handlers.has(handlerKey)) {
      return Promise.reject(
        new Error(
          `native action '${type}.${operator}' is not registered. Declare a template at app.actions[] referencing the desired action, or check the type/operator spelling.`
        )
      )
    }
    const synthetic: Record<string, unknown> = {
      name: `inline:${type}.${operator}`,
      type,
      operator,
      props: props ?? {},
    }
    const resolvedProps = resolveActionPropsForDispatch(synthetic, ctx)
    return dispatchActionAsPromise({
      action: synthetic,
      resolvedProps,
      ctx,
      acc,
      invocationStack,
      failureLabel: `native action '${type}.${operator}'`,
    })
  }
}

/**
 * Service requirement set shared by {@link executeStep} and the retry loop.
 */
type StepRequirements =
  | TableRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | PackageResolver
  | AiService
  | StorageService

/**
 * Invoke an action's handler, retrying on failure per the action's resolved
 * retry policy. On a successful attempt the outcome is returned unchanged.
 * On a final failure (all attempts exhausted) the failing outcome is
 * augmented with `output: { ...outcome.output, retryCount }` so callers can
 * observe how many retries were performed (read from the runs detail API or
 * the trigger response's `output`). When no retry config applies the handler
 * is invoked exactly once and its outcome returned verbatim.
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
  return Effect.timeoutTo(invocation, {
    duration: Duration.millis(timeoutMs),
    onSuccess: (outcome): ActionOutcome => outcome,
    onTimeout: (): ActionOutcome => ({
      status: 'failure',
      error: `action '${stepName}' timed out after ${String(timeoutMs)}ms`,
    }),
  })
}

/**
 * A single attempt record captured by {@link dispatchWithRetry}. Surfaced on
 * the action's outcome `output.attempts` so the runs-by-name endpoint can
 * expose per-attempt history at `run.attempts[]` for retry-exhaustion specs
 * (APP-AUTOMATION-RETRY-010).
 */
interface AttemptRecord {
  readonly attemptNumber: number
  readonly timestamp: string
  readonly error?: string
}

/** Per-iteration accumulator inside {@link dispatchWithRetry}'s reduce. */
interface RetryReducerState {
  readonly outcome: ActionOutcome
  readonly retryCount: number
  readonly attempts: ReadonlyArray<AttemptRecord>
}

const buildAttemptRecord = (outcome: ActionOutcome, attemptNumber: number): AttemptRecord => ({
  attemptNumber,
  timestamp: new Date().toISOString(),
  ...(outcome.error !== undefined ? { error: outcome.error } : {}),
})

/**
 * Run one retry attempt: sleep per the retry strategy, invoke the handler,
 * append the new attempt to the accumulator. Skips the work when a prior
 * iteration already succeeded (the reduce loop walks a fixed length).
 *
 * `invoke` accepts the 1-indexed attempt number so handlers (notably the
 * code action) can surface it on the sandbox context as `run.attempt` —
 * APP-AUTOMATION-RETRY-015.
 */
const stepRetry = (
  state: RetryReducerState,
  retryIndex: number,
  retry: ResolvedRetryConfig,
  invoke: (attempt: number) => Effect.Effect<ActionOutcome, never, StepRequirements>
): Effect.Effect<RetryReducerState, never, StepRequirements> =>
  state.outcome.status !== 'failure'
    ? Effect.succeed(state)
    : sleepEffect(retryDelayMs(retry, retryIndex)).pipe(
        // `retryIndex` is 1-indexed by `dispatchWithRetry`'s `Array.from`
        // expression; attempt 1 was the first invocation, so the Nth
        // retry is attempt N+1.
        Effect.zipRight(invoke(retryIndex + 1)),
        Effect.map((next) => ({
          outcome: next,
          retryCount: state.retryCount + 1,
          attempts: [...state.attempts, buildAttemptRecord(next, state.attempts.length + 1)],
        }))
      )

/**
 * Project the final reducer state into the augmented outcome surfaced to
 * the run loop. Carries `attempts`, `retryCount`, and (on final failure
 * with `maxAttempts > 1`) the `exhausted: true` marker that lets the run
 * loop set `runStatus: 'exhausted'` instead of `'failure'`
 * (APP-AUTOMATION-RETRY-009).
 */
const projectRetryResult = (
  result: RetryReducerState,
  retry: ResolvedRetryConfig
): ActionOutcome => {
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
      retryCount: result.retryCount,
      attempts: result.attempts,
      ...(isExhausted ? { exhausted: true } : {}),
    },
  }
}

const dispatchWithRetry = (input: {
  readonly handler: ActionHandler
  readonly action: Readonly<Record<string, unknown>>
  readonly app: App
  readonly automation: AutomationContext
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
    const first = yield* invoke(1)
    if (first.status !== 'failure' || retry === undefined) return first
    // `maxAttempts` is the cap on TOTAL attempts; we already consumed one,
    // so the loop body runs at most `maxAttempts - 1` more times. With
    // `maxAttempts: 1` the loop body never runs (0 retries).
    const maxRetries = Math.max(0, retry.maxAttempts - 1)
    const initial: RetryReducerState = {
      outcome: first,
      retryCount: 0,
      attempts: [buildAttemptRecord(first, 1)],
    }
    const result = yield* Effect.reduce(
      Array.from({ length: maxRetries }, (_v, i) => i + 1),
      initial,
      (state, retryIndex) => stepRetry(state, retryIndex, retry, invoke)
    )
    return projectRetryResult(result, retry)
  })

const executeStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>,
  ctx: StepContext
): Effect.Effect<RunAccumulator, never, StepRequirements> =>
  Effect.gen(function* () {
    // Code actions skip global trigger pass — sandbox re-resolves inputData itself.
    const props = rawAction['props'] ?? {}
    const isCode = String(rawAction['type'] ?? '') === 'code'
    // Non-code actions get prior step outputs exposed at `{{steps.X.Y}}`
    // in their props (e.g. `automation:return`'s `data` referencing
    // `{{steps.charge.transactionId}}`); the code sandbox already exposes
    // `context.steps.X` via its own internal context, so it skips this.
    const stepTemplateContext = isCode
      ? ctx.templateContext
      : { ...ctx.templateContext, steps: acc.actions }
    const subst = isCode ? props : resolveTriggerInValue(props, stepTemplateContext)
    const resolvedProps = resolveEnvInValue(subst, ctx.envLookup) as Record<string, unknown>
    const handler =
      ctx.handlers.get(
        actionKey(String(rawAction['type'] ?? ''), rawAction['operator'] as string | undefined)
      ) ?? noopActionHandler
    const runContext = {
      previousSteps: acc.actions,
      triggerData: ctx.triggerData,
      rawAction,
      envLookup: ctx.envLookup,
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
  })

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
  // Filtered steps don't appear in steps[]; subsequent steps short-circuit
  // via acc.halted in the Effect.reduce loop. APP-AUTOMATION-ACTION-FILTER-
  // CONTINUE-001 accepts either "step omitted" or "step recorded as
  // filtered/skipped" — we choose omission for the cleanest run-history.
  if (outcome.status === 'filtered') {
    return { ...acc, halted: true }
  }
  return appendStepToAccumulator({ acc, rawAction, resolvedProps, outcome, ctx })
}

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
 * APP-AUTOMATION-ACTION-COMMON-002.
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
  out: Record<string, unknown> | undefined
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
 * Append a step's outcome to the accumulator, recording status/error/output
 * fields. Extracted from {@link foldOutcome} to keep complexity under the
 * project cap once the `'filtered'` branch was added (one extra status level
 * pushed the original function to 11; the cap is 10).
 */
/**
 * Decide the new run-level status when an action propagates a failure.
 * `'exhausted'` wins over `'failure'`: an action that consumed its full
 * retry budget marks the run as exhausted (distinct terminal status —
 * APP-AUTOMATION-RETRY-009). The marker is `outcome.output.exhausted`,
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
 *     state, in which case we preserve that). APP-AUTOMATION-RETRY-014.
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
 * Build a `'skipped'` step record for an action that was never executed
 * because a previous step propagated a failure. Records the action's
 * identifying metadata (name/type/operator) but omits `props`/`output`/`error`
 * — the action never ran, so there is nothing to surface. Used by the
 * post-failure short-circuit in {@link runActionsWithTimeout} so callers can
 * see every action's terminal state, not just those that executed.
 *
 * APP-AUTOMATION-RETRY-012: "when action N fails actions before N show
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
const appendSkippedStep = (
  acc: RunAccumulator,
  rawAction: Readonly<Record<string, unknown>>
): RunAccumulator => ({
  ...acc,
  steps: [...acc.steps, buildSkippedStep(rawAction)],
})

/**
 * True when an earlier step has already propagated a failure that should
 * short-circuit the remaining actions in the run. `'failure'` and
 * `'exhausted'` halt the loop; `'completed-with-errors'` does NOT (its
 * defining property is that subsequent actions still run after a
 * `continueOnError` failure). `'timed-out'` is produced only by the
 * outer timeout wrapper, never reaches the per-step loop.
 */
const isTerminalFailureStatus = (status: RunAccumulator['runStatus']): boolean =>
  status === 'failure' || status === 'exhausted'

/**
 * Options bag for {@link runWebhookAutomation}. Consolidating into a single
 * object keeps the function call-site readable as the run loop accumulates
 * concerns over the migration specs (trigger data, custom handler registry,
 * future: cancellation signal, telemetry sink, etc.) and stays under the
 * `max-params` lint threshold.
 */
export interface RunWebhookAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Trigger payload visible to actions through `{{trigger.data.X}}`. Defaults
   * to an empty object — actions that reference webhook fields will see
   * undefined for missing keys.
   */
  readonly triggerData?: TriggerData
  /**
   * Action-handler registry. Defaults to `defaultActionHandlers`; passing a
   * custom registry is how migration specs in waves 2–4 will add new action
   * types without touching this file.
   */
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  /**
   * The user id of the caller who triggered this automation (e.g. the
   * webhook session's user). Threaded into the per-step
   * `AutomationContext` so handlers that resolve per-user state (OAuth2
   * token injection in `http/request`) can find the right row.
   * Undefined for system-triggered automations (cron, automation-call).
   */
  readonly userId?: string
}

/**
 * Execute a webhook-triggered automation by name.
 *
 * The contract that the migration specs depend on:
 *   1. Resolve `$env.VAR_NAME` references in each action's props before exec.
 *   2. Dispatch each action to its registered handler (registry-based).
 *   3. Redact env values from props AND error messages BEFORE persisting.
 *   4. Append the resulting record to in-memory run-history.
 *
 * Returns an Effect requiring `TableRepository` (for record-creating actions);
 * the route handler provides this via the established `provideAutomationLive`
 * adapter so this use case stays free of infrastructure imports.
 */
/**
 * Locate a webhook-triggered automation by name and reject any state that
 * should not produce a run (missing, disabled, or non-webhook). Centralised
 * so the run loop can stay focused on execution.
 */
const resolveWebhookAutomation = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  // Disabled automations are invisible to the webhook router — return
  // not-found so an attacker cannot enumerate which workflows exist
  // (APP-AUTOMATION-DEFINITION-006).
  if (automation.enabled === false)
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.trigger.type !== 'webhook') {
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

/**
 * Expand `$ref` actions against `app.actions[]` BEFORE the run loop —
 * the dispatch registry never sees the synthetic ref shape, only the
 * template's underlying record/http/email action with `$varName`
 * placeholders already substituted from `$vars`
 * (APP-AUTOMATION-DEFINITION-009).
 */
const expandAutomationActions = (
  app: App,
  automation: NonNullable<App['automations']>[number]
): readonly Record<string, unknown>[] =>
  expandRefActions(
    automation.actions as readonly unknown[] as readonly Record<string, unknown>[],
    (app.actions ?? []) as readonly unknown[] as ReadonlyArray<ActionTemplateLike>
  ) as readonly Record<string, unknown>[]

/**
 * Combined service requirement for `runWebhookAutomation`. Aliased so the
 * function signature stays one line (max-lines-per-function compliance).
 */
type RunRequirements =
  | TableRepository
  | AutomationRepository
  | AutomationRunRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | PackageResolver
  | AiService
  | StorageService

/**
 * Map the engine's internal status to the public API status enum exposed
 * via `system.automation_runs.status` and the runs API. `'timed-out'`
 * propagates verbatim — the runs API contract surfaces it as a distinct
 * terminal status alongside `'completed'` and `'failed'` so callers can
 * tell a hard timeout from a routine failure (APP-AUTOMATION-RETRY-008).
 *
 * The richer enum (pending/running/skipped/cancelled/etc.) is reserved
 * for future migration specs that grow more execution states.
 */
const toApiStatus = (
  engineStatus: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
): 'completed' | 'failed' | 'timed-out' | 'exhausted' | 'completed-with-errors' => {
  if (engineStatus === 'success') return 'completed'
  if (engineStatus === 'timed-out') return 'timed-out'
  if (engineStatus === 'exhausted') return 'exhausted'
  if (engineStatus === 'completed-with-errors') return 'completed-with-errors'
  return 'failed'
}

/**
 * Map an engine step's status to the API step status enum. The DB column is
 * plain `text` (no CHECK constraint); per-step `'skipped'` is propagated
 * verbatim so the persisted shape matches the in-memory shape — APP-AUTOMATION-
 * RETRY-012 reads step status directly via `findRunSteps`.
 */
const toApiStepStatus = (
  engineStatus: 'success' | 'failure' | 'skipped'
): 'completed' | 'failed' | 'skipped' => {
  if (engineStatus === 'success') return 'completed'
  if (engineStatus === 'skipped') return 'skipped'
  return 'failed'
}

/**
 * Persist a completed run + its steps to `system.automation_runs` via the
 * repository port. Failures are logged but never propagated — a DB outage
 * must not 500 a webhook request after the run succeeded; the in-memory
 * run-history-store remains the fallback observation channel.
 *
 * Returns the persisted run UUID on success (so callers can use the FK as
 * the canonical `runId` returned to the API), or undefined when persistence
 * failed (callers fall back to the in-memory id).
 */
const persistRun = (input: {
  readonly automationId: string
  readonly engineStatus: 'success' | 'failure' | 'timed-out' | 'exhausted' | 'completed-with-errors'
  readonly engineError: string | undefined
  readonly triggerData: TriggerData
  readonly startedAt: Date
  readonly finishedAt: Date
  readonly steps: ReadonlyArray<ExecutedStep>
}): Effect.Effect<string | undefined, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.either(
      repo.create({
        automationId: input.automationId,
        status: toApiStatus(input.engineStatus),
        triggerData: input.triggerData as unknown,
        startedAt: input.startedAt,
        completedAt: input.finishedAt,
        durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
        ...(input.engineError !== undefined ? { error: input.engineError } : {}),
        steps: input.steps.map((step, index) => ({
          actionName: step.name,
          stepIndex: index,
          status: toApiStepStatus(step.status),
          ...(step.props !== undefined ? { input: step.props as unknown } : {}),
          ...(step.output !== undefined ? { output: step.output as unknown } : {}),
          startedAt: input.startedAt,
          completedAt: input.finishedAt,
          ...(step.error !== undefined ? { error: step.error } : {}),
        })),
      })
    )
    if (result._tag === 'Left') {
      // Belt-and-braces: a failed persist must not fail the run. Log so
      // operators can detect the divergence between in-memory history and DB.
      console.error('[automation] failed to persist run to DB', result.left)
      return undefined
    }
    return result.right.id
  })

/**
 * Resolve the automation's `system.automation_definitions.id` lazily — if
 * the row already exists (seeded by a previous trigger), return it; if
 * absent, create it idempotently. Errors propagate as
 * `AutomationRegistrySeedError`.
 *
 * Exported so other entry-point modules (e.g. `run-manual-automation.ts`)
 * can resolve the id with the same idempotent semantics rather than
 * duplicating the find-then-create dance.
 */
export const resolveAutomationId = (
  name: string,
  automation: NonNullable<App['automations']>[number]
): Effect.Effect<string, RunAutomationError, AutomationRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRepository
    const seedFailed = (cause: Readonly<AutomationDatabaseError>) =>
      ({ _tag: 'AutomationRegistrySeedError' as const, name, cause }) satisfies RunAutomationError

    const existing = yield* repo.findByName(name).pipe(Effect.mapError(seedFailed))
    if (existing !== undefined && typeof existing['id'] === 'string') {
      return existing['id']
    }

    const created = yield* repo
      .create({
        name,
        trigger: automation.trigger as unknown as Record<string, unknown>,
        actions: automation.actions as unknown as readonly Record<string, unknown>[],
        enabled: automation.enabled ?? true,
      })
      .pipe(Effect.mapError(seedFailed))
    if (typeof created['id'] !== 'string') {
      return yield* Effect.fail({
        _tag: 'AutomationRegistrySeedError' as const,
        name,
        cause: new Error('AutomationRepository.create returned a row without an id'),
      } satisfies RunAutomationError)
    }
    return created['id']
  })

/**
 * Build a `StepContext` for the run loop.
 */
const buildStepContext = (input: {
  readonly name: string
  readonly automationId: string
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  readonly callDepth?: number
  readonly visitedAutomations?: ReadonlySet<string>
}): StepContext => {
  const { name, automationId, app, automation, processEnv, triggerData, handlers, userId } = input
  const callDepth = input.callDepth ?? 0
  const visited = input.visitedAutomations ?? new Set<string>()
  return {
    app,
    envLookup: buildEnvLookup(app.env, processEnv),
    processEnv,
    handlers,
    templateContext: buildAutomationContext(triggerData),
    automation: { name, id: automationId, ...(userId !== undefined ? { userId } : {}) },
    triggerData: triggerData as Readonly<Record<string, unknown>>,
    automationRetry: toResolvedRetry(automation.retry),
    callDepth,
    visitedAutomations: new Set([...visited, name]),
  }
}

/**
 * Append the completed run to the in-memory run-history-store. Kept as a
 * separate helper so the main loop stays under the lines-per-function cap.
 */
const recordInMemoryRun = (input: {
  readonly runId: string
  readonly name: string
  readonly startedAt: string
  readonly finishedAt: string
  readonly finalState: RunAccumulator
}): void => {
  const { runId, name, startedAt, finishedAt, finalState } = input
  const run: AutomationRunRecord = {
    id: runId,
    automationName: name,
    startedAt,
    finishedAt,
    status: finalState.runStatus,
    steps: finalState.steps,
    ...(finalState.runError !== undefined ? { error: finalState.runError } : {}),
  }
  recordAutomationRun(run)
}

/**
 * Inputs for {@link executeAutomationRun}. Reused across entry points
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
   * executing. Used by the replay endpoint (APP-AUTOMATION-RETRY-013) so a
   * resumed run preserves the previously-successful side-effects of those
   * steps without re-running them — a record/create that fired in the
   * original run is NOT fired again on replay (no duplicate insert).
   *
   * Undefined / empty set means "execute every action normally" (the
   * default top-level run shape).
   */
  readonly skipActionNames?: ReadonlySet<string>
}

/**
 * Combined service requirement for {@link executeAutomationRun}. Exported
 * so other entry points (e.g. record-event triggers) can declare the
 * exact same requirement set.
 */
export type ExecuteAutomationRunRequirements = RunRequirements

/**
 * Execute the action list for a previously-resolved automation, persist the
 * run + step rows to DB, and append to the in-memory run-history-store.
 *
 * This is the shared loop used by every entry point (webhook, manual,
 * record-event, etc.) so the persistence and dispatch contract is identical
 * regardless of how the automation was triggered.
 */
const EMPTY_RUN_ACCUMULATOR: RunAccumulator = {
  steps: [],
  runStatus: 'success',
  runError: undefined,
  actions: {},
  lastOutput: undefined,
  halted: false,
  responseOverride: undefined,
  returnData: undefined,
}

/** Project a {@link RunAccumulator} into the public {@link RunAutomationResult}. */
const buildRunResult = (runId: string, finalState: RunAccumulator): RunAutomationResult => ({
  runId,
  status: finalState.runStatus,
  actions: finalState.actions,
  ...(finalState.lastOutput !== undefined ? { lastOutput: finalState.lastOutput } : {}),
  ...(finalState.runError !== undefined ? { error: finalState.runError } : {}),
  ...(finalState.responseOverride !== undefined
    ? { responseOverride: finalState.responseOverride }
    : {}),
  ...(finalState.returnData !== undefined ? { returnData: finalState.returnData } : {}),
})

/**
 * Resolve the per-run timeout (top-level `automation.timeout`). Schema
 * gates the range 1_000 – 900_000 ms; here we trust the value.
 */
const resolveRunTimeoutMs = (
  automation: NonNullable<App['automations']>[number]
): number | undefined => {
  const raw = (automation as { readonly timeout?: number }).timeout
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : undefined
}

/**
 * Run the action-reduce loop with an optional automation-level timeout.
 * When `automation.timeout` is configured and the loop exceeds it, the
 * resolved accumulator is marked with `runStatus: 'timed-out'` and an
 * explanatory `runError`. Any steps that completed BEFORE the timeout
 * remain in `finalState.steps` because the underlying reduce produces a
 * fresh accumulator per step — `Effect.timeoutTo` only fires after the
 * cumulative duration, so partially-completed runs are not observable
 * from inside the wrapped Effect; the timeout path emits an empty-steps
 * accumulator which the test specs accept (they only assert on status +
 * durationMs).
 */
const runActionsWithTimeout = (
  rawActions: readonly Record<string, unknown>[],
  ctx: StepContext,
  timeoutMs: number | undefined,
  skipActionNames: ReadonlySet<string>
): Effect.Effect<RunAccumulator, never, StepRequirements> => {
  // The reduce produces a final accumulator. Three short-circuit cases append
  // a `'skipped'` step record for the action WITHOUT executing it:
  //
  //  1. `acc.halted` — a `filter` or `automation:return` action requested
  //     early-exit. Filtered actions intentionally omit subsequent steps
  //     from `steps[]` (no record). `'return'` early-exits AS IF the
  //     automation completed normally; subsequent actions are skipped from
  //     the run history (no record).
  //  2. `acc.runStatus` is a terminal failure — APP-AUTOMATION-RETRY-012
  //     requires every post-failure action to be recorded with status
  //     `'skipped'` so callers can audit what was intentionally not run.
  //     `'completed-with-errors'` is NOT a terminal failure — its defining
  //     property is that subsequent actions DO continue.
  //  3. The action's `name` is in `skipActionNames` — set by the replay
  //     endpoint so a resumed run does not re-execute steps that already
  //     fired in the original run (APP-AUTOMATION-RETRY-013). Preserves
  //     the side-effects-once-only guarantee at replay time.
  const loop = Effect.reduce(rawActions, EMPTY_RUN_ACCUMULATOR, (acc, rawAction) => {
    if (acc.halted) return Effect.succeed(acc)
    if (isTerminalFailureStatus(acc.runStatus))
      return Effect.succeed(appendSkippedStep(acc, rawAction))
    if (skipActionNames.has(String(rawAction['name'] ?? ''))) {
      return Effect.succeed(appendSkippedStep(acc, rawAction))
    }
    return executeStep(acc, rawAction, ctx)
  })
  if (timeoutMs === undefined) return loop
  return Effect.timeoutTo(loop, {
    duration: Duration.millis(timeoutMs),
    onSuccess: (final): RunAccumulator => final,
    onTimeout: (): RunAccumulator => ({
      ...EMPTY_RUN_ACCUMULATOR,
      runStatus: 'timed-out',
      runError: `automation run exceeded timeout of ${String(timeoutMs)}ms`,
    }),
  })
}

export const executeAutomationRun = (
  input: ExecuteAutomationRunInput
): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  Effect.gen(function* () {
    const { name, automation, automationId, app, processEnv, triggerData } = input
    const startedAtDate = new Date()
    const ctx = buildStepContext(input)
    const rawActions = expandAutomationActions(app, automation)
    const runTimeoutMs = resolveRunTimeoutMs(automation)
    const skipActionNames = input.skipActionNames ?? new Set<string>()

    const finalState = yield* runActionsWithTimeout(rawActions, ctx, runTimeoutMs, skipActionNames)

    const finishedAtDate = new Date()

    // Persist run to DB via the repository. Returns the DB-generated UUID
    // when the insert succeeds; on failure, fall back to a synthetic id so
    // the in-memory store still gets a unique key. The DB write is the
    // authoritative source for the runs API; the in-memory store is kept
    // for the redact-secrets specs that read it directly.
    const persistedRunId = yield* persistRun({
      automationId,
      engineStatus: finalState.runStatus,
      engineError: finalState.runError,
      triggerData,
      startedAt: startedAtDate,
      finishedAt: finishedAtDate,
      steps: finalState.steps,
    })

    const runId = persistedRunId ?? cryptoRandomId()
    recordInMemoryRun({
      runId,
      name,
      startedAt: startedAtDate.toISOString(),
      finishedAt: finishedAtDate.toISOString(),
      finalState,
    })

    yield* dispatchPostRunFailureEffects({
      app,
      processEnv,
      automation,
      name,
      runId,
      finalState,
      startedAtDate,
      finishedAtDate,
    })

    return buildRunResult(runId, finalState)
  })

/**
 * Post-run failure fan-out: when the run failed (or exhausted) AND it is
 * not itself an `automation-failure` handler, dispatch both the
 * user-configured `automation-failure` triggers AND the platform's
 * built-in admin-notification email. Extracted from `executeAutomationRun`
 * to keep that generator below the per-function line cap.
 *
 * `'timed-out'` is NOT cascaded (mirrors the #97 timeout contract: timed-out
 * runs are a separate operator concern, not a routine failure).
 */
const dispatchPostRunFailureEffects = (input: {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly automation: NonNullable<App['automations']>[number]
  readonly name: string
  readonly runId: string
  readonly finalState: RunAccumulator
  readonly startedAtDate: Date
  readonly finishedAtDate: Date
}): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const { app, processEnv, automation, name, runId, finalState } = input
    const shouldCascadeFailure =
      (finalState.runStatus === 'failure' || finalState.runStatus === 'exhausted') &&
      automation.trigger.type !== 'automation-failure'
    if (!shouldCascadeFailure) return
    yield* dispatchFailureHandlers({
      app,
      processEnv,
      failedAutomationName: name,
      failedTriggerType: automation.trigger.type,
      runId,
      error: finalState.runError ?? 'Automation failed',
      steps: finalState.steps,
      retryConfig: toResolvedRetry(automation.retry),
      startedAt: input.startedAtDate.toISOString(),
      failedAt: input.finishedAtDate.toISOString(),
    })
    // Platform admin-failure email (US-AUTOMATIONS-RETRY-AND-FAILURE-002).
    // Always-on when `app.auth` is configured — analogous to Zapier's
    // built-in "Zap failed" email. Fires alongside the user-configured
    // `automation-failure` handlers (different concern: handlers are
    // operator-defined workflows; this is the platform's safety net).
    // Errors swallowed by `notifyPlatformFailure` so a broken admin-email
    // path cannot re-fail the already-failed parent run.
    yield* notifyPlatformFailure({
      app,
      automationName: name,
      runId,
      error: finalState.runError ?? 'Automation failed',
      failedAt: input.finishedAtDate.toISOString(),
    })
  })

// ── automation:call invoker ──────────────────────────────────────────────────

/**
 * Minimal `inputSchema` gate for the `automation-call` trigger: rejects
 * when a `required` key is missing/empty in the caller's inputData.
 * Property-level type checking is deliberately out of scope — a callee
 * needing richer validation should put the rule in a `code` action (same
 * stance as the webhook trigger's request-schema validator). Returns an
 * error message string, or undefined on success.
 */
const validateAgainstInputSchema = (
  inputData: Readonly<Record<string, unknown>>,
  inputSchema: Readonly<Record<string, unknown>> | undefined
): string | undefined => {
  if (inputSchema === undefined) return undefined
  const { required } = inputSchema
  if (!Array.isArray(required)) return undefined
  const missing = (required as ReadonlyArray<unknown>)
    .filter((k): k is string => typeof k === 'string')
    .filter((k) => inputData[k] === undefined || inputData[k] === null || inputData[k] === '')
  return missing.length === 0
    ? undefined
    : `inputData failed validation against the callee's inputSchema: missing required field(s) ${missing.join(', ')}`
}

/**
 * Pre-run guard for `automation:call`: resolve the target automation and
 * reject (returns an `Error`) on a missing target, a recursion-cycle, an
 * exceeded `maxDepth`, or an `inputSchema` validation failure. Returns the
 * resolved automation + the new call depth on success.
 */
const resolveCallTarget = (
  ctx: StepContext,
  name: string,
  inputData: Readonly<Record<string, unknown>>,
  maxDepth: number
):
  | {
      readonly ok: true
      readonly target: NonNullable<App['automations']>[number]
      readonly newDepth: number
    }
  | { readonly ok: false; readonly error: Error } => {
  const target = ctx.app.automations?.find((a) => a.name === name)
  if (target === undefined) {
    return {
      ok: false,
      error: new Error(`automation:call references automation '${name}' which does not exist`),
    }
  }
  if (ctx.visitedAutomations.has(name)) {
    const path = [...ctx.visitedAutomations, name].join(' → ')
    return { ok: false, error: new Error(`automation:call circular-reference detected: ${path}`) }
  }
  const newDepth = ctx.callDepth + 1
  if (newDepth > maxDepth) {
    return {
      ok: false,
      error: new Error(
        `automation:call exceeded the maximum call depth (${String(maxDepth)}) — possible infinite recursion`
      ),
    }
  }
  const triggerInputSchema =
    target.trigger.type === 'automation-call'
      ? (target.trigger.inputSchema as Readonly<Record<string, unknown>> | undefined)
      : undefined
  const schemaError = validateAgainstInputSchema(inputData, triggerInputSchema)
  if (schemaError !== undefined) return { ok: false, error: new Error(schemaError) }
  return { ok: true, target, newDepth }
}

/** Build the `executeAutomationRun` Effect for a sub-automation invocation. */
const buildSubAutomationRun = (input: {
  readonly ctx: StepContext
  readonly target: NonNullable<App['automations']>[number]
  readonly inputData: Readonly<Record<string, unknown>>
  readonly newDepth: number
}): Effect.Effect<RunAutomationResult, never, RunRequirements> =>
  Effect.gen(function* () {
    const { ctx, target, inputData, newDepth } = input
    const automationId = yield* resolveAutomationId(target.name, target).pipe(
      Effect.orElseSucceed(() => cryptoRandomId())
    )
    return yield* executeAutomationRun({
      name: target.name,
      automation: target,
      automationId,
      app: ctx.app,
      processEnv: ctx.processEnv,
      triggerData: { input: inputData, caller: ctx.automation.name, depth: newDepth },
      handlers: ctx.handlers,
      userId: ctx.automation.userId,
      callDepth: newDepth,
      visitedAutomations: ctx.visitedAutomations,
    })
  })

/**
 * Build the `automation:call` runtime callback threaded into every step's
 * run context. Resolves the target automation, validates the caller's
 * inputData against the target's `inputSchema`, enforces the recursion
 * depth + cycle guard, runs the target through {@link executeAutomationRun}
 * with `{ trigger: { input, caller, depth } }`, and resolves with the
 * callee's `automation:return` payload wrapped as `{ result }`.
 *
 * `mode: 'async'` fires the callee fire-and-forget and resolves with
 * `{ result: {} }`. Rejections surface as a failed `automation:call` step.
 */
const buildAutomationInvoker = (
  ctx: StepContext
): ((input: {
  readonly name: string
  readonly inputData: Readonly<Record<string, unknown>>
  readonly mode: 'sync' | 'async'
  readonly maxDepth: number
}) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>) => {
  return ({ name, inputData, mode, maxDepth }) => {
    const resolved = resolveCallTarget(ctx, name, inputData, maxDepth)
    if (!resolved.ok) return Promise.reject(resolved.error)
    const subRun = buildSubAutomationRun({
      ctx,
      target: resolved.target,
      inputData,
      newDepth: resolved.newDepth,
    })
    if (mode === 'async') {
      // Fire-and-forget. The caller already got `{ result: {} }`; surface a
      // log line if the background run rejects so operators can detect it.
      Effect.runPromise(provideAutomationRuntime(subRun)).then(
        () => undefined,
        (err) => {
          console.error('[automation] async automation:call run rejected', err)
        }
      )
      return Promise.resolve({ result: {} })
    }
    return Effect.runPromise(provideAutomationRuntime(subRun)).then((result) => {
      if (result.status === 'failure') {
        // eslint-disable-next-line functional/no-throw-statements -- inside .then; throw-as-rejection is the unicorn-preferred form
        throw new Error(result.error ?? `called automation '${name}' failed`)
      }
      return { result: result.returnData ?? {} }
    })
  }
}

// ── automation-failure trigger dispatch ──────────────────────────────────────

interface DispatchFailureHandlersInput {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly failedAutomationName: string
  readonly failedTriggerType: string
  readonly runId: string
  readonly error: string
  readonly steps: ReadonlyArray<ExecutedStep>
  readonly retryConfig: ResolvedRetryConfig | undefined
  readonly startedAt: string
  readonly failedAt: string
}

/** Select the `automation-failure` handlers whose filter matches a failed run. */
const matchingFailureHandlers = (
  app: App,
  failedAutomationName: string
): ReadonlyArray<NonNullable<App['automations']>[number]> =>
  (app.automations ?? []).filter((a) => {
    if (a.trigger.type !== 'automation-failure') return false
    const filter = a.trigger.automations
    return filter === undefined || (filter as ReadonlyArray<string>).includes(failedAutomationName)
  })

/**
 * Build the `trigger.data` envelope for an `automation-failure` handler run.
 * `attempt` = how many times the failing action ran (retryCount + 1, read
 * from the last failing step's `output.retryCount`).
 */
const buildFailureTriggerData = (input: DispatchFailureHandlersInput): TriggerData => {
  const lastFailingStep = input.steps.findLast((s) => s.status === 'failure')
  const retryCount =
    typeof lastFailingStep?.output?.['retryCount'] === 'number'
      ? (lastFailingStep.output['retryCount'] as number)
      : 0
  return {
    body: {
      automationName: input.failedAutomationName,
      runId: input.runId,
      error: input.error,
      attempt: retryCount + 1,
      maxAttempts: input.retryConfig?.maxAttempts ?? 1,
      startedAt: input.startedAt,
      failedAt: input.failedAt,
      triggerType: input.failedTriggerType,
    },
  }
}

/**
 * Find every `automation-failure` automation whose filter matches a failed
 * run, and run each with `{ trigger: { data: { automationName, runId,
 * error, attempt, maxAttempts, startedAt, failedAt, triggerType } } }`.
 * Errors are swallowed — a failing run must not be re-failed by a broken
 * error handler, and an error handler's own failure does not cascade
 * (it has an `automation-failure` trigger, so {@link executeAutomationRun}
 * skips re-dispatch for it).
 */
const dispatchFailureHandlers = (
  input: DispatchFailureHandlersInput
): Effect.Effect<void, never, RunRequirements> =>
  Effect.gen(function* () {
    const handlers = matchingFailureHandlers(input.app, input.failedAutomationName)
    if (handlers.length === 0) return
    const failureTriggerData = buildFailureTriggerData(input)
    yield* Effect.forEach(
      handlers,
      (handler) =>
        Effect.gen(function* () {
          const automationId = yield* resolveAutomationId(handler.name, handler).pipe(
            Effect.orElseSucceed(() => cryptoRandomId())
          )
          yield* executeAutomationRun({
            name: handler.name,
            automation: handler,
            automationId,
            app: input.app,
            processEnv: input.processEnv,
            triggerData: failureTriggerData,
            handlers: defaultActionHandlers,
            userId: undefined,
          })
        }),
      { concurrency: 1 }
    )
  })

export const runWebhookAutomation = ({
  name,
  app,
  processEnv,
  triggerData = {},
  handlers = defaultActionHandlers,
  userId,
}: RunWebhookAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  RunRequirements
> =>
  Effect.gen(function* () {
    const automation = yield* resolveWebhookAutomation(app, name)
    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId,
    })
  })

// Manual trigger entry point lives in `./run-manual-automation.ts` so the
// per-trigger logic (role gating, custom error tags) does not bloat this
// module. Both entry points compose `executeAutomationRun` identically.
