/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { BatchRepository } from '@/application/ports/repositories/tables/batch-repository'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'
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
 * Maps port method names to infrastructure function names, each built over the
 * `Database` service's client and dialect.
 */
export const BatchRepositoryLive = layerOverDatabase(BatchRepository, {
  batchCreate: batchCreateRecords,
  batchUpdate: batchUpdateRecords,
  batchDelete: batchDeleteRecords,
  batchRestore: batchRestoreRecords,
  upsert: upsertRecords,
})
