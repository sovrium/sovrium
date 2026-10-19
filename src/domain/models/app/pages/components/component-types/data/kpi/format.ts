/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

export const KPIFormatTypeSchema = Schema.Literals([
  'number',
  'currency',
  'percentage',
  'compact',
  'bytes',
  'duration',
]).annotate({
  title: 'KPI Format Type',
  description:
    'Display format for the KPI metric value. duration = an elapsed time as one compact figure in the page language (180 ms, 8.9 s, 2 min 49 s, 1 h 05 min), the same figure a `duration` column prints; the value is read as milliseconds unless `options.unit` is `s` (seconds).',
})

export const KPIFormatSchema = Schema.Struct({
  type: KPIFormatTypeSchema,
  options: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description:
        'Additional format options (e.g., { currency: "USD" }). With type duration, unit names what the value counts: ms (the default) or s.',
    })
  ),
}).annotate({
  title: 'KPI Format',
  description: 'Display formatting configuration for the KPI metric value',
})

/** @public */
export type KPIFormatType = Schema.Schema.Type<typeof KPIFormatTypeSchema>
/** @public */
export type KPIFormat = Schema.Schema.Type<typeof KPIFormatSchema>
