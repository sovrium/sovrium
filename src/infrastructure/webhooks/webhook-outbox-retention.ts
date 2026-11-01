/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { inReadWriteTransaction } from '@/infrastructure/database/read-write-sweep'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { listTableColumns } from '@/infrastructure/database/sql/dialect-introspection'
import { logInfo } from '@/infrastructure/logging/logger'
import { instant, outbox, subjects } from './webhook-outbox-queries'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

/**
 * Delete the deliveries settled before `cutoffMs`, in one transaction: the
 * outbox rows, their subjects, and the delivery-log rows that settle them —
 * then the log rows written before `cutoffMs` that no outbox row stands behind
 * (a test send, a row older than the outbox, one whose delivery is gone). A
 * log row therefore never outlives its delivery, and erasure, which finds log
 * rows through their delivery, reaches every one of them. Resolves to how many
 * deliveries went.
 *
 * The transaction is opened READ WRITE (`read-write-sweep.ts`), so the purge
 * keeps freeing space on a managed PostgreSQL that has gone read-only for lack
 * of disk, and its outcome is logged every time, zero included.
 */
export const deleteSettledBefore = async (
  database: DatabaseService,
  cutoffMs: number
): Promise<number> => {
  const deleted = await deleteSettledRows(database, cutoffMs)
  logInfo(
    `[webhook-outbox] retention: deleted ${String(deleted)} delivery(ies) settled before ${new Date(cutoffMs).toISOString()}`
  )
  return deleted
}

const deleteSettledRows = async (
  { client, dialect }: DatabaseService,
  cutoffMs: number
): Promise<number> =>
  inReadWriteTransaction({ client, dialect }, async (tx) => {
    const settled = sql`SELECT id FROM ${outbox(dialect)}
                         WHERE status <> 'pending' AND settled_at < ${instant(dialect, cutoffMs)}`
    // The log exists only once some table declared webhooks.
    const logged = (await listTableColumns(dialect.kind, tx, '_webhook_deliveries')).length > 0
    // One statement at a time: a transaction handle runs its statements in order.
    if (logged) {
      await executeRawOn(
        dialect.kind,
        tx,
        sql`DELETE FROM _webhook_deliveries WHERE delivery_id IN (${settled})`
      )
    }
    // The subjects before their outbox rows: SQLite enforces the cascade only with foreign keys on.
    await executeRawOn(
      dialect.kind,
      tx,
      sql`DELETE FROM ${subjects(dialect)} WHERE outbox_id IN (${settled})`
    )
    const rows = await executeRawOn(
      dialect.kind,
      tx,
      sql`DELETE FROM ${outbox(dialect)}
           WHERE status <> 'pending' AND settled_at < ${instant(dialect, cutoffMs)}
           RETURNING id`
    )
    if (!logged) return rows.length
    await executeRawOn(
      dialect.kind,
      tx,
      sql`DELETE FROM _webhook_deliveries
           WHERE created_at < ${instant(dialect, cutoffMs)}
             AND (delivery_id IS NULL
                  OR NOT EXISTS (SELECT 1 FROM ${outbox(dialect)} o
                                  WHERE o.id = _webhook_deliveries.delivery_id))`
    )
    return rows.length
  })
