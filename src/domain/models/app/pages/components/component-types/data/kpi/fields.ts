/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { responsiveValue } from '../../../responsive'
import { ToneSchema } from '../../../shared-schemas'
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
  // discriminated union so a KPI can bind to either a DB table (its figure
  // computed by the server's aggregate read) OR a system read endpoint (pre-computed scalar
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
      Schema.annotate({ description: 'Conditional color thresholds for KPI value' }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  sparkline: Schema.optional(KPISparklineSchema),
  /**
   * How large the value is drawn, per breakpoint if needed. A row of four
   * figures on a phone needs a smaller value than the same row on a desktop;
   * `{ mobile: sm, md: md }` says so without a `max-md:` selector.
   */
  size: Schema.optional(
    responsiveValue(
      Schema.Literals(['sm', 'md', 'lg']).annotate({
        description: "The value's size: 'sm', 'md' (default) or 'lg'",
      }),
      "The size the KPI's value is drawn at"
    )
  ),
  /**
   * A fixed semantic colour for the value — the figure a page always shows in
   * the warning colour because of what it counts (overdue items, seats left).
   * A colour that depends on the value itself is `thresholds`' job, and a
   * matching threshold wins over the tone.
   */
  tone: Schema.optional(ToneSchema),
} as const

// ---------------------------------------------------------------------------
// Re-export all sub-schemas
// ---------------------------------------------------------------------------

export type { KpiSystemSource } from './data-source'
