/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createAggregateRecordsProgram } from '@/application/use-cases/tables/aggregate-records-program'
import { aggregateRecordsResponseSchema } from '@/domain/models/api/tables/aggregate'
import { describeUnknownPercentile } from '@/domain/models/app/tables/aggregate-percentile-service'
import { minMaxKindOf } from '@/domain/models/app/tables/min-max-order-service'
import { provideTableLive } from '@/infrastructure/layers/table-layer'
import { runEffect } from '@/presentation/api/runtime'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { validateAggregateParam, validateGroupByParam } from './field-permission-validation'
import { parseFilter } from './list-records-filter'
import { buildSearchFilter } from './list-records-search'
import { parseAggregateParam, unknownPercentileIn } from './param-parsers'
import { resolveGuardForTable } from './row-level-guard'
import { buildListFilter, checkListReadGate, mergeFilters } from './row-level-read-helpers'
import type { FilterStructure } from './row-level-read-helpers'
import type { GroupInterval } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * `GET /api/tables/:tableId/aggregate` — the figures a KPI or a chart draws,
 * computed by the database over every record the filter matches.
 *
 * Every gate is the list endpoint's, in the list endpoint's order: the table
 * read gate and its row-level rule, the filter's field check (the `q` search
 * term is ANDed in, over the readable text fields only), then the
 * aggregated and grouped fields' read check — each refusal a `404`, so a hidden
 * field and a missing one cannot be told apart (S1). A grouping wider than the
 * cap, a calendar interval on a field that holds no date, an hour or minute on
 * a field that holds no time, or a percentile outside the five, is a `400`.
 */

const INTERVALS: ReadonlySet<string> = new Set([
  'minute',
  'hour',
  'day',
  'week',
  'month',
  'quarter',
  'year',
])

/** The buckets shorter than a day: a `date` holds no hour, so they take a datetime. */
const SUB_DAY_INTERVALS: ReadonlySet<string> = new Set(['minute', 'hour'])

/** A single grouping field, trimmed; the aggregate read groups by one field. */
const readGroupBy = (c: Context): string | undefined => {
  const raw = c.req.query('groupBy')?.trim()
  return raw === undefined || raw === '' ? undefined : raw
}

/** A `400` for a request the read cannot answer as asked. */
const badRequest = (c: Context, message: string): Response =>
  c.json({ success: false, message, code: 'VALIDATION_ERROR' }, 400)

/**
 * The interval, when it can apply: it buckets a date, so it needs a grouping
 * field that holds one. Answers a `400` response otherwise.
 */
const readInterval = (
  c: Context,
  input: { readonly app: App; readonly tableName: string; readonly groupBy: string | undefined }
): { readonly interval?: GroupInterval } | Response => {
  const raw = c.req.query('interval')
  if (raw === undefined || raw === '') return {}
  if (!INTERVALS.has(raw)) return badRequest(c, `Unknown interval '${raw}'`)
  const kind =
    input.groupBy === undefined
      ? undefined
      : minMaxKindOf(input.app, input.tableName, input.groupBy)
  if (kind !== 'date' && kind !== 'date-time') {
    return badRequest(c, 'An interval groups by a date or datetime field; name one in groupBy')
  }
  if (SUB_DAY_INTERVALS.has(raw) && kind !== 'date-time') {
    return badRequest(
      c,
      `An interval of a ${raw} groups by a datetime field; a date holds no ${raw}`
    )
  }
  return { interval: raw as GroupInterval }
}

type ParsedFilter = ReturnType<typeof parseFilter> & { readonly error: false }

/** A ratio's two sides, each the caller's conditions as `filter` would carry them. */
interface RatioSides {
  readonly numerator: ParsedFilter['value']
  readonly denominator: ParsedFilter['value']
}

/** The read's question once every gate has passed it, or the refusal to answer. */
type ReadAggregateQuestion =
  | Response
  | {
      readonly filter: ParsedFilter
      readonly aggregate: ReturnType<typeof parseAggregateParam>
      readonly groupBy: string | undefined
      readonly interval: { readonly interval?: GroupInterval }
      readonly ratio: RatioSides | undefined
    }

interface ReadAccess {
  readonly app: App
  readonly tableName: string
  readonly userRole: string
  readonly userGroups: readonly string[]
}

/**
 * The ratio's two sides, parsed and field-checked exactly as `filter` is, or
 * `undefined` when no ratio is asked. One side without the other is a `400`.
 */
