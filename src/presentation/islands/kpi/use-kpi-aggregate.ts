/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createRecordsClient } from '@/presentation/api/client'
import { useLazySharedFilter } from '../hooks/use-lazy-shared-filter'
import { useLiveRefresh } from '../hooks/use-realtime-subscription'
import { retryUnlessRateLimited } from '../runtime/read-failure'
import { aggregateKpi, type KpiAggregateConfig } from './kpi-compute'
import { buildFilterParam, useKpiRecords, type KpiRecordsDataSource } from './use-kpi-records'

const apiClient = createRecordsClient(typeof window !== 'undefined' ? window.location.origin : '')

/** The aggregate read's `aggregate` parameter for a KPI; none for a count, which the read always answers. */
const aggregateParam = (aggregate: KpiAggregateConfig): string | undefined =>
  aggregate.function === 'count' || aggregate.field === undefined
    ? undefined
    : `${aggregate.field}:${aggregate.function}`

/** The aggregate read's answer, as far as a KPI reads it. */
interface AggregateAnswer {
  readonly aggregations?: Readonly<Record<string, unknown>>
  readonly ratio?: {
    readonly numerator: number
    readonly denominator: number
    readonly percent: number | null
  }
}

/**
 * A figure: its metric — a ratio's is `null` over an empty denominator, no
 * figure rather than `0` — and the caption a ratio draws under it.
 */
interface KpiFigure {
  readonly metric: number | null
  readonly caption?: string
}

const EMPTY_RATIO: NonNullable<AggregateAnswer['ratio']> = {
  numerator: 0,
  denominator: 0,
  percent: null,
}

/**
 * The figure a KPI shows, read off the aggregate read's answer: `0` over no
 * values; for a ratio, its percentage — `null` over an empty denominator —
 * and its two counts as the `x / y` caption.
 */
const figureOf = (
  answer: AggregateAnswer | undefined,
  aggregate: KpiAggregateConfig
): KpiFigure => {
  if (aggregate.function === 'ratio') return ratioFigure(answer?.ratio)
  const value = Number(answer?.aggregations?.[aggregate.function])
  return { metric: Number.isFinite(value) ? value : 0 }
}

/** A ratio's percentage, or `null` with a `0 / 0` caption before any answer. */
const ratioFigure = ({ numerator, denominator, percent } = EMPTY_RATIO) => ({
  metric: percent,
  caption: `${String(numerator)} / ${String(denominator)}`,
})

/** The aggregate read's `numerator` and `denominator` parameters for a ratio KPI. */
const ratioQuery = (aggregate: KpiAggregateConfig): Readonly<Record<string, string>> => {
  const numerator = buildFilterParam(aggregate.numerator?.filter)
  const denominator = buildFilterParam(aggregate.denominator?.filter)
  return aggregate.function === 'ratio' && numerator !== undefined && denominator !== undefined
    ? { numerator, denominator }
    : {}
}

/** Ask the aggregate read; a signed-out visitor's refusal reads as no figure (GAP-I1). */
const fetchAggregations = async (
  table: string,
  query: Readonly<Record<string, string>>
): Promise<AggregateAnswer | undefined> => {
  const res = await apiClient.api.tables[':tableId'].aggregate.$get({
    param: { tableId: table },
    query,
  })
  // A KPI on a public page read by a signed-out visitor keeps its label with a
  // neutral figure rather than an error region.
  if (res.status === 401 || res.status === 403) return undefined
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to aggregate records: ${String(res.status)} ${body}`, {
      cause: { status: res.status },
    })
  }
  return (await res.json()) as AggregateAnswer
}

/**
 * A KPI's figure from ONE aggregate read (`GET /api/tables/:t/aggregate`),
 * computed by the database over every matching record — never a page of rows
 * reduced in the browser, which was one full records read per card and wrong
 * past the hundredth record.
 *
 * The query key names the question (table, filter, figure), not the card, so
 * two cards asking the same thing share one request through the page's one
 * query client. Pass no data source to leave it idle.
 */
export function useKpiAggregate(
  dataSource: KpiRecordsDataSource | undefined,
  aggregate: KpiAggregateConfig
) {
  const shared = useLazySharedFilter(
    { bindTo: dataSource?.bindTo, sharedFilter: dataSource?.sharedFilter },
    buildFilterParam(dataSource?.filter)
  )
  const { filterParam, extraParams } = shared
  const figure = aggregateParam(aggregate)
  const query = {
    ...extraParams,
    ...(filterParam === undefined ? {} : { filter: filterParam }),
    ...(figure === undefined ? {} : { aggregate: figure }),
    ...ratioQuery(aggregate),
  }
  const table = dataSource?.table

  return useQuery({
    queryKey: ['table-aggregate', table, query],
    enabled: table !== undefined && shared.ready,
    retry: retryUnlessRateLimited,
    queryFn: () =>
      table === undefined ? Promise.resolve(undefined) : fetchAggregations(table, query),
    select: (answer: AggregateAnswer | undefined) => figureOf(answer, aggregate),
  })
}

/** A view-bound tile reads the view's records, whatever the server resolved. */
const readsAggregate = (source: KpiRecordsDataSource, resolved: boolean): boolean =>
  resolved && source.view === undefined

/**
 * What a table-bound KPI card draws: its figure (from the aggregate read when
 * the server resolved it can answer, else reduced from a page of records) and
 * the records a sparkline reads. Both reads are made only when needed.
 */
export function useKpiTileFigure(
  source: KpiRecordsDataSource,
  options: {
    readonly aggregate: KpiAggregateConfig
    readonly aggregateRead: boolean
    readonly sparkline: boolean
  }
) {
  const { aggregate } = options
  const aggregateRead = readsAggregate(source, options.aggregateRead)
  const readsRecords = !aggregateRead || options.sparkline
  const figure = useKpiAggregate(aggregateRead ? source : undefined, aggregate)
  const listed = useKpiRecords(readsRecords ? source : undefined)
  const rows = listed.data?.records ?? []
  const refetchFigure = figure.refetch
  const refetchRecords = listed.refetch
  // A retry, and a live re-read, ask again only what was read on load: the
  // figure, and the records only when the tile reduces them or draws a sparkline.
  const retry = useCallback(() => {
    if (aggregateRead) void refetchFigure()
    if (readsRecords) void refetchRecords()
  }, [aggregateRead, readsRecords, refetchFigure, refetchRecords])
  useLiveRefresh(source, retry)
  const error = figure.error ?? listed.error
  return {
    rows,
    ...(aggregateRead ? (figure.data ?? { metric: 0 }) : { metric: aggregateKpi(rows, aggregate) }),
    isLoading: figure.isLoading || listed.isLoading,
    error,
    isError: error !== null,
    retry,
  }
}
