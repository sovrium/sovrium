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

type KpiTableSource = {
  readonly table: string
  readonly view?: string
  readonly filter?: readonly DataFilter[]
}
type KpiDataSourceProp = KpiTableSource | { readonly system: KpiSystemSource }

interface KpiPresentationProps {
  readonly label?: string
  readonly kpiFormat?: KpiFormatConfig
  readonly icon?: string
  readonly trend?: KpiTrendConfig
}

interface KpiIslandProps extends KpiPresentationProps {
  readonly dataSource?: KpiDataSourceProp
  readonly kpiAggregate?: KpiAggregateConfig
  readonly thresholds?: readonly KpiThresholdConfig[]
  readonly sparkline?: KpiSparklineConfig
}

function isSystemSource(
  dataSource: KpiDataSourceProp | undefined
): dataSource is { readonly system: KpiSystemSource } {
  return Boolean(dataSource && 'system' in dataSource && dataSource.system)
}

function KpiSystemTile({
  system,
  label,
  kpiFormat,
  icon,
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
      trend={trend}
    />
  )
}

function KpiTableTile({
  source,
  label,
  kpiAggregate,
  kpiFormat,
  icon,
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
      trend={trend}
      thresholdColor={thresholdColor}
      sparklineSeries={sparklineSeries}
    />
  )
}

export default function KpiIsland({
  dataSource,
  label,
  kpiAggregate,
  kpiFormat,
  icon,
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
        trend={trend}
        thresholds={thresholds}
        sparkline={sparkline}
      />
    )
  }

  return <KpiMissingTable />
}
