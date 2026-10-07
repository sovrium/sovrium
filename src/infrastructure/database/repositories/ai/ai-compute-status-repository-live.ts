/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import {
  AiComputeStatusRepository,
  AiComputeStoreError,
} from '@/application/ports/repositories/ai/ai-compute-status-repository'
import {
  readAiComputeStatus,
  readAiComputeStatusesForRecords,
  upsertAiComputeStatus,
} from '@/infrastructure/database/ai-compute-status-repository'
import {
  readCurrentFieldValue,
  writeBackRefinedValue,
} from '@/infrastructure/database/ai-compute-writeback'

const store =
  (step: AiComputeStoreError['step']) =>
  <A>(thunk: () => Promise<A>): Effect.Effect<A, AiComputeStoreError> =>
    Effect.tryPromise({ try: thunk, catch: (cause) => new AiComputeStoreError({ step, cause }) })

/** Live `AiComputeStatusRepository` over the Drizzle status table and raw write-back. */
export const AiComputeStatusRepositoryLive = Layer.succeed(
  AiComputeStatusRepository,
  AiComputeStatusRepository.of({
    readStatus: (key) => store('read-status')(() => readAiComputeStatus(key)),
    readStatusesForRecords: (appId, tableName, recordIds) =>
      store('read-status')(() => readAiComputeStatusesForRecords(appId, tableName, recordIds)),
    upsertStatus: (key, status, options) =>
      store('write-status')(() => upsertAiComputeStatus(key, status, options)),
    readFieldValue: (tableName, recordId, fieldName) =>
      store('read-value')(() => readCurrentFieldValue(tableName, recordId, fieldName)),
    writeBack: (params) => store('write-value')(() => writeBackRefinedValue(params)),
  })
)
