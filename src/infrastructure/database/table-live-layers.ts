/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { ActivityRepositoryLive } from './repositories/analytics/activity-repository-live'
import { CommentRepositoryLive } from './repositories/comment-repository-live'
import { BatchRepositoryLive } from './repositories/tables/batch-repository-live'
import { DataSourceRepositoryLive } from './repositories/tables/data-source-repository-live'
import { TableRepositoryLive } from './repositories/tables/table-repository-live'

export const TableLive = Layer.mergeAll(
  TableRepositoryLive,
  BatchRepositoryLive,
  CommentRepositoryLive,
  ActivityRepositoryLive,
  DataSourceRepositoryLive
)
