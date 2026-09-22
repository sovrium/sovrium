/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { contentFields } from '../../modules/content'
import { coreFields } from '../../modules/core'
import { dataBoundFields } from '../../modules/data-bound'
import { i18nFields } from '../../modules/i18n'
import { responsiveFields } from '../../modules/responsive'
import { visibilityFields } from '../../modules/visibility'
import { KPIAggregateSchema } from './aggregate'
import { KpiDataSourceSchema } from './data-source'
import { KPIFormatSchema } from './format'
import { KPISparklineSchema } from './sparkline'
import { KPIThresholdSchema } from './thresholds'
import { KPITrendSchema } from './trend'

// ---------------------------------------------------------------------------
// Component type definition
// ---------------------------------------------------------------------------

export const KpiTypeLiteral = Schema.Literal('kpi')

export const kpiFields = {
  ...coreFields,
  ...contentFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  // Override the shared (table-only) `dataSource` with the KPI-specific
  // discriminated union so a KPI can bind to either a DB table (unchanged,
  // aggregated client-side) OR a system read endpoint (pre-computed scalar
  // value-path). Must come AFTER `...dataBoundFields` to replace its `dataSource`.
  dataSource: Schema.optional(KpiDataSourceSchema),
  label: Schema.optional(
    Schema.String.annotate({
      description: 'Descriptive text displayed above the KPI metric value',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotate({
      description: 'Lucide icon name displayed alongside the KPI metric (e.g., dollar-sign)',
    })
  ),
  kpiAggregate: Schema.optional(KPIAggregateSchema),
  trend: Schema.optional(KPITrendSchema),
  kpiFormat: Schema.optional(KPIFormatSchema),
  thresholds: Schema.optional(
    Schema.Array(KPIThresholdSchema).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({ description: 'Conditional color thresholds for KPI value' })
    )
  ),
  sparkline: Schema.optional(KPISparklineSchema),
} as const

// ---------------------------------------------------------------------------
// Re-export all sub-schemas
// ---------------------------------------------------------------------------

export {
  KPIAggregateFunctionSchema,
  KPIAggregateSchema,
  type KPIAggregateFunction,
  type KPIAggregate,
} from './aggregate'

export {
  KPIComparisonPeriodSchema,
  KPITrendDirectionSchema,
  KPITrendColorSchema,
  KPITrendSchema,
  type KPIComparisonPeriod,
  type KPITrendDirection,
  type KPITrendColor,
  type KPITrend,
} from './trend'

export {
  KpiDbDataSourceSchema,
  KpiSystemSourceSchema,
  KpiDataSourceSchema,
  type KpiSystemSource,
} from './data-source'

export {
  SparklineDateIntervalSchema,
  KPISparklineSchema,
  type SparklineDateInterval,
  type KPISparkline,
} from './sparkline'
