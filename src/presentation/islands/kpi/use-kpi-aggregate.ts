/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createRecordsClient } from '@/presentation/islands/runtime/rpc-client'
import { useLazySharedFilter } from '../hooks/use-lazy-shared-filter'
import { useLiveRefresh } from '../hooks/use-realtime-subscription'
import { retryFaultsOnly } from '../runtime/read-failure'
import { aggregateKpi, type KpiAggregateConfig } from './kpi-compute'
import {
  buildFilterParam,
  requestRecords,
  useKpiRecords,
  type KpiRecordsDataSource,
} from './use-kpi-records'

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
 * values, but no figure for a percentile over none; for a ratio, its percentage — `null` over an empty denominator —
 * and its two counts as the `x / y` caption.
 */
const figureOf = (
  answer: AggregateAnswer | undefined,
  aggregate: KpiAggregateConfig
): KpiFigure => {
  if (aggregate.function === 'ratio') return ratioFigure(answer?.ratio, aggregate.caption)
  const figure = answer?.aggregations?.[aggregate.function]
  // A percentile over no values is no figure — the neutral dash — never a 0 that reads as instant.
  if (figure === null && aggregate.function.startsWith('p')) return { metric: null }
  const value = Number(figure)
  return { metric: Number.isFinite(value) ? value : 0 }
}

/**
 * A ratio's percentage, or `null` before any answer, and its footer: the
 * author's sentence with the two counts in place of every `{numerator}` and
 * `{denominator}`, the bare `3 / 8` when none is written, nothing for `false`.
 */
const ratioFigure = (
  ratio = EMPTY_RATIO,
  caption: string | false = '{numerator} / {denominator}'
): KpiFigure =>
  caption === false
    ? { metric: ratio.percent }
    : {
        metric: ratio.percent,
        caption: caption.replace(
          /\{(numerator|denominator)\}/g,
          (_, side: 'numerator' | 'denominator') => String(ratio[side])
        ),
      }

/** The aggregate read's `numerator` and `denominator` parameters for a ratio KPI. */
const ratioQuery = (aggregate: KpiAggregateConfig): Readonly<Record<string, string>> => {
  const numerator = buildFilterParam(aggregate.numerator?.filter)
  const denominator = buildFilterParam(aggregate.denominator?.filter)
  return aggregate.function === 'ratio' && numerator !== undefined && denominator !== undefined
    ? { numerator, denominator }
    : {}
}

/**
 * Ask the aggregate read — or, for a ratio bound to a view, the view's own
 * read, which counts both sides over every row the view returns; a signed-out
 * visitor's refusal reads as no figure (GAP-I1).
 */
const fetchAggregations = async (
  table: string,
  view: string | undefined,
  query: Readonly<Record<string, string>>
): Promise<AggregateAnswer | undefined> => {
  const res = await (view === undefined
    ? apiClient.api.tables[':tableId'].aggregate.$get({ param: { tableId: table }, query })
    : requestRecords(table, view, { ...query, limit: '1' }))
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
  const view = dataSource?.view

  return useQuery({
    queryKey: ['table-aggregate', table, view, query],
    enabled: table !== undefined && shared.ready,
    retry: retryFaultsOnly,
    queryFn: () =>
      table === undefined ? Promise.resolve(undefined) : fetchAggregations(table, view, query),
    select: (answer: AggregateAnswer | undefined) => figureOf(answer, aggregate),
  })
}

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
  // `aggregateRead` is the server's: never for a view-bound tile, save a ratio,
  // whose two counts the view's own read answers (`resolveKpiAggregateRead`).
  const { aggregate, aggregateRead } = options
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
