/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AiComputeStatusRepository,
  AiComputeStoreError,
} from '@/application/ports/repositories/ai/ai-compute-status-repository'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import {
  readAiComputeStatus,
  readAiComputeStatusesForRecords,
  upsertAiComputeStatus,
} from '@/infrastructure/database/ai-compute-status-repository'
import {
  readCurrentFieldValue,
  writeBackRefinedValue,
} from '@/infrastructure/database/ai-compute-writeback'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'

const store =
  (step: AiComputeStoreError['step']) =>
  <A>(thunk: () => Promise<A>): Effect.Effect<A, AiComputeStoreError> =>
    Effect.tryPromise({ try: thunk, catch: (cause) => new AiComputeStoreError({ step, cause }) })

/** Live `AiComputeStatusRepository` over the Drizzle status table and raw write-back. */
export const AiComputeStatusRepositoryLive = layerOverDatabase(AiComputeStatusRepository, {
  readStatus: (db) => (key) => store('read-status')(() => readAiComputeStatus(db, key)),
  readStatusesForRecords: (db) => (appId, tableName, recordIds) =>
    store('read-status')(() => readAiComputeStatusesForRecords(db, appId, tableName, recordIds)),
  upsertStatus: (db) => (key, status, options) =>
    store('write-status')(() => upsertAiComputeStatus(db, key, status, options)),
  readFieldValue: (db, dialect) => (tableName, recordId, fieldName) =>
    store('read-value')(() =>
      readCurrentFieldValue({ client: db, dialect }, tableName, recordId, fieldName)
    ),
  writeBack: (db, dialect) => (params) =>
    store('write-value')(() => writeBackRefinedValue(db, dialect, params)),
  // Read per write, as the write phase always did: SQLite has no listener.
  refinesWritesInProcess: () =>
    Effect.map(ProcessEnv, (env) => parseDatabaseDialectConfig(env).dialect === 'sqlite'),
})
