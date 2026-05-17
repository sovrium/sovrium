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
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

/**
 * `loop/each` handler — for-each over an array.
 *
 * Iterates the array referenced by `props.items` (a `{{...}}` template) and,
 * for each item, runs the nested `props.actions` sub-sequence with the
 * current item exposed as `{{loop.item}}` / `{{loop.item.<field>}}` and the
 * zero-based position as `{{loop.index}}`. Per-item outputs are collected
 * into `steps.<name>.results[]`.
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
 * Spec: APP-AUTOMATION-ACTION-LOOP-EACH-NNN + REGRESSION.
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

const ok = (output: Record<string, unknown>): ActionOutcome =>
  ({ status: 'success', output }) as const satisfies ActionOutcome

const fail = (message: string): ActionOutcome =>
  ({ status: 'failure', error: message }) as const satisfies ActionOutcome

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

/** Run all iterations sequentially (one Promise chain) so step order and a
 *  failing item surface deterministically. */
const runAllIterations = (input: {
  readonly items: readonly unknown[]
  readonly limit: number
  readonly actions: ReadonlyArray<Readonly<Record<string, unknown>>>
  readonly base: Readonly<Record<string, unknown>>
  readonly invoke: NonNullable<ActionRunContext['invokeNativeAction']>
}): Promise<readonly unknown[]> => {
  const { items, limit, actions, base, invoke } = input
  const indices = Array.from({ length: limit }, (_v, i) => i)
  return indices.reduce<Promise<readonly unknown[]>>(async (prev, i) => {
    const collected = await prev
    const itemContext = { ...base, loop: { item: items[i], index: i } }
    const result = await runIteration({ actions, itemContext, invoke })
    return [...collected, result ?? {}]
  }, Promise.resolve<readonly unknown[]>([]))
}

export const handleLoopEach: ActionHandler = (_action, _app, _automation, runContext) =>
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

    return yield* Effect.tryPromise({
      try: () => runAllIterations({ items, limit, actions, base, invoke }),
      catch: (cause) =>
        new LoopIterationError({
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        }),
    }).pipe(
      Effect.match({
        onSuccess: (results) => ok({ results, iterations: results.length }),
        onFailure: (error) => fail(error.message),
      })
    )
  })
