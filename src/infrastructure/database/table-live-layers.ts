/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { ActivityRepositoryLive } from './repositories/analytics/activity-repository-live'
import { AuthRepositoryLive } from './repositories/auth/auth-repository-live'
import { CommentRepositoryLive } from './repositories/comment-repository-live'
import { BatchRepositoryLive } from './repositories/tables/batch-repository-live'
import { DataSourceRepositoryLive } from './repositories/tables/data-source-repository-live'
import { TableRepositoryLive } from './repositories/tables/table-repository-live'

/**
 * Composite layer providing all table-related repository implementations
 *
 * Import this single layer in presentation routes to satisfy
 * all table, batch, comment, and activity repository requirements — plus the
 * auth repository, which a record read uses to name the accounts its `user`
 * fields store (the `_display` label of a user field).
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
  ActivityRepositoryLive,
  DataSourceRepositoryLive,
  AuthRepositoryLive
)
