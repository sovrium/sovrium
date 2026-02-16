/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { ActivityRepositoryLive } from './repositories/activity-repository-live'
import { BatchRepositoryLive } from './repositories/batch-repository-live'
import { CommentRepositoryLive } from './repositories/comment-repository-live'
import { TableRepositoryLive } from './repositories/table-repository-live'

/**
 * Composite layer providing all table-related repository implementations
 *
 * Import this single layer in presentation routes to satisfy
 * all table, batch, comment, and activity repository requirements.
 *
 * @example
 * ```typescript
 * runEffect(c, program.pipe(Effect.provide(TableLive)), schema)
 * ```
 */
export const TableLive = Layer.mergeAll(
  TableRepositoryLive,
  BatchRepositoryLive,
  CommentRepositoryLive,
  ActivityRepositoryLive
)
