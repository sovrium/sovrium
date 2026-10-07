/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Layer } from 'effect'
import { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import {
  appendAuditEntryToDb,
  countAuditEntriesByAction,
  listAuditEntriesFromDb,
} from '@/infrastructure/audit-log/drizzle-store'

/**
 * Live `AuditLogRepository` over the Drizzle `audit_log` store.
 *
 * Each store helper catches and logs its own failure and resolves the empty
 * value, so `Effect.promise` is honest here: none of the three thunks rejects.
 */
export const AuditLogRepositoryLive = Layer.succeed(
  AuditLogRepository,
  AuditLogRepository.of({
    // effect-promise: total -- appendAuditEntryToDb catches and logs every driver failure
    append: (entry) => Effect.promise(() => appendAuditEntryToDb(entry)),
    // effect-promise: total -- listAuditEntriesFromDb resolves [] on any read failure
    list: (filter) => Effect.promise(() => listAuditEntriesFromDb(filter)),
    // effect-promise: total -- countAuditEntriesByAction resolves [] on any read failure
    countByAction: (input) => Effect.promise(() => countAuditEntriesByAction(input)),
  })
)
