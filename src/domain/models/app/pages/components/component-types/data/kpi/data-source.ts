/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataSourceSchema } from '../../../data-source'


export const KpiDbDataSourceSchema = DataSourceSchema

export const KpiSystemSourceSchema = Schema.Struct({
  endpoint: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Read endpoint path to fetch the scalar from (e.g. /api/admin/overview)',
      examples: ['/api/admin/overview'],
    })
  ),
  valuePath: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Dotted path to a single scalar in the fetched envelope',
        examples: ['records.total', 'storage.totalBytes'],
      })
    )
  ),
  valueTemplate: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Template interpolating {dotted.path} tokens from the fetched envelope',
        examples: ['{connections.healthy}/{connections.total}'],
      })
    )
  ),
  query: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
    }).annotations({
      description: 'Static query params merged into the request to the endpoint',
    })
  ),
}).annotations({
  title: 'KPI System Source',
  description:
    'Read-endpoint binding: read a single pre-computed scalar (or a value template) from a system endpoint instead of aggregating a DB table',
})

export const KpiDataSourceSchema = Schema.Union(
  KpiDbDataSourceSchema,
  Schema.Struct({
    system: KpiSystemSourceSchema,
  }).annotations({
    title: 'KPI System Data Source',
    description: 'System read-endpoint binding for the KPI',
  })
).annotations({
  identifier: 'KpiDataSource',
  title: 'KPI Data Source',
  description:
    'Data binding for the KPI: a DB table (aggregated client-side) OR a system read endpoint (pre-computed scalar value-path)',
})


export type KpiSystemSource = Schema.Schema.Type<typeof KpiSystemSourceSchema>
