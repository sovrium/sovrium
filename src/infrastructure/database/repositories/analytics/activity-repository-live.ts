/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { ActivityRepository } from '@/application/ports/repositories/analytics/activity-repository'
import { getRecordHistory } from '@/infrastructure/database/table-queries/query-helpers/activity-queries'
import { checkRecordExists } from '@/infrastructure/database/table-queries/query-helpers/record-validation-queries'

export const ActivityRepositoryLive = Layer.succeed(ActivityRepository, {
  getRecordHistory,
  checkRecordExists,
})
