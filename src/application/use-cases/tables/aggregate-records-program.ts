/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The aggregate read — `GET /api/tables/:table/aggregate`.
 *
 * A KPI or a chart needs a FIGURE, not rows. This program answers the figures
 * over every record the filter matches, computed by the database, and nothing
 * else: no page, no records. It costs the same statements and reads the same
 * rows whatever the table holds — one aggregate row, and with `groupBy` one row
 * per group, never more than {@link MAX_AGGREGATE_GROUPS} of them.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { ValidationError } from '@/domain/errors'
import { MAX_AGGREGATE_GROUPS } from '@/domain/models/api/tables/aggregate'
import {
  answerOrderedAggregations,
  reshapeShortcutAggregations,
  type AggregateConfig,
  type AggregationOutput,
  type GroupPartition,
} from './aggregation-helpers'
import { lookupReadMasks } from './lookup-read-masks'
import { orderedAnswerFor, readRecordGroups } from './record-groups'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type {
  GroupInterval,
  QueryFilter,
} from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App } from '@/domain/models/app'

export interface AggregateRecordsConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  readonly userGroups?: readonly string[]
  readonly filter?: QueryFilter
  readonly includeDeleted?: boolean
  readonly aggregate?: AggregateConfig
  readonly groupBy?: string
  readonly interval?: GroupInterval
  /**
   * A ratio's two sides, each the FULL filter of its count: the read's own
   * filter (row rule and search included) AND that side's conditions.
   */
  readonly ratio?: { readonly numerator?: QueryFilter; readonly denominator?: QueryFilter }
}

/** A ratio's two counts and their quotient as a percentage, `null` over an empty denominator. */
export interface AggregateRatio {
  readonly numerator: number
  readonly denominator: number
  readonly percent: number | null
}

export interface AggregateRecordsAnswer {
  readonly aggregations: AggregationOutput
  readonly ratio?: AggregateRatio
  readonly groups?: readonly GroupPartition[]
}

/**
 * The figures asked for, always with the count: a widget that sums a column
 * still needs to know how many records it summed, and an empty request asks
 * for the count alone.
 */
const withCount = (
  aggregate: Readonly<AggregateConfig> | undefined
): Readonly<AggregateConfig> => ({
  ...aggregate,
  count: true,
})

/** How many records one filter matches, read exactly as the figures are. */
const countWhere = (config: AggregateRecordsConfig, filter: QueryFilter | undefined) =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const { app, tableName, session } = config
    const aggregate = withCount(undefined)
    const lookupMasks = yield* lookupReadMasks(
      app,
      tableName,
      { session, role: config.userRole, groups: config.userGroups ?? [] },
      { filter, aggregate: aggregate as Readonly<Record<string, unknown>> }
    )
    const computed = yield* repo.computeAggregations({
      session,
      tableName,
      filter,
      includeDeleted: config.includeDeleted,
      aggregate,
      lookupMasks,
    })
    return Number(computed.count ?? 0)
  })

/**
 * Both counts of a ratio, and `numerator ÷ denominator × 100` — `null` when
 * nothing is below the line; nothing when no ratio was asked.
 */
const readRatio = (config: AggregateRecordsConfig) =>
  Effect.gen(function* () {
    if (config.ratio === undefined) return {}
    const numerator = yield* countWhere(config, config.ratio.numerator)
    const denominator = yield* countWhere(config, config.ratio.denominator)
    const percent = denominator === 0 ? null : (numerator / denominator) * 100
    return { ratio: { numerator, denominator, percent } }
  })

export function createAggregateRecordsProgram(
  config: AggregateRecordsConfig
): Effect.Effect<
  AggregateRecordsAnswer,
  DatabaseError | ValidationError,
  TableRepository | AuthRepository | DataSourceRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { app, tableName, session, filter, includeDeleted, groupBy } = config
    const aggregate = withCount(config.aggregate)
    // A lookup the read steers on is evaluated as empty where its linked record
    // is hidden from this reader, exactly as on the list endpoint.
    const lookupMasks = yield* lookupReadMasks(
      app,
      tableName,
      { session, role: config.userRole, groups: config.userGroups ?? [] },
      { filter, aggregate: aggregate as Readonly<Record<string, unknown>>, groupBy }
    )
    const computed = yield* repo.computeAggregations({
      session,
      tableName,
      filter,
      includeDeleted,
      aggregate,
      lookupMasks,
    })
    const raw = answerOrderedAggregations(computed, orderedAnswerFor(app, tableName))
    const aggregations = aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw
    const ratio = yield* readRatio(config)
    if (groupBy === undefined) return { aggregations, ...ratio }

    const { groups, overCap } = yield* readRecordGroups({
      app,
      tableName,
      filter,
      includeDeleted,
      lookupMasks,
      levels: [{ field: groupBy, ...(config.interval ? { interval: config.interval } : {}) }],
      aggregate,
      order: { kind: 'by-value' },
      maxGroups: MAX_AGGREGATE_GROUPS,
    })
    // Refused rather than cut short: a chart missing its 501st category reads
    // as a true chart.
    if (overCap) {
      return yield* Effect.fail(
        new ValidationError(
          `The grouping produces more than ${String(MAX_AGGREGATE_GROUPS)} groups; group by a field with fewer values or narrow the filter`
        )
      )
    }
    return { aggregations, ...ratio, groups }
  }).pipe(Effect.withSpan('tables.create-aggregate-records-program'))
}
