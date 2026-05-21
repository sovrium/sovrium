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
import { KPIFormatSchema } from './format'
import { KPISparklineSchema } from './sparkline'
import { KPIThresholdSchema } from './thresholds'
import { KPITrendSchema } from './trend'


export const KpiTypeLiteral = Schema.Literal('kpi')

export const kpiFields = {
  ...coreFields,
  ...contentFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  ...dataBoundFields,
  label: Schema.optional(
    Schema.String.annotations({
      description: 'Descriptive text displayed above the KPI metric value',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed alongside the KPI metric (e.g., dollar-sign)',
    })
  ),
  kpiAggregate: Schema.optional(KPIAggregateSchema),
  trend: Schema.optional(KPITrendSchema),
  kpiFormat: Schema.optional(KPIFormatSchema),
  thresholds: Schema.optional(
    Schema.Array(KPIThresholdSchema).pipe(
      Schema.minItems(1),
      Schema.annotations({ description: 'Conditional color thresholds for KPI value' })
    )
  ),
  sparkline: Schema.optional(KPISparklineSchema),
} as const


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

export { KPIFormatTypeSchema, KPIFormatSchema, type KPIFormatType, type KPIFormat } from './format'

export { KPIThresholdSchema, type KPIThreshold } from './thresholds'

export {
  SparklineDateIntervalSchema,
  KPISparklineSchema,
  type SparklineDateInterval,
  type KPISparkline,
} from './sparkline'
