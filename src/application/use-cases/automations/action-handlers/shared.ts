/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  findMultiSelectSelectionOverflows,
  findUndeclaredMultiSelectValues,
} from '@/domain/models/app/tables/multi-select-values-validation'
import type { ContainerResume, RunPark } from './run-park'
import type { ExecutedStep, NestedStepRuns, StepRequirements } from '../run/types'
import type { TemplateRenderer } from '@/application/ports/services/template-engine'
import type { App } from '@/domain/models/app'
import type { StepRead } from '@/domain/models/app/automations/step-read-service'
import type { Effect } from 'effect'

/** One log entry a step wrote — see {@link ActionOutcome.logs}. */
export interface StepLogEntry {
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly message: string
}

/**
 * Outcome of executing a single automation action. `error` is unredacted (the
 * caller redacts before persisting); `output` is what later steps read as
 * `{{<name>.*}}`. `responseOverride` shapes the synchronous trigger response
 * without polluting `output` (`webhook/response`, `flow/stop`); never persisted.
 */
export interface ActionOutcome {
  readonly status: 'success' | 'failure' | 'filtered'
  readonly error?: string
  readonly output?: Record<string, unknown>
  /**
   * Whether a FAILED outcome is worth another attempt under a `retry` policy,
   * when the handler knows: `false` for a refusal that answers the same way on
   * every try. Absent, the retry loop classifies by `output.response.status`.
   */
  readonly retryable?: boolean
  /**
   * `context.log` entries a code action wrote, in call order. Kept OFF
   * `output` so a log never reaches step chaining or the trigger response;
   * persisted on the step (redacted) and read back by the runs API.
   */
  readonly logs?: readonly StepLogEntry[]
  readonly responseOverride?: Readonly<Record<string, unknown>>
  /**
   * Set by the `automation:return` handler — the key-value payload the
   * callee wants to hand back to its `automation:call` caller. When
   * present the run loop short-circuits the remaining actions in the
   * callee (early-exit semantics) and surfaces this object as
   * `RunAutomationResult.returnData`, which the caller's `automation:call`
   * step exposes as `steps.{name}.result`. Distinct from `output` — which
   * is shallow-merged into `lastOutput`/the manual-trigger response — so a
   * `return` action's payload does not pollute the parent's `output`.
   */
  readonly returnData?: Readonly<Record<string, unknown>>
  /**
   * Set by `approval/request`: the run SUSPENDS as `waiting-approval` after this
   * step, every later action withheld until the request is resolved. Unlike an
   * early `return`, a paused run is resumable.
   */
  readonly pause?: boolean
  /** Set by a wait longer than a minute: the run PARKS as `waiting-delay` (`run-park.ts`). */
  readonly park?: RunPark
  /** Set when a resumed container finds its configuration changed: the run is cancelled, why. */
  readonly cancelRun?: string
  /**
   * What the action read as it ran, when its handler can tell more precisely
   * than its declaration: the records an agent's tool calls named. Kept OFF
   * `output`; persisted on the step and read by the erasure index.
   */
  readonly reads?: readonly StepRead[]
  /**
   * Set by `path` and `loop`: the outputs their nested actions produced, by
   * step name, which later steps of the run read as `{{<step>.*}}`.
   */
  readonly nestedOutputs?: Readonly<Record<string, Record<string, unknown>>>
  /** Set by `path` and `loop`: the steps they ran, recorded like top-level ones. */
  readonly nestedSteps?: NestedStepRuns
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
  /**
   * Set when a person started the run by hand and `userId` names them: record
   * actions then write as that person, under the table's rules. See
   * `ExecuteAutomationRunInput.startedByHand`.
   */
  readonly startedByHand?: true
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
  /**
   * The action's props AS AUTHORED, ready for the template pass: `$env.X`
   * (and a named template's `$name`) references are values the pass inserts
   * without parsing (`{{$env.NAME}}`, `{{$vars.name}}`), and no `{{...}}` is
   * filled in yet. A handler that renders its own props (loop, path, code's
   * `inputData`, the raw-props readers) reads this through
   * `authoredActionProps`, so it renders the configuration as written exactly
   * once. When {@link propsFinal} is set it holds the final props as given.
   */
  readonly authoredProps?: Readonly<Record<string, unknown>>
  /**
   * Set when the props are values another step handed over — a code action's
   * `context.actions.<type>.<operator>(props)` call, an item a loop filled in,
   * a branch action its path resolved. Such props are FINAL: a handler uses
   * them as given and never renders them as a template again, so template
   * text a caller sent stays text.
   */
  readonly propsFinal?: true
  /**
   * A named template's variables (its declared defaults under the caller's
   * `vars`), read by the `{{$vars.name}}` references its authored body holds.
   * Absent outside a template.
   */
  readonly templateVars?: Readonly<Record<string, unknown>>
  /** Resolved env lookup for `$env.X` substitution + sandbox `context.env`. */
  readonly envLookup: Readonly<Record<string, string>>
  /**
   * The template engine the run read from the `TemplateEngine` port, for a
   * handler that renders its own props (`resolveOwnProp`, the code action's
   * `inputData`).
   */
  readonly templates: TemplateRenderer
  /**
   * Invoke a reusable action template declared at `app.actions[]` by name —
   * the code sandbox's `context.actions.ref('<name>', vars)`. `vars` are
   * shallow-merged over the declared variable defaults, the action dispatched
   * through the top-level handler pipeline, and its `output` returned; a
   * template cycle rejects with a descriptive error.
   */
  readonly invokeTemplate?: (
    name: string,
    vars?: Readonly<Record<string, unknown>>
  ) => Promise<unknown>

