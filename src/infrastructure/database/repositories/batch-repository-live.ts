/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { BatchRepository } from '@/application/ports/repositories/batch-repository'
import {
  batchCreateRecords,
  batchUpdateRecords,
  batchDeleteRecords,
  batchRestoreRecords,
  upsertRecords,
} from '@/infrastructure/database/table-queries'

/**
 * Live implementation of BatchRepository using table-queries infrastructure
 *
 * Maps port method names to infrastructure function names.
 */
export const BatchRepositoryLive = Layer.succeed(BatchRepository, {
  batchCreate: batchCreateRecords,
  batchUpdate: batchUpdateRecords,
  batchDelete: batchDeleteRecords,
  batchRestore: batchRestoreRecords,
  upsert: upsertRecords,
})
