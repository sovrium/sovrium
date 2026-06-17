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
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

interface KpiIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
  }
  readonly label?: string
  readonly kpiAggregate?: KpiAggregateConfig
  readonly kpiFormat?: KpiFormatConfig
  readonly icon?: string
  readonly trend?: KpiTrendConfig
  readonly thresholds?: readonly KpiThresholdConfig[]
  readonly sparkline?: KpiSparklineConfig
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
  const { data, isLoading, isError, error } = useKpiRecords(dataSource)

  if (!dataSource?.table) return <KpiMissingTable />
  if (isLoading) return <KpiLoading />
  if (isError)
    return (
      <KpiError
        error={error}
        label={label}
      />
    )

  const records = data?.records ?? []
  const aggregate: KpiAggregateConfig = kpiAggregate ?? { function: 'count' }
  const metric = aggregateKpi(records, aggregate)
  const formatted = formatKpiValue(metric, kpiFormat)
  const thresholdColor = resolveKpiThresholdColor(metric, thresholds)
  const sparklineSeries = sparkline ? computeSparklineSeries(records, sparkline) : undefined

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
