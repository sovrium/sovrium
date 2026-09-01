/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import {
  findMultiSelectSelectionOverflows,
  findUndeclaredMultiSelectValues,
} from '@/domain/validators/multi-select-values'
import type { AnalyticsRepository } from '@/application/ports/repositories/analytics/analytics-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationApprovalRepository } from '@/application/ports/repositories/automations/automation-approval-repository'
import type { AutomationDigestRepository } from '@/application/ports/repositories/automations/automation-digest-repository'
import type { AutomationStateRepository } from '@/application/ports/repositories/automations/automation-state-repository'
import type { ConnectionRepository } from '@/application/ports/repositories/connections/connection-repository'
import type { ConnectionTokenRepository } from '@/application/ports/repositories/connections/connection-token-repository'
import type { LinkRepository } from '@/application/ports/repositories/links/link-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { AiService } from '@/application/ports/services/ai-service'
import type { ImageTransformService } from '@/application/ports/services/image-transform-service'
import type { ServerOrigin } from '@/application/ports/services/server-origin'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { App } from '@/domain/models/app'

/**
 * Outcome of executing a single automation action.
 *
 * `error` carries an unredacted message; the caller is responsible for
 * redacting before persisting to run-history.
 *
 * `output` carries data the action wants to surface in the webhook response
 * under `actions.<name>` — used by data-returning operators like `state:get`
 * or `state:list`. Optional; absent for void operators (set, delete).
 *
 * `responseOverride` is a side-channel for actions that need to shape the
 * synchronous trigger response WITHOUT polluting `output` (which gets
 * persisted to `system.automation_runs.steps[].output` and shallow-merged
 * into `lastOutput`). Currently set only by `webhook/response`; the webhook
 * dispatcher reads `result.responseOverride` to override the default sync
 * body. Persisted nowhere — purely an in-memory plumbing field.
 */
export interface ActionOutcome {
  readonly status: 'success' | 'failure' | 'filtered'
  readonly error?: string
  readonly output?: Record<string, unknown>
  readonly responseOverride?: Readonly<Record<string, unknown>>
  /**
   * Set by the `automation:return` handler — the key-value payload the
   * callee wants to hand back to its `automation:call` caller. When
   * present the run loop short-circuits the remaining actions in the
   * callee (early-exit semantics) and surfaces this object as
   * `RunAutomationResult.returnData`, which the caller's `automation:call`
   * step exposes as `steps.{name}.result`. Distinct from `output` — which
   * is shallow-merged into `lastOutput`/the webhook response — so a
   * `return` action's payload does not pollute the parent's `output`.
   */
  readonly returnData?: Readonly<Record<string, unknown>>
  /**
   * Set by the `approval/request` handler — signals the run loop to SUSPEND
   * the run after this step. When present the run transitions to the
   * non-terminal `waiting-approval` status and every subsequent action is
   * withheld (the `halted` short-circuit), pending an out-of-band approve /
   * reject decision against the run-scoped resolution endpoint. The webhook /
   * manual dispatcher surfaces this as a 200 with `output.status: 'pending'`
   * (not a failure → no 500). Distinct from `halt` via `returnData` — a paused
   * run is resumable, an early-`return` run is complete.
   */
  readonly pause?: boolean
}

/**
 * Identity of the running automation, threaded into every handler call.
 *
 * `id` is the `system.automation_definitions.id` UUID — required by handlers
 * whose writes target tables FK'd to that row (e.g. `state`, `digest`). The
 * runtime resolves `id` lazily on first trigger via `AutomationRepository`
 * (see `run-automation.ts`).
 *
 * `userId` is the `auth.users.id` of the user who triggered the automation
 * (via webhook session, manual trigger, etc.). Required by handlers that
 * resolve per-user state (e.g. OAuth2 token lookup in `http/request`).
 * Undefined for system-triggered automations (cron, automation-call) where
 * no caller user exists.
 *
 * `runId` is the `system.automation_runs.id` of the in-flight run. Threaded so
 * the `approval/request` handler can FK its pending row to the paused run
 * — the run-scoped resolution endpoint locates
 * the run via that link. Undefined when a run row was not persisted (the
 * scheduler could not seed `system.automation_runs`).
 */
