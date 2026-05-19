/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { RecordBatchCreateActionSchema } from './batch-create'
import { RecordBatchDeleteActionSchema } from './batch-delete'
import { RecordBatchUpdateActionSchema } from './batch-update'
import { RecordCreateActionSchema } from './create'
import { RecordDeleteActionSchema } from './delete'
import { RecordReadActionSchema } from './read'
import { RecordUpdateActionSchema } from './update'

export const RecordActionSchema = Schema.Union(
  RecordCreateActionSchema,
  RecordReadActionSchema,
  RecordUpdateActionSchema,
  RecordDeleteActionSchema,
  RecordBatchCreateActionSchema,
  RecordBatchUpdateActionSchema,
  RecordBatchDeleteActionSchema
).pipe(
  Schema.annotations({
    identifier: 'RecordAction',
    title: 'Record Action',
    description: 'CRUD and batch operations on application tables',
  })
)

export type RecordAction = Schema.Schema.Type<typeof RecordActionSchema>

export * from './batch-create'
export * from './batch-delete'
export * from './batch-update'
export * from './create'
export * from './delete'
export * from './read'
export * from './update'
