/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Re-export all CRUD operations from modular files
export { listRecords, computeAggregations, listTrash, getRecord } from './crud-read'
export {
  createRecord,
  updateRecord,
  deleteRecord,
  permanentlyDeleteRecord,
  restoreRecord,
} from './crud-write'
