/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import { TableRepository } from '@/application/ports/table-repository'
import {
  listRecords,
  listTrash,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  permanentlyDeleteRecord,
  restoreRecord,
  computeAggregations,
} from '@/infrastructure/database/table-queries'

/**
 * Live implementation of TableRepository using table-queries infrastructure
 *
 * Delegates all operations to the existing database query functions.
 * Session types are structurally compatible (UserSession ≅ Session).
 */
export const TableRepositoryLive = Layer.succeed(TableRepository, {
  listRecords,
  listTrash,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  permanentlyDeleteRecord,
  restoreRecord,
  computeAggregations,
})
