/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AutomationPauseDatabaseError,
  AutomationPauseRepository,
  type AutomationPauseReason,
  type AutomationPauseRow,
} from '@/application/ports/repositories/automations/automation-pause-repository'
import { db } from '@/infrastructure/database'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { automationPauses as automationPausesPg } from '@/infrastructure/database/drizzle/schema/automation'
import { automationPauses as automationPausesSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

// Dialect-aware resolution: the PG variant qualifies `system.automation_pauses`,
// the SQLite mirror maps the flat `system_automation_pauses` name. Resolved once
// at module-init (the helper memoizes).
const automationPauses = resolveDialectSchema(automationPausesPg, automationPausesSqlite)

/** Wrap a DB promise, adapting failures to AutomationPauseDatabaseError. */
const wrap = makeDbWrap((cause) => new AutomationPauseDatabaseError({ cause }))

/**
 * Automation Pause Repository Implementation (Drizzle).
 *
 * Presence of a row = paused; resume DELETEs it. Both mutations are idempotent
 * by construction rather than by a read-then-write check, so two concurrent
 * pauses of the same automation cannot race into a unique-constraint violation:
 *
 *   - `pause` is `INSERT ... ON CONFLICT DO NOTHING` against the UNIQUE
 *     `automation_name`. The second call is a silent no-op that leaves the
 *     ORIGINAL `paused_at` untouched — required by an admin automations pause spec,
 *     which asserts a repeated pause does not move the timestamp forward.
 *   - `resume` is a bare DELETE, which affects zero rows when none matched.
 */
export const AutomationPauseRepositoryLive = Layer.succeed(AutomationPauseRepository, {
  listPausedNames: wrap(async () => {
    const rows = await db
      .select({ automationName: automationPauses.automationName })
      .from(automationPauses)
    return new Set(rows.map((row) => row.automationName)) as ReadonlySet<string>
  }),

  listPauses: wrap(async () => {
    const users = authUsersTable()
    const rows = (await db
      .select({
        automationName: automationPauses.automationName,
        pausedAt: automationPauses.pausedAt,
        reason: automationPauses.reason,
        userName: users.name,
        userEmail: users.email,
      })
      .from(automationPauses)
      // LEFT, not INNER: `paused_by_user_id` is nullable (ON DELETE SET NULL),
      // and an INNER join would make an erased operator's pause DISAPPEAR from
      // the catalog — i.e. read as un-paused while the gate still blocks it.
      .leftJoin(users, eq(users.id, automationPauses.pausedByUserId))) as ReadonlyArray<{
      automationName: string
      pausedAt: Date | string
      reason: string | null
      userName: string | null
      userEmail: string | null
    }>
    return rows.map((row): AutomationPauseRow => ({
      automationName: row.automationName,
      // Display name first, email as the fallback identifier, null when the
      // account was erased. Never a fabricated placeholder — the console
      // renders "unknown" from the null rather than being told a name.
      pausedBy: row.userName ?? row.userEmail ?? null,
      pausedAt: row.pausedAt,
      // The column is free text in storage; only the platform writes it, with
      // the one value the contract names.
      reason: row.reason === null ? null : (row.reason as AutomationPauseReason),
    }))
  }),

  pause: ({ automationName, pausedByUserId, reason }) =>
    wrap(async () => {
      const inserted = await db
        .insert(automationPauses)
        .values({
          automationName,
          ...(pausedByUserId === undefined ? {} : { pausedByUserId }),
          ...(reason === undefined ? {} : { reason }),
        })
        .onConflictDoNothing({ target: automationPauses.automationName })
        .returning({ id: automationPauses.id })
      return inserted.length > 0
    }),

  resume: (automationName) =>
    wrap(async () => {
      const deleted = await db
        .delete(automationPauses)
        .where(eq(automationPauses.automationName, automationName))
        .returning({ id: automationPauses.id })
      return deleted.length > 0
    }),
})