const readRatioSides = (c: Context, access: ReadAccess): RatioSides | undefined | Response => {
  const { app, tableName, userRole, userGroups } = access
  const sent = ['numerator', 'denominator'].filter((side) => Boolean(c.req.query(side)))
  if (sent.length === 0) return undefined
  if (sent.length === 1) return badRequest(c, 'A ratio needs both numerator and denominator')
  const numerator = parseFilter(c, app, tableName, { userRole, userGroups, param: 'numerator' })
  if (numerator.error) return numerator.response ?? badRequest(c, 'Invalid numerator')
  const denominator = parseFilter(c, app, tableName, { userRole, userGroups, param: 'denominator' })
  if (denominator.error) return denominator.response ?? badRequest(c, 'Invalid denominator')
  return { numerator: numerator.value, denominator: denominator.value }
}

/** The filter, the figures and the grouping, each checked as the list endpoint checks it. */
const readQuestion = (c: Context, access: ReadAccess): ReadAggregateQuestion => {
  const { app, tableName, userRole, userGroups } = access
  const filter = parseFilter(c, app, tableName, { userRole, userGroups })
  if (filter.error) return filter.response ?? badRequest(c, 'Invalid filter')
  const unknownPercentile = unknownPercentileIn(c.req.query('aggregate'))
  if (unknownPercentile !== undefined) {
    return badRequest(c, describeUnknownPercentile(unknownPercentile))
  }
  const aggregate = parseAggregateParam(c.req.query('aggregate'))
  const groupBy = readGroupBy(c)
  const fieldError =
    validateAggregateParam(aggregate, { ...access, c }) ??
    validateGroupByParam(groupBy, { ...access, c })
  if (fieldError) return fieldError
  const interval = readInterval(c, { app, tableName, groupBy })
  if (interval instanceof Response) return interval
  const ratio = readRatioSides(c, access)
  if (ratio instanceof Response) return ratio
  return { filter, aggregate, groupBy, interval, ratio }
}

/**
 * Each ratio side's full filter — the read's own AND the side's conditions,
 * under the same row rule — or `'empty'` when that rule admits nothing.
 */
const ratioFilters = (
  build: (filter: FilterStructure) => FilterStructure | 'empty' | 'reject',
  requested: FilterStructure,
  ratio: RatioSides
): { readonly numerator: FilterStructure; readonly denominator: FilterStructure } | 'empty' => {
  const numerator = build(mergeFilters(requested, ratio.numerator))
  const denominator = build(mergeFilters(requested, ratio.denominator))
  return typeof numerator === 'string' || typeof denominator === 'string'
    ? 'empty'
    : { numerator, denominator }
}

/** Every figure over no records: what a row rule admitting nothing answers. */
const emptyAnswer = (question: { readonly groupBy?: string; readonly ratio?: RatioSides }) => ({
  aggregations: { count: 0 },
  ...(question.ratio ? { ratio: { numerator: 0, denominator: 0, percent: null } } : {}),
  ...(question.groupBy ? { groups: [] } : {}),
})

export async function handleAggregateRecords(c: Context, app: App) {
  const { session, tableName, userRole, userGroups } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableName)
  const guard = await resolveGuardForTable(c, session, { userRole, userGroups }, { table, app })

  const gateError = checkListReadGate({ c, app, table, userRole, userGroups, guard })
  if (gateError) return gateError

  const question = readQuestion(c, { app, tableName, userRole, userGroups })
  if (question instanceof Response) return question
  const { aggregate, groupBy, interval, ratio } = question

  // `?q=` narrows the figures exactly as it narrows the list's rows, and a
  // ratio side adds its conditions to that same filter.
  const search = buildSearchFilter({ c, app, tableName, userRole, userGroups, table })
  const requested = mergeFilters(question.filter.value, search)
  const build = (filter: FilterStructure) => buildListFilter(table, guard, undefined, filter)
  const finalFilter = build(requested)
  const sides = ratio && ratioFilters(build, requested, ratio)
  if (typeof finalFilter === 'string' || sides === 'empty') {
    // The row rule admits nothing: every figure is over no records.
    return c.json(emptyAnswer(question), 200)
  }

  return runEffect(
    c,
    provideTableLive(
      createAggregateRecordsProgram({
        session,
        tableName,
        app,
        userRole,
        userGroups,
        filter: finalFilter,
        includeDeleted: c.req.query('includeDeleted') === 'true',
        ...(aggregate ? { aggregate } : {}),
        ...(groupBy ? { groupBy } : {}),
        ...interval,
        ...(sides ? { ratio: sides } : {}),
      })
    ),
    aggregateRecordsResponseSchema
  )
}
