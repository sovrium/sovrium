/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Option } from 'effect'
import { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import {
  getAuditEntryFromDb,
  listAuditFacetsFromDb,
  listAuditPageFromDb,
} from '@/infrastructure/audit-log/drizzle-page-reads'
import {
  appendAuditEntryToDb,
  countAuditEntriesByAction,
  listAuditEntriesFromDb,
} from '@/infrastructure/audit-log/drizzle-store'
import { layerOverDatabase } from '@/infrastructure/database/drizzle/layer'

/**
 * Live `AuditLogRepository` over the Drizzle `audit_log` store, built over the
 * client and dialect of the `Database` the composition provides.
 *
 * Each store helper catches and logs its own failure and resolves the empty
 * value, so `Effect.promise` is honest here: none of the thunks rejects.
 */
export const AuditLogRepositoryLive = layerOverDatabase(AuditLogRepository, {
  // effect-promise: total -- appendAuditEntryToDb catches and logs every driver failure
  append: (db, dialect) => (entry) =>
    Effect.promise(() => appendAuditEntryToDb({ client: db, dialect }, entry)),
  // effect-promise: total -- listAuditEntriesFromDb resolves [] on any read failure
  list: (db) => (filter) => Effect.promise(() => listAuditEntriesFromDb(db, filter)),
  listPage: (db, dialect) => (query) =>
    // effect-promise: total -- listAuditPageFromDb resolves an empty last page on any read failure
    Effect.promise(() => listAuditPageFromDb(db, dialect, query)),
  get: (db) => (id) =>
    // effect-promise: total -- getAuditEntryFromDb resolves undefined on any read failure
    Effect.promise(() => getAuditEntryFromDb(db, id)).pipe(Effect.map(Option.fromUndefinedOr)),
  // effect-promise: total -- countAuditEntriesByAction resolves [] on any read failure
  countByAction: (db) => (input) => Effect.promise(() => countAuditEntriesByAction(db, input)),
  // effect-promise: total -- listAuditFacetsFromDb resolves two empty lists on any read failure
  facets: (db) => (limit) => Effect.promise(() => listAuditFacetsFromDb(db, limit)),
})