  /**
   * Invoke a native action directly — the code sandbox's
   * `context.actions.<actionType>.<operator>(props)`. The `props` are final
   * (see {@link propsFinal}); resolves with the handler's `output`. Threads
   * `invokeTemplate`'s cycle-detection stack.
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
    /** Told the id of the run the call started, once it has one. */
    readonly onRun?: (runId: string) => void
  }) => Promise<{ readonly result: Readonly<Record<string, unknown>> }>

  /**
   * 1-indexed retry attempt number for this action's dispatch. Threaded
   * through by `dispatchWithRetry` (run-automation.ts): 1 on the initial
   * call, 2 on the first retry, etc. Surfaced to the code-action sandbox
   * as `context.run.attempt` so authors can short-circuit on retry — see
   * Optional so handlers that don't care about
   * retries can ignore it; the runtime always provides a value (defaults
   * to 1 when called outside the retry loop).
   */
  readonly attempt?: number

  /** 0-indexed position of this action in the run's actions, recorded by `approval/request`. */
  readonly stepIndex?: number
  /** Set on a loop or a path the run resumes inside (`run-park.ts`). */
  readonly resume?: ContainerResume

  /**
   * The record-event channel of this run: a record a step writes
   * starts the record automations of its table, exactly as the same write
   * through the records API does. Built by the run loop; optional so a handler
   * run outside one (a unit test, a template invoked from the sandbox) writes
   * without dispatching.
   */
  readonly recordEvents?: RecordEventChannel

  /** Run one action of a `path`/`loop` as a step reading `previousSteps`: whole outcome + step record. */
  readonly runNestedStep?: NestedStepInvoker
}

/** See {@link ActionRunContext.runNestedStep}; the `props` are final unless `authored`. */
export type NestedStepInvoker = (input: {
  readonly action: Readonly<Record<string, unknown>>
  readonly props: Readonly<Record<string, unknown>>
  readonly previousSteps: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  readonly refusal?: string // why the props cannot be filled in safely: the step fails unrun
  readonly templateVars?: Readonly<Record<string, unknown>> // a named template's `$vars`, filled in
  readonly authored?: true // the props are as written, not final: the handler fills them in
  readonly resume?: ContainerResume // a container the run resumes inside
}) => Promise<{ readonly outcome: ActionOutcome; readonly step: ExecutedStep }>

/** One write an automation step made, as the record triggers read it. */
export interface RecordWriteEvent {
  readonly tableName: string
  readonly event: 'create' | 'update' | 'delete' | 'restore'
  readonly record: Readonly<Record<string, unknown>>
  readonly previousRecord?: Readonly<Record<string, unknown>>
}

/**
 * How a step's writes reach the record triggers.
 *
 * `refusal` answers BEFORE a write: a chain of record events started by
 * automation writes stops at a depth limit, and the step that would pass it
 * fails with the reason instead of writing — the bound on a cycle the config
 * cannot show (a visible one is refused at validation). `dispatch` starts the
 * matching automations AFTER a write, in the background.
 */
export interface RecordEventChannel {
  /** True when some record automation fires on this event in this table. */
  readonly watches: (tableName: string, event: RecordWriteEvent['event']) => boolean
  /**
   * The refusal a write meets past the depth limit. `fields` are the fields an
   * update writes: a write no record automation watches starts nothing and is
   * never refused.
   */
  readonly refusal: (
    tableName: string,
    event: RecordWriteEvent['event'],
    fields?: readonly string[]
  ) => string | undefined
  readonly dispatch: (write: RecordWriteEvent) => void
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

/**
 * The span attribute every action handler carries: WHICH step ran.
 *
 * One helper rather than the same `String(action['type'] ?? …)` at fifty-seven
 * call sites — and short enough that the span stays on one line, which is what
 * keeps the biggest handler files inside the file-length limit.
 */
export const actionAttributes = (
  action: Readonly<Record<string, unknown>>
): Readonly<Record<string, string>> => ({
  'automation.action': String(action['type'] ?? 'unknown'),
})

export type ActionHandler = (
  action: Readonly<Record<string, unknown>>,
  app: App,
  automation: AutomationContext,
  runContext?: ActionRunContext
) => Effect.Effect<ActionOutcome, never, StepRequirements>

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

export { BodySerializationError, serializeActionBody } from './action-body-serialization'
