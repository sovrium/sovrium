/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../../data-source'


export const ChartDbDataSourceSchema = DataSourceSchema

export const ChartSystemSourceSchema = Schema.Struct({
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Read endpoint path to fetch rows from (e.g. /api/analytics/overview)',
      examples: ['/api/analytics/overview'],
    })
  ),
  rowsKey: Schema.optional(
    Schema.String.annotations({
      description: "Key of the rows array in the response envelope (default: 'items')",
    })
  ),
  query: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    }).annotations({
      description: 'Static query params merged into every request to the endpoint',
    })
  ),
}).annotations({
  title: 'Chart System Source',
  description:
    'Read-endpoint binding: feed the chart rows from a system endpoint instead of a DB table',
})

export const ChartDataSourceSchema = Schema.Union(
  ChartDbDataSourceSchema,
  Schema.Struct({
    system: ChartSystemSourceSchema,
  }).annotations({
    title: 'Chart System Data Source',
    description: 'System read-endpoint binding for the chart',
  })
).annotations({
  identifier: 'ChartDataSource',
  title: 'Chart Data Source',
  description:
    'Data binding for the chart: a DB table (series over DB rows) OR a system read endpoint (series over endpoint rows)',
})


export type ChartSystemSource = Schema.Schema.Type<typeof ChartSystemSourceSchema>
