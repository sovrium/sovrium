/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  UpsertMatchDatabaseError,
  UpsertMatchRepository,
} from '@/application/ports/repositories/tables/upsert-match-repository'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import {
  checkForExistingRecords,
  findRecordIdsByMergeFields,
} from '@/infrastructure/database/table-queries/query-helpers/check-existing-records'

const wrap = makeDbWrap((cause) => new UpsertMatchDatabaseError({ cause }))

/** The merge-field lookups an upsert's permission gates read, over the Database service. */
export const UpsertMatchRepositoryLive = layerOverDatabase(UpsertMatchRepository, {
  anyMatch: (db, dialect) => (match) =>
    wrap(() => checkForExistingRecords({ client: db, dialect }, match)),
  matchingIds:
    (db, dialect) =>
    ({ tableName, fields, fieldsToMergeOn }) =>
      wrap(() =>
        findRecordIdsByMergeFields({ client: db, dialect }, tableName, fields, fieldsToMergeOn)
      ),
})
