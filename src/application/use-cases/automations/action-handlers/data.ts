/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  asArray,
  buildRunContextView,
  rawActionProps,
  resolveRunContextValue,
} from './run-context-resolution'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'


const resolveProp = resolveRunContextValue
const buildContext = buildRunContextView
const rawProps = rawActionProps
const toArray = asArray

const ok = (output: Record<string, unknown>): ActionOutcome =>
  ({ status: 'success', output }) as const satisfies ActionOutcome

const fieldOf = (item: unknown, field: string): unknown =>
  item !== null && typeof item === 'object' ? (item as Record<string, unknown>)[field] : undefined

const strProp = (
  props: Readonly<Record<string, unknown>>,
  ctx: Readonly<Record<string, unknown>>,
  key: string
): string => String(resolveProp(props[key], ctx))

const optStrProp = (
  props: Readonly<Record<string, unknown>>,
  ctx: Readonly<Record<string, unknown>>,
  key: string
): string | undefined =>
  props[key] !== undefined ? String(resolveProp(props[key], ctx)) : undefined

const numProp = (
  props: Readonly<Record<string, unknown>>,
  ctx: Readonly<Record<string, unknown>>,
  key: string
): number => Number(resolveProp(props[key], ctx))


const numericFieldValues = (items: readonly unknown[], field: string): readonly number[] =>
  items.map((item) => Number(fieldOf(item, field))).filter((n) => Number.isFinite(n))

const aggregateNumbers = (fn: string, values: readonly number[]): number => {
  if (values.length === 0) return 0
  if (fn === 'sum') return values.reduce((a, b) => a + b, 0)
  if (fn === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
  if (fn === 'min') return Math.min(...values)
  if (fn === 'max') return Math.max(...values)
  return values.length
}

const groupItems = (
  items: readonly unknown[],
  groupBy: string
): Readonly<Record<string, readonly unknown[]>> =>
  items.reduce<Record<string, readonly unknown[]>>((groups, item) => {
    const key = String(fieldOf(item, groupBy))
    return { ...groups, [key]: [...(groups[key] ?? []), item] }
  }, {})

const aggregateOne = (fn: string, items: readonly unknown[], field: string | undefined): number =>
  fn === 'count' ? items.length : aggregateNumbers(fn, numericFieldValues(items, field ?? ''))

const aggregateGrouped = (
  fn: string,
  items: readonly unknown[],
  field: string | undefined,
  groupBy: string
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(groupItems(items, groupBy)).map(
      ([key, bucket]) => [key, aggregateOne(fn, bucket, field)] as const
    )
  )

const chunk = (items: readonly unknown[], size: number): readonly (readonly unknown[])[] => {
  const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : items.length || 1
  return Array.from({ length: Math.ceil(items.length / safeSize) }, (_v, i) =>
    items.slice(i * safeSize, i * safeSize + safeSize)
  )
}

const compareByKey = (fn: string): ((a: unknown, b: unknown) => number) => {
  const dir = fn === 'desc' ? -1 : 1
  return (a, b) => {
    if (a === b) return 0
    const lt = (a as never) < (b as never)
    return (lt ? -1 : 1) * dir
  }
}


const withRunContext = (
  runContext: ActionRunContext | undefined,
  body: (
    props: Readonly<Record<string, unknown>>,
    ctx: Readonly<Record<string, unknown>>
  ) => ActionOutcome
): ActionOutcome => {
  if (runContext === undefined) return { status: 'success' } as const satisfies ActionOutcome
  return body(rawProps(runContext), buildContext(runContext))
}


export const handleDataSet: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => ok({ value: resolveProp(props['value'], ctx) }))
  )

export const handleDataAggregate: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const items = toArray(resolveProp(props['input'], ctx))
      const fn = String(props['function'] ?? 'count')
      const field = optStrProp(props, ctx, 'field')
      const groupBy = optStrProp(props, ctx, 'groupBy')
      return ok({
        result:
          groupBy !== undefined
            ? aggregateGrouped(fn, items, field, groupBy)
            : aggregateOne(fn, items, field),
      })
    })
  )

export const handleDataSort: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const items = toArray(resolveProp(props['input'], ctx))
      const field = strProp(props, ctx, 'field')
      const cmp = compareByKey(String(props['direction'] ?? 'asc'))
      return ok({ result: items.toSorted((a, b) => cmp(fieldOf(a, field), fieldOf(b, field))) })
    })
  )

export const handleDataLimit: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const items = toArray(resolveProp(props['input'], ctx))
      const count = numProp(props, ctx, 'count')
      return ok({ result: items.slice(0, Number.isFinite(count) ? count : items.length) })
    })
  )

export const handleDataDeduplicate: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const items = toArray(resolveProp(props['input'], ctx))
      const key = strProp(props, ctx, 'key')
      const deduped = items.reduce<{
        readonly seen: ReadonlyArray<unknown>
        readonly out: ReadonlyArray<unknown>
      }>(
        (acc, item) => {
          const k = fieldOf(item, key)
          return acc.seen.includes(k) ? acc : { seen: [...acc.seen, k], out: [...acc.out, item] }
        },
        { seen: [], out: [] }
      )
      return ok({ result: deduped.out })
    })
  )

export const handleDataMerge: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const left = toArray(resolveProp(props['left'], ctx))
      const right = toArray(resolveProp(props['right'], ctx))
      const joinKey = optStrProp(props, ctx, 'joinKey')
      if (joinKey === undefined) return ok({ result: [...left, ...right] })
      return ok({
        result: left.map((leftItem) => {
          const match = right.find((r) => fieldOf(r, joinKey) === fieldOf(leftItem, joinKey))
          return match !== undefined && match !== null && typeof match === 'object'
            ? { ...(leftItem as Record<string, unknown>), ...(match as Record<string, unknown>) }
            : leftItem
        }),
      })
    })
  )

export const handleDataSplit: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const items = toArray(resolveProp(props['input'], ctx))
      return ok({ result: chunk(items, numProp(props, ctx, 'size')) })
    })
  )

export const handleDataCompare: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const left = toArray(resolveProp(props['left'], ctx))
      const right = toArray(resolveProp(props['right'], ctx))
      const key = strProp(props, ctx, 'key')
      const leftKeys = new Set(left.map((item) => fieldOf(item, key)))
      const rightKeys = new Set(right.map((item) => fieldOf(item, key)))
      return ok({
        result: {
          added: right.filter((item) => !leftKeys.has(fieldOf(item, key))),
          removed: left.filter((item) => !rightKeys.has(fieldOf(item, key))),
          unchanged: right.filter((item) => leftKeys.has(fieldOf(item, key))),
        },
      })
    })
  )

export const handleDataLookup: ActionHandler = (_action, _app, _automation, runContext) =>
  Effect.succeed(
    withRunContext(runContext, (props, ctx) => {
      const items = toArray(resolveProp(props['input'], ctx))
      const key = strProp(props, ctx, 'key')
      const value = resolveProp(props['value'], ctx)
      return ok({ result: items.find((item) => fieldOf(item, key) === value) })
    })
  )
