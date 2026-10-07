/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolvePageLocale } from '../runtime/page-locale'
import { isRateLimitedRead } from '../runtime/read-failure'
import { KpiCard, type KpiTrendConfig } from './kpi-card'
import {
  computeSparklineSeries,
  formatKpiValue,
  resolveKpiThresholdColor,
  type KpiAggregateConfig,
  type KpiFormatConfig,
  type KpiSparklineConfig,
  type KpiThresholdConfig,
} from './kpi-compute'
import { KpiError, KpiLoading, KpiMissingTable, KpiRateLimited } from './kpi-states'
import { useKpiTileFigure } from './use-kpi-aggregate'
import { KPI_NEUTRAL_VALUE, useKpiSystemValue } from './use-kpi-system-value'
import type { CurrencyDisplayOptions } from '@/domain/kernel/format/currency-format'
import type { KpiSystemSource } from '@/domain/models/app/pages/components/component-types/data/kpi'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

/**
 * KPI data source — discriminated: a DB table (`{ table, view?, filter? }`,
 * aggregated by the server's aggregate read) OR a system read endpoint (`{ system: {...} }`,
 * pre-computed scalar value-path).
 */
type KpiTableSource = {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
}
type KpiDataSourceProp = KpiTableSource | { readonly system: KpiSystemSource }

/** Presentation config shared by both bindings. */
interface KpiPresentationProps {
  readonly label?: string
  readonly kpiFormat?: KpiFormatConfig
  readonly icon?: string
  /** Server-resolved geometry for `icon` (see `@/presentation/utils/lucide-glyph`). */
  readonly iconNode?: unknown
  readonly trend?: KpiTrendConfig
  /** The value's classes and its tone's ink, resolved server-side. */
  readonly valueClassName?: string
  readonly toneClassName?: string
  /** The rate-limited notice's words in the page language (`rateLimit.*`), where they differ from English. */
  readonly uiStrings?: Readonly<Record<string, string>>
}

interface KpiIslandProps extends KpiPresentationProps {
  readonly dataSource?: KpiDataSourceProp
  readonly kpiAggregate?: KpiAggregateConfig
  readonly thresholds?: readonly KpiThresholdConfig[]
  readonly sparkline?: KpiSparklineConfig
  /** The aggregated field's currency display, resolved server-side from `app.tables`. */
  readonly valueCurrency?: CurrencyDisplayOptions
  /** The figure comes from one aggregate read (resolved server-side); else from a page of records. */
  readonly aggregateRead?: boolean
}

/** Narrowing guard: is this data source the system read-endpoint variant? */
function isSystemSource(
  dataSource: KpiDataSourceProp | undefined
): dataSource is { readonly system: KpiSystemSource } {
  return Boolean(dataSource && 'system' in dataSource && dataSource.system)
}

/**
 * System read-endpoint binding — reads a pre-computed scalar at `valuePath`
 * (formatted via `kpiFormat`) or interpolates a `valueTemplate`. While in flight,
 * and on a failed fetch / missing path, it degrades CALMLY to the neutral em-dash
 * value so the card keeps its server-known label (never a raw error region).
 */
function KpiSystemTile({
  system,
  label,
  kpiFormat,
  icon,
  iconNode,
  trend,
  valueClassName,
  toneClassName,
}: KpiPresentationProps & { readonly system: KpiSystemSource }): ReactElement {
  const { data } = useKpiSystemValue(system)
  const value =
    data?.kind === 'value'
      ? formatKpiValue(data.value, kpiFormat, resolvePageLocale())
      : data?.kind === 'template'
        ? data.value
        : KPI_NEUTRAL_VALUE

  return (
    <KpiCard
      label={label}
      value={value}
      icon={icon}
      iconNode={iconNode}
      trend={trend}
      valueClassName={valueClassName}
      toneClassName={toneClassName}
    />
  )
}

/**
 * DB-table binding — the figure from one aggregate read (a page of records
 * reduced here when the figure is one the read cannot answer), formatted via
 * `kpiFormat`. A sparkline still reads its records.
 */
function KpiTableTile({
  source,
  kpiAggregate,
  kpiFormat,
  thresholds,
  sparkline,
  valueCurrency,
  uiStrings,
  aggregateRead,
  ...card
}: KpiPresentationProps & {
  readonly source: KpiTableSource
  readonly kpiAggregate?: KpiAggregateConfig
  readonly thresholds?: readonly KpiThresholdConfig[]
  readonly sparkline?: KpiSparklineConfig
  readonly valueCurrency?: CurrencyDisplayOptions
  readonly aggregateRead?: boolean
}): ReactElement {
  const { rows, metric, caption, isLoading, isError, error, retry } = useKpiTileFigure(source, {
    aggregate: kpiAggregate ?? { function: 'count' },
    aggregateRead: aggregateRead === true,
    sparkline: sparkline !== undefined,
  })

  if (isLoading) return <KpiLoading />
  if (isError && isRateLimitedRead(error))
    return (
      <KpiRateLimited
        label={card.label}
        onRetry={retry}
        strings={uiStrings}
      />
    )
  if (isError)
    return (
      <KpiError
        error={error}
        label={card.label}
      />
    )

  // A ratio over an empty denominator has no figure: the neutral dash, no threshold.
  const formatted =
    metric === null
      ? KPI_NEUTRAL_VALUE
      : formatKpiValue(metric, kpiFormat, resolvePageLocale(), valueCurrency)
  const thresholdColor = metric === null ? undefined : resolveKpiThresholdColor(metric, thresholds)
  const sparklineSeries = sparkline ? computeSparklineSeries(rows, sparkline) : undefined

  return (
    <KpiCard
      {...card}
      value={formatted}
      caption={caption}
      thresholdColor={thresholdColor}
      sparklineSeries={sparklineSeries}
    />
  )
}

/**
 * KPI island — client-side data-bound single-metric card.
 *
 * Dispatches on the discriminated `dataSource`:
 * - `{ system: {...} }` → {@link KpiSystemTile} (pre-computed scalar value-path)
 * - `{ table, ... }`    → {@link KpiTableTile} (one aggregate read)
 * - neither            → {@link KpiMissingTable}
 *
 * The island host names the KPI (`data-component="kpi"`); every branch writes
 * its `data-kpi-state` there.
 */
export default function KpiIsland({
  dataSource,
  label,
  kpiAggregate,
  kpiFormat,
  icon,
  iconNode,
  trend,
  thresholds,
  sparkline,
  valueCurrency,
  uiStrings,
  aggregateRead,
  valueClassName,
  toneClassName,
}: KpiIslandProps): ReactElement {
  if (isSystemSource(dataSource)) {
    return (
      <KpiSystemTile
        system={dataSource.system}
        label={label}
        kpiFormat={kpiFormat}
        icon={icon}
        iconNode={iconNode}
        trend={trend}
        valueClassName={valueClassName}
        toneClassName={toneClassName}
      />
    )
  }

  if (dataSource && 'table' in dataSource && dataSource.table) {
    return (
      <KpiTableTile
        source={dataSource}
        label={label}
        kpiAggregate={kpiAggregate}
        kpiFormat={kpiFormat}
        icon={icon}
        iconNode={iconNode}
        trend={trend}
        thresholds={thresholds}
        sparkline={sparkline}
        valueCurrency={valueCurrency}
        uiStrings={uiStrings}
        aggregateRead={aggregateRead}
        valueClassName={valueClassName}
        toneClassName={toneClassName}
      />
    )
  }

  return <KpiMissingTable />
}
