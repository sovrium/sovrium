/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'
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
  computeGroupedAggregations,
  readManyToMany,
  readRelatedLabels,
  isFileNamedByAnyRecord,
} from '@/infrastructure/database/table-queries'

/**
 * Live implementation of TableRepository using table-queries infrastructure
 *
 * Built member by member over the `Database` service: each query reads and
 * writes through the service's client, and branches on its dialect.
 * Session types are structurally compatible (UserSession ≅ Session).
 */
export const TableRepositoryLive = layerOverDatabase(TableRepository, {
  listRecords: (db, dialect) => (config) => listRecords(db, dialect, config),
  listTrash: (db, dialect) => (config) => listTrash(db, dialect, config),
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  permanentlyDeleteRecord,
  restoreRecord,
  computeAggregations: (db, dialect) => (config) => computeAggregations(db, dialect, config),
  computeGroupedAggregations: (db, dialect) => (config) =>
    computeGroupedAggregations(db, dialect, config),
  readManyToMany: (db, dialect) => (input) => readManyToMany({ client: db, dialect }, input),
  readRelatedLabels: (db, dialect) => (requests) =>
    readRelatedLabels({ client: db, dialect }, requests),
  isFileNamedByAnyRecord: (db, dialect) => (app, key, except) =>
    isFileNamedByAnyRecord({ client: db, dialect }, app, key, except),
})
