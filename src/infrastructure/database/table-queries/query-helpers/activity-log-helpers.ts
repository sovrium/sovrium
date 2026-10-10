/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect } from 'effect'
import {
  UnauditedTables,
  type CommittedRowChange,
} from '@/application/ports/services/record-change-feed'
import { resolveActorUserId } from '@/domain/models/app/auth/guest-session'
import { db, DatabaseError } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { activityLogs as activityLogsPg } from '@/infrastructure/database/drizzle/schema/activity-log'
import { activityLogs as activityLogsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/activity-log'
import { logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * The audit table for the active dialect — `system.activity_logs` on Postgres,
 * the flat `system_activity_logs` on SQLite.
 *
 * The write below stays NON-FATAL — an audited operation must not be undone
 * because its trail could not be recorded — but it is not SILENT: otherwise a
 * dialect mismatch here would leave no trace at all, and the trail would simply
 * be absent with nothing saying why. See {@link logActivity}.
 */
const activityLogs = resolveDialectSchema(activityLogsPg, activityLogsSqlite)

/** One audit entry, as {@link logActivity} takes it. */
interface ActivityEntry {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly action: 'create' | 'update' | 'delete' | 'restore' | 'permanent_delete'
  readonly recordId: string
  readonly changes: {
    readonly before?: Record<string, unknown>
    readonly after?: Record<string, unknown>
  }
  readonly app?: App
}

/** The audit row of one entry. */
const activityRow = (actor: Readonly<Session>, entry: ActivityEntry) => {
  // Get table ID from app schema if available
  const table = entry.app?.tables?.find((t) => t.name === entry.tableName)
  return {
    id: crypto.randomUUID(),
    // A synthetic actor ('system', 'guest') has no auth user row: store NULL
    // rather than trip the user FK and silently lose the audit row.
    userId: resolveActorUserId(actor.userId),
    action: entry.action,
    tableName: entry.tableName,
    tableId: table?.id ? String(table.id) : '1',
    recordId: entry.recordId,
    changes: entry.changes,
  }
}

/**
 * The most audit rows one INSERT carries — far under either engine's bound
 * parameter limit at eight columns a row, and above the largest batch write.
 */
const ENTRIES_PER_INSERT = 500

/** {@link insertActivityEntries}, once the entries of unaudited tables are dropped. */
const insertAuditedEntries = (
  actor: Readonly<Session>,
  entries: readonly ActivityEntry[]
): Effect.Effect<void, never> => {
  const first = entries[0]
  if (first === undefined) return Effect.void
  const chunks = Array.from({ length: Math.ceil(entries.length / ENTRIES_PER_INSERT) }, (_, i) =>
    entries.slice(i * ENTRIES_PER_INSERT, (i + 1) * ENTRIES_PER_INSERT)
  )
  return Effect.forEach(chunks, (chunk) =>
    Effect.tryPromise({
      try: async () => {
        const rows = chunk.map((entry) => activityRow(actor, entry))
        const [only] = rows
        // A lone entry is inserted as a row, a batch as a multi-row INSERT.
        await (rows.length === 1 && only !== undefined
          ? db.insert(activityLogs).values(only)
          : db.insert(activityLogs).values(rows))
      },
      catch: (error) => new DatabaseError('Failed to log activity', error),
    })
  ).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('Failed to write the activity-log audit trail', Cause.squash(cause), {
          'sovrium.audit.table': first.tableName,
          'sovrium.audit.action': first.action,
        })
      })
    ),
    // The tap and the swallow are ONE pipe on purpose. Written as
    // `Effect.ignore(program.pipe(tapCause(…)))` the logging is just as real,
    // but it sits inside the swallow's argument rather than before it — which
    // reads to a reviewer, and to `sovrium/no-effect-swallow-without-log`, as an
    // unlogged discard.
    Effect.ignore
  )
}

/**
 * Write audit entries in as few statements as the parameter limit allows: one
 * multi-row INSERT for any batch the records API accepts. Non-fatal and
 * logged, as {@link logActivity} documents. The entries of a table declaring
 * `activityLog: false` are dropped first: the announcing scope every write runs
 * in names those tables ({@link UnauditedTables}).
 */
const insertActivityEntries = (
  actor: Readonly<Session>,
  entries: readonly ActivityEntry[]
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const unaudited = yield* UnauditedTables
    yield* insertAuditedEntries(
      actor,
      unaudited.size === 0 ? entries : entries.filter((entry) => !unaudited.has(entry.tableName))
    )
  })

/**
 * Common activity logging helper
 *
 * Logs database operations (create, update, delete) for audit trail.
 * This is a non-critical operation that should not fail the main operation.
 *
 * Non-fatal is not the same as unobservable. The `DatabaseError` was being
 * constructed and then dropped by `Effect.ignore`, so a broken audit trail — a
 * dialect mismatch, a missing table, column drift — produced exactly nothing: no
 * failure, no log line, and a silently incomplete trail that surfaces only when
 * someone finally needs to read it. `Effect.tapCause` runs ahead of the ignore
 * and records the cause, so the operation still cannot fail while the reason
 * stays visible. It taps the CAUSE rather than the error so a defect thrown
 * inside the promise is logged too, not just the mapped `DatabaseError`.
 */
export function logActivity(config: ActivityEntry): Effect.Effect<void, never> {
  return insertActivityEntries(config.session, [config])
}

/** The activity-log action a committed row change is recorded as. */
const ACTION_BY_EVENT = {
  insert: 'create',
  update: 'update',
  delete: 'delete',
} as const satisfies Record<CommittedRowChange['event'], string>

/**
 * Log, once a write has COMMITTED, one activity entry per row it changed —
 * written as one multi-row INSERT, so a 100-row batch costs one statement here
 * rather than a hundred.
 *
 * A batch logs after its transaction rather than inside it, for two reasons.
 * An entry for a row the rollback undid would record a change that never
 * happened. And the entry is written through the shared `db`, which on SQLite
 * waits for any open transaction to end: issued from inside the body, it would
 * wait for its own transaction.
 */
export function logCommittedRowChanges(
  session: Readonly<Session>,
  changes: readonly CommittedRowChange[]
): Effect.Effect<void, never> {
  return insertActivityEntries(
    session,
    changes.map((change) => ({
      session,
      tableName: change.tableName,
      action: ACTION_BY_EVENT[change.event],
      recordId: change.recordId,
      changes: {
        ...(change.previous === undefined ? {} : { before: { ...change.previous } }),
        ...(change.row === undefined ? {} : { after: { ...change.row } }),
      },
    }))
  )
}
