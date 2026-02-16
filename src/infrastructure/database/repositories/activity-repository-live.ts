/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { ActivityRepository } from '@/application/ports/activity-repository'
import { getRecordHistory } from '@/infrastructure/database/table-queries/query-helpers/activity-queries'

/**
 * Live implementation of ActivityRepository using activity-queries infrastructure
 *
 * Maps port method names to infrastructure function names.
 */
export const ActivityRepositoryLive = Layer.succeed(ActivityRepository, {
  getRecordHistory,
})
