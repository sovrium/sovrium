/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
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
 */
export interface AutomationContext {
  readonly name: string
  readonly id: string
  readonly userId?: string
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
   * APP-AUTOMATION-RETRY-015. Optional so handlers that don't care about
   * retries can ignore it; the runtime always provides a value (defaults
   * to 1 when called outside the retry loop).
   */
  readonly attempt?: number
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
  | ConnectionRepository
  | ConnectionTokenRepository
  | PackageResolver
  | AiService
  | StorageService
>

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
): Record<string, unknown> | undefined => props[key] as Record<string, unknown> | undefined

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
    // @effect-diagnostics-next-line effect/preferSchemaOverJson:off
    // — Schema would be ceremonial here: props.body is intentionally
    // polymorphic user-supplied YAML (no single shape applies).
    try: () => JSON.stringify(rawBody),
    catch: (cause) =>
      new BodySerializationError({
        message: `failed to serialise body: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  })
}
