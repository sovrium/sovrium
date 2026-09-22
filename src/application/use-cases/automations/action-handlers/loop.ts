/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import {
  asArray,
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import { actionAttributes, itemLoopOutcome } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

/**
 * `loop/each` handler — for-each over an array.
 *
 * Iterates the array referenced by `props.items` (a `{{...}}` template) and,
 * for each item, runs the nested `props.actions` sub-sequence with the
 * current item exposed as `{{loop.item}}` / `{{loop.item.<field>}}` and the
 * zero-based position as `{{loop.index}}`. Per-item outputs are collected
 * into `steps.<name>.results[]`; a failed item contributes `{ error }` in its
 * position so the array stays aligned with the declared order.
 *
 * `props.continueOnItemError` decides what a failing item does to the rest:
 * absent or `false` stops the loop there and fails the step, `true` attempts
 * every item and reports the count in `output.failed`. See {@link foldIteration}
 * for why the rule is shared with `record/batch*` by wording rather than by code.
 *
 * Why this resolves templates itself instead of relying on the run loop's
 * `resolveTriggerInValue` (cf. `data.ts`): that resolver runs BEFORE the
 * handler and stringifies non-scalar values — it would both flatten the
 * `items` array and erase the `{{loop.*}}` placeholders inside the nested
 * `actions` (which only exist once iteration is under way). So the handler
 * reads the RAW pre-substitution action (`runContext.rawAction.props`),
 * resolves `items` against the trigger/steps context, and re-resolves each
 * nested action's props against a per-item context before dispatching it
 * through `runContext.invokeNativeAction`. The raw-props/`{{path}}`-or-raw
 * resolution machinery is shared with `data.ts` via
 * `./run-context-resolution`.
 *
 * Known limitation: a nested non-`code` action that references `{{loop.*}}`
 * AND is itself a raw-props handler (e.g. `data:sort` with
 * `input: '{{loop.item.orders}}'`) would re-read `rawAction.props` from a
 * context lacking `loop`. `loop` pre-resolves the nested action's props
 * here, so the nested handler sees a literal — fine for `code` (which the
 * specs use) and for any handler that consumes the resolved props. A nested
 * raw-props handler that re-resolves would miss `{{loop.*}}`. Unifying that
 * needs the run-loop refactor the #63 audit deferred.
 *
 * Spec: [internal ref] + REGRESSION.
 */

const DEFAULT_MAX_ITERATIONS = 1000

/** Tagged failure when a nested action throws (or rejects) mid-iteration. */
class LoopIterationError extends Data.TaggedError('LoopIterationError')<{
  readonly message: string
  readonly cause: unknown
}> {}

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] ?? {}) as Readonly<Record<string, unknown>>

