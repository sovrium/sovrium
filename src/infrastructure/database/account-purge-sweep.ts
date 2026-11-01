/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  appendAuditEntryToDb,
  hasAuditEntrySinceLatest,
} from '@/infrastructure/audit-log/drizzle-store'
import { nowEpochMsSqlLiteralOn } from '@/infrastructure/database/sql/dialect-ddl'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { logWarning } from '@/infrastructure/logging/logger'
import { purgeAccount } from './account-purge'
import { buildDeferredErasureEntry } from './account-purge-audit'
import { liveErasureSeams } from './account-purge-objects'
import type { PurgeTableAuthorship } from './account-purge-authorship'
import type { PurgeOutcome } from './account-purge-rail'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { PortableDb } from '@/infrastructure/database'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/**
 * The erasure scheduler: which accounts are due, and what happens to one the
 * last-admin rail refuses. Each due account is erased by `purgeAccount`.
 */

/** Injectable for unit tests (no `mock.module()`). */
export interface PurgeSweepDeps {
  readonly findDueAccountIds?: () => Promise<readonly string[]>
  readonly purge?: (userId: string) => Promise<PurgeOutcome>
  /** `true` when this scheduled erasure's deferral is already on the audit trail. */
  readonly deferralRecorded?: (userId: string) => Promise<boolean>
  readonly recordDeferral?: (entry: Readonly<AuditLogEntry>) => Promise<void>
  /** The operator warning each deferring sweep logs. */
  readonly warn?: (message: string) => void
}

async function findDueAccountIds({
  client: db,
  dialect,
}: DatabaseService): Promise<readonly string[]> {
  // sql-literal: keyword -- the dialect's own clock expression, never a caller value
  const now = sql.raw(nowEpochMsSqlLiteralOn(dialect.kind))
  const rows = (await executeRawOn(
    dialect.kind,
    db,
    sql`SELECT id FROM ${dialect.sql.authTableRef('user')}
        WHERE "scheduledErasureAt" IS NOT NULL AND "scheduledErasureAt" <= ${now}`
  )) as readonly { id: string }[]
  return rows.map((row) => row.id)
}

/**
 * A deferral is recorded once per scheduled erasure: an earlier
 * `account.deletion.deferred` entry for the account, written since it was last
 * scheduled, means this one is already on the trail. A new schedule after a
 * cancel starts over.
 */
const deferralRecordedSinceScheduled = (db: PortableDb, userId: string): Promise<boolean> =>
  hasAuditEntrySinceLatest(db, {
    action: AUDIT_ACTIONS.ACCOUNT_DELETION_DEFERRED,
    sinceAction: AUDIT_ACTIONS.ACCOUNT_DELETION_SCHEDULED,
    resourceId: userId,
  })

/** Leave a refused account in place: a warning each sweep, one audit entry per schedule. */
async function deferErasure(
  { client: db, dialect }: DatabaseService,
  userId: string,
  deps: PurgeSweepDeps | undefined
): Promise<void> {
  const warn = deps?.warn ?? logWarning
  warn(
    `[account-purge] erasure of ${userId} deferred: it is the last account that can administer the app`
  )
  const recorded = await (
    deps?.deferralRecorded ?? ((id: string) => deferralRecordedSinceScheduled(db, id))
  )(userId)
  if (recorded) return
  const recordDeferral =
    deps?.recordDeferral ??
    ((entry: Readonly<AuditLogEntry>) => appendAuditEntryToDb({ client: db, dialect }, entry))
  await recordDeferral(buildDeferredErasureEntry(userId))
}

/**
 * Run the erasure scheduler: hard-delete every account whose
 * `scheduledErasureAt` is in the past.
 *
 * An account the rail refuses is deferred, not cancelled: it is left in place
 * with its schedule as it is, it is not counted, and the sweep goes on with the
 * next due account. Every later sweep tries again, and the first one after
 * another account can administer the app erases it.
 *
 * @param database - The database the accounts are found and erased in.
 * @param appTables - App tables with their CONFIG-RESOLVED authorship columns.
 * @param app - The app's roles, for who can administer it.
 * @returns The number of accounts erased.
 */
export async function purgeDueAccounts(
  database: DatabaseService,
  appTables: readonly PurgeTableAuthorship[],
  app: AdminRoleResolvable,
  deps?: PurgeSweepDeps
): Promise<number> {
  const dueIds = await (deps?.findDueAccountIds ?? (() => findDueAccountIds(database)))()
  const purge =
    deps?.purge ??
    ((userId: string) => purgeAccount(userId, appTables, app, liveErasureSeams(database)))

  // Sequential on purpose: one erasure at a time, each in its own transaction.
  let erased = 0
  for (const userId of dueIds) {
    const outcome = await purge(userId)
    if (outcome._tag === 'Erased') erased += 1
    else await deferErasure(database, userId, deps)
  }
  return erased
}