export interface AutomationContext {
  readonly name: string
  readonly id: string
  readonly userId?: string
  readonly runId?: string
}

/**
 * Mid-run context surfaced to handlers that need to read prior step outputs
 * or the raw trigger payload (currently only `code/runTypescript` — its sandbox
 * exposes `context.steps.<name>` and a flattened `context.trigger.data`).
 *
 * Optional on the handler signature so existing handlers don't need to
 * opt in; only the code handler reads it. The runtime always passes a
 * value.
 */
export interface ActionRunContext {
  /** Outputs of all previously-executed steps, keyed by step name. */
  readonly previousSteps: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  /**
   * Raw trigger payload as built by the entry-point handler (webhook /
   * manual / cron / record). Surfaced to the code action so its sandbox
   * can expose a flattened `trigger.data` view (for webhook triggers,
   * `context.trigger.data === triggerData.body`).
   */
  readonly triggerData: Readonly<Record<string, unknown>>
  /**
   * Raw, pre-template-substitution action object. The code handler uses
   * this to re-resolve `inputData` against its custom context (where
   * `{{steps.X.Y}}` and `{{trigger.data.X}}` see the flattened shape).
   */
  readonly rawAction: Readonly<Record<string, unknown>>
  /** Resolved env lookup for `$env.X` substitution + sandbox `context.env`. */
  readonly envLookup: Readonly<Record<string, string>>
  /**
   * Invoke a reusable action template declared at `app.actions[]` by name.
   * Used by the `code/runTypescript` sandbox's callable
   * `context.actions.ref('<name>', vars)` proxy method. Looks up the
   * template in the app-level registry, substitutes its `$vars` with
   * `vars` (shallow-merged over the template's declared variable
   * defaults), dispatches the resulting concrete action through the
   * same handler pipeline used by top-level steps, and returns the
   * handler's `ActionOutcome.output`. Templates whose `action` is
   * itself `type: 'code'` may recursively invoke other templates;
   * cycle detection rejects with a descriptive error.
   *
   * Optional so non-code handlers don't need to thread it. The runtime
   * always supplies it for code actions.
   */
  readonly invokeTemplate?: (
    name: string,
    vars?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>

  /**
   * Invoke a native action type directly without declaring a template.
   * Used by the `code/runTypescript` sandbox's
   * `context.actions.<actionType>.<operator>(props)` proxy. Synthesises
   * a concrete action with the supplied `props`, resolves env
   * substitution, dispatches through the same handler pipeline as
   * templates and top-level steps, and returns the handler's
   * `ActionOutcome.output`. Threads the same cycle-detection stack as
   * `invokeTemplate` so a native action whose handler is itself a code
   * action invoking a template stays cycle-safe.
   *
   * Optional for the same reason as `invokeTemplate`.
   */
  readonly invokeNativeAction?: (
    type: string,
    operator: string,
    props?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>

  /**
   * Invoke another automation by name (the `automation:call` action's
   * runtime). Resolves the target in `app.automations[]`, validates the
   * caller's `inputData` against the target's `automation-call` trigger
   * `inputSchema` (if declared), enforces the recursion-depth / cycle
   * guard, runs the target through the shared engine loop with
   * `{ trigger: { input, caller, depth } }` as trigger data, and resolves
   * with the callee's `automation:return` payload wrapped as `{ result }`
   * (an empty `result: {}` when the callee declared no `return` action).
   *
   * `mode: 'async'` fires the callee fire-and-forget and resolves
   * immediately with `{ result: {} }`. Rejects (→ the `automation:call`
   * step records a failure) when the target is missing, the inputSchema
   * validation fails, or the depth/cycle guard trips.
   *
   * Built by `run-automation.ts` and threaded through every step's run
   * context (analogous to `invokeTemplate` / `invokeNativeAction`).
   * Optional so non-`automation` handlers need not opt in.
   */
  readonly invokeAutomation?: (input: {
    readonly name: string
    readonly inputData: Readonly<Record<string, unknown>>
    readonly mode: 'sync' | 'async'
    readonly maxDepth: number
  }) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>

  /**
   * 1-indexed retry attempt number for this action's dispatch. Threaded
   * through by `dispatchWithRetry` (run-automation.ts): 1 on the initial
   * call, 2 on the first retry, etc. Surfaced to the code-action sandbox
   * as `context.run.attempt` so authors can short-circuit on retry — see
   * [internal ref]. Optional so handlers that don't care about
   * retries can ignore it; the runtime always provides a value (defaults
   * to 1 when called outside the retry loop).
   */
  readonly attempt?: number

  /**
   * 0-indexed position of this action within the automation's resolved action
   * list. Threaded by the run loop so the `approval/request` handler can record
   * the paused step's index on its pending row —
   * the resolution endpoint resumes by re-running only the actions AFTER this
   * index. Optional; the runtime always supplies it.
   */
  readonly stepIndex?: number
}

/**
 * Action handler signature.
 *
 * Handlers receive the resolved (env-substituted) action object, the app
 * schema, the running automation's identity, and an optional mid-run
 * context (for handlers that need to read prior step outputs or the raw
 * trigger payload). Returns an Effect that yields an ActionOutcome.
 * Returning `Effect` rather than `Promise` lets callers compose handlers
 * with the rest of the runtime (sequencing, retries, telemetry) without
 * a context switch.
 *
 * Required services come from the handler's repository / port dependencies
 * — handlers do not provide their own layers.
 */
export type ActionHandler = (
  action: Readonly<Record<string, unknown>>,
  app: App,
  automation: AutomationContext,
  runContext?: ActionRunContext
) => Effect.Effect<
  ActionOutcome,
  never,
  | TableRepository
  | AutomationStateRepository
  | AutomationDigestRepository
  | AutomationApprovalRepository
  | AuthRepository
  | ConnectionRepository
  | ConnectionTokenRepository
  | AiService
  | StorageService
  | ImageTransformService
  | AnalyticsRepository
  | LinkRepository
  | ServerOrigin
>

/**
 * The first `multi-select` contract violation in an automation's record
 * payload, phrased for an {@link ActionOutcome} `error` — or `undefined` when
 * the payload is clean.
 *
 * Why this lives here rather than in `domain/validators/multi-select-values.ts`:
 * that module deliberately reports WHICH columns were violated and never how to
 * phrase it, because each write path owns its own error envelope. This is the
 * automation envelope.
 *
 * Why automations need their own check at all: `createRecordProgram` /
 * `updateRecordProgram` take `app` as OPTIONAL and the automation handlers call
 * them without it, so any validation placed inside those programs would be a
 * silent no-op on exactly this path. `ActionHandler` already receives `app` as
 * its second parameter, so the table declarations are in hand here.
 *
 * The membership rule is checked before the cardinality rule so an automation
 * gets the same message, for the same payload, that the records API returns
 * (`validateMultiSelectOptions` then `validateMultiSelectSelectionLimits` in
 * `presentation/api/validation/rules/multi-select-rules.ts`). One contract
 * across every write path was the entire point of extracting the rules.
 *
 * An unknown `tableName` returns `undefined` — resolving the table is not this
 * helper's job, and the downstream write reports it far more precisely.
 */
export const findMultiSelectViolationMessage = (
  app: App,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): string | undefined => {
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (!table) return undefined

  const undeclared = findUndeclaredMultiSelectValues(table.fields, fields)[0]
  if (undeclared) {
    return `Invalid option for field '${undeclared.field}'. Allowed options: ${undeclared.allowed.join(', ')}`
  }

  const overflow = findMultiSelectSelectionOverflows(table.fields, fields)[0]
  if (overflow) {
    return `Too many selections for field '${overflow.field}'. max selections allowed: ${overflow.maxSelections}`
  }

  return undefined
}

/**
 * Registry key shape for action dispatch.
 *
 * Actions are keyed by `${type}/${operator}` (e.g. `record/create`,
 * `http/request`). Some action types do not have an operator; for those we
 * key on `${type}` alone (handled by the lookup function below).
 */
export type ActionKey = string

/**
 * Compute the dispatch key for an action.
 *
 * Exposed so tests / logs can use the same canonicalisation the registry uses.
 */
export const actionKey = (type: string | undefined, operator: string | undefined): ActionKey =>
  operator ? `${type ?? ''}/${operator}` : (type ?? '')

// ---------------------------------------------------------------------------
// Internal prop-extraction helpers shared across handlers
// ---------------------------------------------------------------------------

export const stringProp = (props: Readonly<Record<string, unknown>>, key: string): string =>
  String(props[key] ?? '')

export const recordProp = (
  props: Readonly<Record<string, unknown>>,
  key: string
): Readonly<Record<string, unknown>> | undefined =>
  props[key] as Record<string, unknown> | undefined

export const numberProp = (
  props: Readonly<Record<string, unknown>>,
  key: string,
  fallback: number
): number => {
  const raw = props[key]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/**
 * Turn a finished item-loop tally into the step's `ActionOutcome`.
 *
 * The ONE implementation of the `continueOnItemError` rule, shared by every
 * operator that walks a declared item array — `record/batchCreate`,
 * `batchUpdate`, `batchDelete`, `batchUpsert` and `loop/each`. All five declare
 * the flag with byte-identical wording ("Continue processing remaining items if
 * one fails (default: false)"), so all five must agree that failures fail the
 * STEP unless the author opted in, while the counts ride along either way so
 * run-history records what did land.
 *
 * It is shared because it already drifted once: `record-batch.ts` and `loop.ts`
 * each carried the same four lines, and a divergence between two such copies is
 * exactly the defect class their callers were audited for. Being pure data in /
 * pure data out, sharing it needs no generalisation.
 *
 * Deliberately NOT shared: the folds that PRODUCE the tally. `runBatchItems` is
 * an Effect fold over `TableRepository`-requiring per-item Effects with a
 * created/updated/failed vocabulary that discards each item's output;
 * `runAllIterations` is a promise chain whose per-item output IS the payload
 * (`results[]` is a documented template surface). Unifying those would mean
 * generalising over both the effect requirement and the result vocabulary to
 * save a handful of lines — see the note on `loop.ts`'s `foldIteration`.
 */
export const itemLoopOutcome = (input: {
  readonly failed: number
  readonly firstError: string | undefined
  readonly output: Record<string, unknown>
  readonly continueOnItemError: boolean
  readonly fallbackError: string
}): ActionOutcome => {
  const { failed, firstError, output, continueOnItemError, fallbackError } = input
  return failed > 0 && !continueOnItemError
    ? { status: 'failure', error: firstError ?? fallbackError, output }
    : { status: 'success', output }
}

/**
 * Tagged failure raised when an action body cannot be serialised — most
 * commonly because the YAML payload contains a circular reference or a
 * `BigInt`, both of which throw from `JSON.stringify` synchronously. The
 * tag lets callers `catch`/`either` against this specific failure
 * instead of merging it into a generic `Error` bucket on the Effect
 * channel, while `cause` preserves the original throwable for
 * log-level diagnostics.
 */
export class BodySerializationError extends Data.TaggedError('BodySerializationError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Serialise an action's `props.body` to the on-the-wire string form.
 *
 * Bodies in YAML config are intentionally polymorphic — Slack, Discord,
 * PagerDuty, and custom consumers all expect different payload shapes —
 * so there is no single Effect Schema we can validate against. We pass
 * strings through verbatim (caller already chose the wire format) and
 * `JSON.stringify` everything else.
 *
 * Wrapped in `Effect.try` so that pathological inputs (circular
 * references, BigInt values) surface as a typed `BodySerializationError`
 * the caller can convert to a graceful `{ status: 'failure', error }`
 * outcome — instead of crashing the surrounding `Effect.gen` as a
 * defect.
 *
 * Callers that want to treat `null` like an absent body (webhook) should
 * normalise upstream; this helper passes `null` through to JSON.stringify
 * (which yields the literal string `"null"`).
 */
export const serializeActionBody = (
  rawBody: unknown
): Effect.Effect<string | undefined, BodySerializationError> => {
  if (rawBody === undefined || typeof rawBody === 'string') {
    return Effect.succeed(rawBody)
  }
  return Effect.try({
    // Schema would be ceremonial here: props.body is intentionally
    // polymorphic user-supplied YAML (no single shape applies).
    try: () => JSON.stringify(rawBody),
    catch: (cause) =>
      new BodySerializationError({
        message: `failed to serialise body: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  })
}
