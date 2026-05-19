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


const DEFAULT_MAX_ITERATIONS = 1000

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
