/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { DataAggregateActionSchema } from './aggregate'
import { DataCompareActionSchema } from './compare'
import { DataDeduplicateActionSchema } from './deduplicate'
import { DataLimitActionSchema } from './limit'
import { DataLookupActionSchema } from './lookup'
import { DataMergeActionSchema } from './merge'
import { DataSetActionSchema } from './set'
import { DataSortActionSchema } from './sort'
import { DataSplitActionSchema } from './split'

/**
 * Data Action — union of all data transformation operators
 */
export const DataActionSchema = Schema.Union(
  DataSetActionSchema,
  DataAggregateActionSchema,
  DataSortActionSchema,
  DataLimitActionSchema,
  DataDeduplicateActionSchema,
  DataMergeActionSchema,
  DataSplitActionSchema,
  DataCompareActionSchema,
  DataLookupActionSchema
).pipe(
  Schema.annotations({
    identifier: 'DataAction',
    title: 'Data Action',
    description:
      'Data transformation operations: set fields, aggregate, sort, limit, deduplicate, merge, split, compare, lookup',
  })
)

/** @public */
export type DataAction = Schema.Schema.Type<typeof DataActionSchema>

export * from './aggregate'
export * from './compare'
export * from './deduplicate'
export * from './limit'
export * from './lookup'
export * from './merge'
export * from './set'
export * from './sort'
export * from './split'