const asActionList = (value: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  Array.isArray(value)
    ? (value.filter((a) => a !== null && typeof a === 'object') as ReadonlyArray<
        Readonly<Record<string, unknown>>
      >)
    : []

const maxIterationsOf = (props: Readonly<Record<string, unknown>>): number => {
  const raw = props['maxIterations']
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_MAX_ITERATIONS
}

const ok = (output: Readonly<Record<string, unknown>>): ActionOutcome =>
  ({ status: 'success', output }) as const satisfies ActionOutcome

const fail = (message: string): ActionOutcome =>
  ({ status: 'failure', error: message }) as const satisfies ActionOutcome

/** What happened to one loop item. */
type IterationOutcome =
  | { readonly kind: 'ok'; readonly output: unknown }
  | { readonly kind: 'failed'; readonly error: string }

/** Running state across the iteration sequence. */
interface LoopTally {
  readonly results: readonly unknown[]
  readonly failed: number
  readonly firstError: string | undefined
  readonly stopped: boolean
}

const EMPTY_TALLY: LoopTally = {
  results: [],
  failed: 0,
  firstError: undefined,
  stopped: false,
}

/**
 * Fold one item's outcome into the tally, halting the sequence when an item
 * failed and the author did not opt into `continueOnItemError`.
 *
 * The rule is the one the three `record/batch*` operators share — "Continue
 * processing remaining items if one fails (default: false)", byte-identical
 * wording across all four schemas — so the DEFAULT stops at the first failing
 * item rather than attempting the rest and reporting afterwards
 *.
 *
 * Why this does not reuse `record-batch.ts`'s `runBatchItems`: that loop is an
 * `Effect` fold over `TableRepository`-requiring per-item Effects, tallying a
 * created/updated/failed vocabulary and deliberately DISCARDING each item's
 * output. A loop item is a promise-returning sub-sequence dispatched through
 * `invokeNativeAction` over any action type, and its output is the whole point
 * — `results[]` is a documented template surface. Sharing the loop would mean
 * generalising over both the effect requirement and the result vocabulary to
 * save four lines; sharing the RULE, which is what actually drifted, is what
 * this comment is for.
 */
const foldIteration = (
  tally: LoopTally,
  outcome: IterationOutcome,
  continueOnItemError: boolean
): LoopTally =>
  outcome.kind === 'ok'
    ? { ...tally, results: [...tally.results, outcome.output ?? {}] }
    : {
        results: [...tally.results, { error: outcome.error }],
        failed: tally.failed + 1,
        firstError: tally.firstError ?? outcome.error,
        stopped: !continueOnItemError,
      }

/**
 * Turn the tally into the step outcome. A loop with failures fails the STEP
 * (and so the run) unless the author opted into `continueOnItemError`; the
 * per-item results ride along either way so run-history records what did land.
 *
 * The RULE lives in `itemLoopOutcome` (`./shared`), shared with the four
 * `record/batch*` operators — this is the `LoopTally`-shaped adapter onto it,
 * and the only thing it adds is the loop's own output vocabulary
 * (`results`/`iterations`/`failed`) and fallback message. Note that the fold
 * ABOVE stays separate on purpose (see `foldIteration`); only the outcome rule
 * is shared, because only the outcome rule was duplicated.
 */
const loopOutcome = (tally: LoopTally, continueOnItemError: boolean): ActionOutcome =>
  itemLoopOutcome({
    failed: tally.failed,
    firstError: tally.firstError,
    output: {
      results: tally.results,
      iterations: tally.results.length,
      failed: tally.failed,
    },
    continueOnItemError,
    fallbackError: 'loop.each: an item failed',
  })

/**
 * Run the nested action sub-sequence for one loop item. Each action's props
 * are re-resolved against the per-item context (so `{{loop.item.*}}` /
 * `{{loop.index}}` resolve) and dispatched via `invokeNativeAction` in
 * order. Returns the last action's output (mirrors how a single `code`
 * step's return value surfaces) or `{}` when the sub-sequence produced
 * nothing.
 */
const runIteration = (input: {
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly itemContext: Readonly<Record<string, unknown>>
  readonly invoke: NonNullable<ActionRunContext['invokeNativeAction']>
}): Promise<unknown> => {
  const { actions, itemContext, invoke } = input
  return actions.reduce<Promise<unknown>>(
    (prev, nested) =>
      prev.then(() => {
        const type = String(nested['type'] ?? '')
        const operator = String(nested['operator'] ?? '')
        const resolvedProps = resolveRunContextValue(propsOf(nested), itemContext) as Record<
          string,
          unknown
        >
        return invoke(type, operator, resolvedProps)
      }),
    Promise.resolve<unknown>(undefined)
  )
}

/**
 * Run one item's sub-sequence and reduce a rejection to a value. A nested
 * action that fails rejects the promise (`buildNativeActionInvoker` throws on
 * a failure outcome); catching it here is what lets the caller DECIDE whether
 * to continue rather than having the whole chain unwound for it.
 */
const runIterationSafely = (input: {
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly itemContext: Readonly<Record<string, unknown>>
  readonly invoke: NonNullable<ActionRunContext['invokeNativeAction']>
}): Promise<IterationOutcome> =>
  runIteration(input).then(
    (output): IterationOutcome => ({ kind: 'ok', output }),
    (cause: unknown): IterationOutcome => ({
      kind: 'failed',
      error: cause instanceof Error ? cause.message : String(cause),
    })
  )

/** Run all iterations sequentially (one Promise chain) so step order and a
 *  failing item surface deterministically. */
const runAllIterations = (input: {
  readonly items: readonly unknown[]
  readonly limit: number
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly base: Readonly<Record<string, unknown>>
  readonly invoke: NonNullable<ActionRunContext['invokeNativeAction']>
  readonly continueOnItemError: boolean
}): Promise<LoopTally> => {
  const { items, limit, actions, base, invoke, continueOnItemError } = input
  const indices = Array.from({ length: limit }, (_v, i) => i)
  return indices.reduce<Promise<LoopTally>>(async (prev, i) => {
    const tally = await prev
    if (tally.stopped) return tally
    const itemContext = { ...base, loop: { item: items[i], index: i } }
    const outcome = await runIterationSafely({ actions, itemContext, invoke })
    return foldIteration(tally, outcome, continueOnItemError)
  }, Promise.resolve(EMPTY_TALLY))
}

export const handleLoopEach: ActionHandler = (action, _app, _automation, runContext) =>
  Effect.gen(function* () {
    if (runContext === undefined || runContext.invokeNativeAction === undefined) {
      return ok({ results: [], iterations: 0 })
    }
    const invoke = runContext.invokeNativeAction
    const props = rawActionProps(runContext)
    const base = buildRunContextView(runContext)
    const items = asArray(resolveRunContextValue(props['items'], base))
    const actions = asActionList(props['actions'])
    const limit = Math.min(items.length, maxIterationsOf(props))
    const continueOnItemError = props['continueOnItemError'] === true

    return yield* Effect.tryPromise({
      // A per-item rejection is now caught inside the sequence, so this catch
      // only fires for a defect in the iteration machinery itself.
      try: () => runAllIterations({ items, limit, actions, base, invoke, continueOnItemError }),
      catch: (cause) =>
        new LoopIterationError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.match({
        onSuccess: (tally) => loopOutcome(tally, continueOnItemError),
        onFailure: (error) => fail(error.message),
      })
    )
  }).pipe(Effect.withSpan('automations.handle-loop-each', { attributes: actionAttributes(action) }))
