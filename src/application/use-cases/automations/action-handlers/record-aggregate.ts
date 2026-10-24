/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record` `aggregate` — the figure-shaped read: count, sum, average,
 * extremes and percentiles over the records a filter matches, optionally one
 * row per value of a field, computed by the database in one statement.
 *
 * It is the records API's own aggregate read (`createAggregateRecordsProgram`)
 * over the reader `record/list` reads as: the system for a run nobody started,
 * the starter of a run started by hand — their row-level read rule ANDed onto
 * the filter, the rows the records list admits them, and the fields they may
 * read. A figure only ever describes rows that reader could list.
 *
 * Output: `{ rows }` — one row without `groupBy`, one per group with it, in
 * the order of the group values. Each row holds `count`, the group's value
 * under the `groupBy` field's name, and each figure under `<field>_<op>`; a
 * `count` figure is the row's count, every other figure is `null` over no
 * values. A grouping past the aggregate read's group cap fails the step.
 */

import { Effect } from 'effect'
import { createAggregateRecordsProgram } from '@/application/use-cases/tables/aggregate-records-program'
import { isAggregatePercentile } from '@/domain/models/app/tables/aggregate-percentile-service'
import { logError } from '@/infrastructure/logging/logger'
import { buildSystemSession } from '../build-guest-session'
import { callerLinkReader, runReadAccess, type RunReadAccess } from './record-caller-gate'
import { declaredFilterFields, toQueryFilter } from './record-filter-shape'
import { filterFieldRefusal } from './record-filters'
import { READ_REFUSAL, runFieldSets, scopedListFilter } from './record-read-scope'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type {
  AggregateConfig,
  AggregationOutput,
  GroupPartition,
} from '@/application/use-cases/tables/aggregation-helpers'
import type { App } from '@/domain/models/app'

/** One figure a step asks for. */
interface Aggregation {
  readonly field: string
  readonly op: string
}

/** The figures a step declares, read off its rendered props. */
const aggregationsOf = (props: Readonly<Record<string, unknown>>): readonly Aggregation[] =>
  (Array.isArray(props['aggregations']) ? props['aggregations'] : []).flatMap((entry: unknown) => {
    const { field, op } = (entry ?? {}) as { readonly field?: unknown; readonly op?: unknown }
    return typeof field === 'string' && typeof op === 'string' ? [{ field, op }] : []
  })

/** The records API's aggregate config asking for every figure of `aggregations`. */
const aggregateConfigOf = (aggregations: readonly Aggregation[]): Readonly<AggregateConfig> => {
  const fieldsFor = (op: string) =>
    aggregations.filter((aggregation) => aggregation.op === op).map(({ field }) => field)
  const ops = [...new Set(aggregations.map(({ op }) => op).filter((op) => op !== 'count'))]
  return { count: true, ...Object.fromEntries(ops.map((op) => [op, fieldsFor(op)])) }
}

/** One figure out of an aggregate answer: `null` over no values. */
const figureOf = (answer: AggregationOutput | undefined, { field, op }: Aggregation): unknown => {
  const known = op === 'sum' || op === 'avg' || op === 'min' || op === 'max'
  if (!known && !isAggregatePercentile(op)) return null
  const byField = (answer as Readonly<Record<string, unknown>> | undefined)?.[op]
  const value = (byField as Readonly<Record<string, unknown>> | undefined)?.[field]
  return value ?? null
}

/** One output row: its count, then each figure under `<field>_<op>`. */
const rowOf = (
  count: number,
  answer: AggregationOutput | undefined,
  aggregations: readonly Aggregation[]
): Readonly<Record<string, unknown>> => ({
  count,
  ...Object.fromEntries(
    aggregations.map((aggregation) => [
      `${aggregation.field}_${aggregation.op}`,
      aggregation.op === 'count' ? count : figureOf(answer, aggregation),
    ])
  ),
})

/** The rows of a read that matched nothing the reader may list. */
const emptyRows = (
  groupBy: string | undefined,
  aggregations: readonly Aggregation[]
): readonly Readonly<Record<string, unknown>>[] =>
  groupBy === undefined ? [rowOf(0, undefined, aggregations)] : []

/**
 * Why the step cannot run as written, or `undefined`: a filter present but
 * empty, or a field the filter, a figure or the grouping names that the reader
 * may not read. A `count` figure names no field it reads.
 */
const aggregateRefusal = (input: {
  readonly app: App
  readonly tableName: string
  readonly props: Readonly<Record<string, unknown>>
  readonly access: RunReadAccess
  readonly aggregations: readonly Aggregation[]
}): string | undefined => {
  const { app, tableName, props, access, aggregations } = input
  const queryFilter = toQueryFilter(props['filter'], declaredFilterFields(app, tableName).table)
  if (props['filter'] !== undefined && queryFilter === undefined) {
    return 'record.aggregate filter must contain at least one condition'
  }
  const { filterable } = runFieldSets(app, tableName, access)
  const filterRefused =
    queryFilter === undefined ? undefined : filterFieldRefusal(tableName, queryFilter, filterable)
  if (filterRefused !== undefined) {
    return `record.aggregate could not resolve its filter: ${filterRefused.message}`
  }
  const groupBy = stringProp(props, 'groupBy').trim()
  const named = [
    ...aggregations.filter(({ op }) => op !== 'count').map(({ field }) => field),
    ...(groupBy === '' ? [] : [groupBy]),
  ]
  const unreadable = named.find((field) => filterable !== undefined && !filterable.has(field))
  return unreadable === undefined
    ? undefined
    : `record.aggregate names the field '${unreadable}', which the run may not read in table '${tableName}'`
}

/** Who the aggregate read reads as: the system, or the starter of a hand-started run. */
const readerOf = (automation: AutomationContext, access: RunReadAccess) =>
  Effect.gen(function* () {
    if (access.kind !== 'scoped') {
      return { session: buildSystemSession(), userRole: 'admin', userGroups: [] as const }
    }
    const reader = yield* callerLinkReader(
      automation.startedAsGuest === true ? undefined : automation.userId
    )
    return { session: reader.session, userRole: reader.role, userGroups: reader.groups }
  })

/** A read the database refused or could not answer, as the step's failure. */
const aggregateFailure = (error: unknown): ActionOutcome => {
  if (error instanceof Error && error.name === 'NotFoundError') return READ_REFUSAL
  if (error instanceof Error && error.name === 'ValidationError') {
    return { status: 'failure', error: `record.aggregate: ${error.message}`, retryable: false }
  }
  logError('[automations] record.aggregate could not compute its figures', error)
  return { status: 'failure', error: 'record.aggregate could not compute its figures' }
}

/** The output rows of an aggregate answer. */
const rowsOf = (
  answer: {
    readonly aggregations: AggregationOutput
    readonly groups?: readonly GroupPartition[]
  },
  groupBy: string | undefined,
  aggregations: readonly Aggregation[]
): readonly Readonly<Record<string, unknown>>[] =>
  groupBy === undefined || answer.groups === undefined
    ? [rowOf(Number(answer.aggregations.count ?? 0), answer.aggregations, aggregations)]
    : answer.groups.map((group) => ({
        [groupBy]: group.name,
        ...rowOf(group.count, group.aggregations, aggregations),
      }))

export const handleRecordAggregate: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const tableName = stringProp(props, 'table').trim()
    if (tableName === '') {
      return { status: 'failure', error: 'record.aggregate requires a table name' } as const
    }
    const access = yield* runReadAccess(app, automation, tableName)
    if (access.kind === 'refused') return READ_REFUSAL
    const aggregations = aggregationsOf(props)
    const refusal = aggregateRefusal({ app, tableName, props, access, aggregations })
    if (refusal !== undefined) return { status: 'failure', error: refusal } as const
    const groupBy = stringProp(props, 'groupBy').trim() || undefined
    const queryFilter = toQueryFilter(props['filter'], declaredFilterFields(app, tableName).table)
    const filter = scopedListFilter(queryFilter, access)
    if (filter === 'nothing') {
      return { status: 'success', output: { rows: emptyRows(groupBy, aggregations) } } as const
    }
    const reader = yield* readerOf(automation, access)
    const answered = yield* Effect.result(
      createAggregateRecordsProgram({
        ...reader,
        app,
        tableName,
        filter,
        aggregate: aggregateConfigOf(aggregations),
        groupBy,
      })
    )
    if (answered._tag === 'Failure') return aggregateFailure(answered.failure)
    return {
      status: 'success',
      output: { rows: rowsOf(answered.success, groupBy, aggregations) },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-record-aggregate', { attributes: actionAttributes(action) })
  )
