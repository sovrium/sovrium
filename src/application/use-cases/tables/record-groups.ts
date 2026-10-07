/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The groups of a grouped read, computed by the database.
 *
 * Shared by the grouped listing (`?groupBy=` on the records list) and the
 * aggregate read (`/aggregate`), so a group means one thing on both routes: its
 * name is the value as the records API reads it (a date as its day, a timestamp
 * as its ISO instant, an empty value as `''`), its `path` the names from the
 * outermost level down, its figures those of every matching record in it.
 *
 * The database answers one row per group; nothing here ever sees a record.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { asMinMaxAnswer, minMaxKindOf } from '@/domain/models/app/tables/min-max-order-service'
import {
  answerOrderedAggregations,
  reshapeShortcutAggregations,
  type AggregateConfig,
  type GroupPartition,
  type OrderedAnswer,
  type RawAggregations,
} from './aggregation-helpers'
import { serializeDriverRow } from './record-transformer'
import type {
  GroupedAggregationRow,
  GroupLevel,
  GroupOrder,
  LookupReadMask,
  QueryFilter,
} from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

export interface RecordGroupsQuery {
  readonly app: App
  readonly tableName: string
  readonly filter?: QueryFilter
  readonly includeDeleted?: boolean
  readonly lookupMasks?: readonly LookupReadMask[]
  readonly levels: readonly GroupLevel[]
  readonly aggregate?: AggregateConfig
  readonly order: GroupOrder
  readonly maxGroups?: number
}

/** A `min`/`max` over a date answers as the records API reads the date. */
export const orderedAnswerFor =
  (app: App, tableName: string): OrderedAnswer =>
  (field, value) =>
    asMinMaxAnswer(minMaxKindOf(app, tableName, field), value)

/** A group's name at one level: the value as the records API reads it, `''` when empty. */
const nameOf = (query: RecordGroupsQuery, level: GroupLevel, value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (level.interval !== undefined) return String(value)
  const readable = serializeDriverRow(
    { [level.field]: value },
    { app: query.app, tableName: query.tableName }
  )[level.field]
  return readable === null || readable === undefined ? '' : String(readable)
}

type Numeric = number | null
type Ordered = number | string | null

/** A figure over no values: `null` on the wire, as the database answers it. */
const NO_VALUES = null

const addNumeric = (a: Numeric | undefined, b: Numeric | undefined): Numeric =>
  a === null || a === undefined ? (b ?? NO_VALUES) : b === null || b === undefined ? a : a + b

const pickOrdered = (
  a: Ordered | undefined,
  b: Ordered | undefined,
  op: 'min' | 'max'
): Ordered => {
  if (a === null || a === undefined) return b ?? NO_VALUES
  if (b === null || b === undefined) return a
  const aFirst = a < b
  return (op === 'min') === aFirst ? a : b
}

const mergeRecords = <V>(
  a: Readonly<Record<string, V>> | undefined,
  b: Readonly<Record<string, V>> | undefined,
  merge: (x: V | undefined, y: V | undefined, field: string) => V
): Readonly<Record<string, V>> | undefined =>
  a === undefined && b === undefined
    ? undefined
    : Object.fromEntries(
        [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].map((field) => [
          field,
          merge(a?.[field], b?.[field], field),
        ])
      )

/**
 * Two database groups that read as ONE name — an empty value and a missing one
 * both read `''` — folded together, so the response never lists a name twice.
 * An average is re-weighted by how many records carried a value on each side.
 */
const mergeRows = (a: GroupedAggregationRow, b: GroupedAggregationRow): GroupedAggregationRow => {
  const x = a.aggregations
  const y = b.aggregations
  const avg = mergeRecords(x.avg, y.avg, (p, q, field) => {
    const pn = a.valued[field] ?? 0
    const qn = b.valued[field] ?? 0
    return pn + qn === 0 ? NO_VALUES : ((p ?? 0) * pn + (q ?? 0) * qn) / (pn + qn)
  })
  const valued = mergeRecords(a.valued, b.valued, (p, q) => (p ?? 0) + (q ?? 0)) ?? {}
  const merged = {
    ...(x.count === undefined ? {} : { count: String(Number(x.count) + Number(y.count ?? 0)) }),
    ...(x.sum === undefined ? {} : { sum: mergeRecords(x.sum, y.sum, addNumeric) }),
    ...(avg === undefined ? {} : { avg }),
    ...(x.min === undefined
      ? {}
      : { min: mergeRecords(x.min, y.min, (p, q) => pickOrdered(p, q, 'min')) }),
    ...(x.max === undefined
      ? {}
      : { max: mergeRecords(x.max, y.max, (p, q) => pickOrdered(p, q, 'max')) }),
  }
  return { values: a.values, count: a.count + b.count, aggregations: merged, valued }
}

/** One depth's rows as named partitions, in the order the database answered them. */
const partitionsOf = (
  query: RecordGroupsQuery,
  rows: readonly GroupedAggregationRow[]
): readonly GroupPartition[] => {
  const named = rows.map((row) => ({
    path: row.values.map((value, index) => nameOf(query, query.levels[index]!, value)),
    row,
  }))
  const byKey = [...Map.groupBy(named, (entry) => JSON.stringify(entry.path)).values()].map(
    (entries) => ({
      path: entries[0]!.path,
      row: entries.map((entry) => entry.row).reduce(mergeRows),
    })
  )
  const answer = orderedAnswerFor(query.app, query.tableName)
  const { aggregate } = query
  return byKey.map(({ path, row }) => {
    const raw: RawAggregations | undefined =
      aggregate === undefined ? undefined : answerOrderedAggregations(row.aggregations, answer)
    return {
      name: path[path.length - 1] ?? '',
      path,
      count: row.count,
      ...(raw && aggregate
        ? { aggregations: aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw }
        : {}),
    }
  })
}

/**
 * Every group at every level of a grouping: the level-1 groups, then the
 * level-2 ones, and so on — a nested grid draws a header at every depth.
 *
 * With `maxGroups`, `overCap` says some depth holds more groups than that; the
 * groups read are then incomplete and the caller refuses rather than answers.
 */
export const readRecordGroups = (
  query: RecordGroupsQuery
): Effect.Effect<
  { readonly groups: readonly GroupPartition[]; readonly overCap: boolean },
  DatabaseError,
  TableRepository
> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const depths = yield* repo.computeGroupedAggregations({
      tableName: query.tableName,
      filter: query.filter,
      includeDeleted: query.includeDeleted,
      lookupMasks: query.lookupMasks,
      levels: query.levels,
      aggregate: query.aggregate ?? {},
      order: query.order,
      ...(query.maxGroups === undefined ? {} : { maxGroups: query.maxGroups }),
    })
    const overCap =
      query.maxGroups !== undefined && depths.some((rows) => rows.length > query.maxGroups!)
    return { groups: depths.flatMap((rows) => partitionsOf(query, rows)), overCap }
  }).pipe(Effect.withSpan('tables.read-record-groups'))
