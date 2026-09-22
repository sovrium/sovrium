/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { KpiCard, type KpiTrendConfig } from './kpi-card'
import {
  aggregateKpi,
  computeSparklineSeries,
  formatKpiValue,
  resolveKpiThresholdColor,
  type KpiAggregateConfig,
  type KpiFormatConfig,
  type KpiSparklineConfig,
  type KpiThresholdConfig,
} from './kpi-compute'
import { KpiError, KpiLoading, KpiMissingTable } from './kpi-states'
import { useKpiRecords } from './use-kpi-records'
import { KPI_NEUTRAL_VALUE, useKpiSystemValue } from './use-kpi-system-value'
import type { KpiSystemSource } from '@/domain/models/app/pages/components/component-types/data/kpi'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

/**
 * KPI data source — discriminated: a DB table (`{ table, view?, filter? }`,
 * aggregated client-side) OR a system read endpoint (`{ system: {...} }`,
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
}

interface KpiIslandProps extends KpiPresentationProps {
  readonly dataSource?: KpiDataSourceProp
  readonly kpiAggregate?: KpiAggregateConfig
  readonly thresholds?: readonly KpiThresholdConfig[]
  readonly sparkline?: KpiSparklineConfig
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
}: KpiPresentationProps & { readonly system: KpiSystemSource }): ReactElement {
  const { data } = useKpiSystemValue(system)
  const value =
    data?.kind === 'value'
      ? formatKpiValue(data.value, kpiFormat)
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
    />
  )
}

/**
 * DB-table binding — fetch records, aggregate via `kpiAggregate`, format via
 * `kpiFormat`. UNCHANGED from the original KPI island contract.
 */
function KpiTableTile({
  source,
  label,
  kpiAggregate,
  kpiFormat,
  icon,
  iconNode,
  trend,
  thresholds,
  sparkline,
}: KpiPresentationProps & {
  readonly source: KpiTableSource
  readonly kpiAggregate?: KpiAggregateConfig
  readonly thresholds?: readonly KpiThresholdConfig[]
  readonly sparkline?: KpiSparklineConfig
}): ReactElement {
  const { data, isLoading, isError, error } = useKpiRecords(source)

  if (isLoading) return <KpiLoading />
  if (isError)
    return (
      <KpiError
        error={error}
        label={label}
      />
    )

  const rows = data?.records ?? []
  const aggregate: KpiAggregateConfig = kpiAggregate ?? { function: 'count' }
  const metric = aggregateKpi(rows, aggregate)
  const formatted = formatKpiValue(metric, kpiFormat)
  const thresholdColor = resolveKpiThresholdColor(metric, thresholds)
  const sparklineSeries = sparkline ? computeSparklineSeries(rows, sparkline) : undefined

  return (
    <KpiCard
      label={label}
      value={formatted}
      icon={icon}
      iconNode={iconNode}
      trend={trend}
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
 * - `{ table, ... }`    → {@link KpiTableTile} (records aggregated client-side)
 * - neither            → {@link KpiMissingTable}
 *
 * Every branch emits `data-component="kpi"` so spec assertions on that canonical
 * attribute resolve in every state.
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
      />
    )
  }

  return <KpiMissingTable />
}
