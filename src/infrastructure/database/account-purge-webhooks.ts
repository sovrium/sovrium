/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Erasure of the table-webhook deliveries about an erased user (GDPR Art. 17).
 *
 * A delivery's payload is a snapshot of the record as it was written — the
 * values of a user field, a `created-by` stamp, a record she authored. So
 * erasing her hard-deletes, in the erasure's transaction, every outbox row —
 * pending or settled — whose subjects name her, or whose record is one the
 * erasure deletes or empties (the set the run scrub already uses), together
 * with the delivery-log rows of those deliveries. A pending delivery about
 * her is therefore never sent. Redacting and still delivering was refused: a
 * receiver would get a record emptied of what made it about someone, which
 * tells it nothing true.
 */

import { sql, type SQL } from 'drizzle-orm'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { scrubRunsReading } from './account-purge-runs'
import type { ErasedRecords } from './account-purge-runs'
import type { Dialect, TransactionOn } from '@/infrastructure/database/drizzle/layer'

const outbox = (dialect: Dialect): SQL => dialect.sql.systemTableRef('webhook_outbox')
const subjects = (dialect: Dialect): SQL => dialect.sql.systemTableRef('webhook_outbox_subjects')

const idList = (ids: readonly string[]): SQL =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  )

/** The outbox rows about one erased record set, table by table. */
const deliveriesAboutRecords = async (
  { tx, dialect }: TransactionOn,
  records: ErasedRecords
): Promise<readonly string[]> => {
  // One statement at a time: a transaction handle runs its statements in order.
  const perTable = await [...records]
    .filter(([, ids]) => ids.size > 0)
    .reduce<Promise<readonly string[]>>(async (found, [table, ids]) => {
      const rows = await executeRawOn(
        dialect.kind,
        tx,
        sql`SELECT id FROM ${outbox(dialect)}
             WHERE table_name = ${table} AND record_id IN (${idList([...ids])})`
      )
      return [...(await found), ...rows.map((row) => String(row['id']))]
    }, Promise.resolve([]))
  return perTable
}

/**
 * Delete every webhook delivery about `userId` — outbox rows, their subjects,
 * and their delivery-log rows. Resolves how many deliveries went.
 */
const deleteWebhookDeliveriesAbout = async (
  { tx, dialect }: TransactionOn,
  userId: string,
  records: ErasedRecords
): Promise<number> => {
  const naming = await executeRawOn(
    dialect.kind,
    tx,
    sql`SELECT DISTINCT outbox_id FROM ${subjects(dialect)} WHERE user_id = ${userId}`
  )
  const ids = [
    ...new Set([
      ...naming.map((row) => String(row['outbox_id'])),
      ...(await deliveriesAboutRecords({ tx, dialect }, records)),
    ]),
  ]
  if (ids.length === 0) return 0
  // A delivery that owed something has a log only once it settled; the log
  // exists wherever a table declares webhooks, which is what made the outbox
  // row in the first place.
  await executeRawOn(
    dialect.kind,
    tx,
    sql`DELETE FROM _webhook_deliveries WHERE delivery_id IN (${idList(ids)})`
  )
  await executeRawOn(
    dialect.kind,
    tx,
    sql`DELETE FROM ${subjects(dialect)} WHERE outbox_id IN (${idList(ids)})`
  )
  await executeRawOn(
    dialect.kind,
    tx,
    sql`DELETE FROM ${outbox(dialect)} WHERE id IN (${idList(ids)})`
  )
  return ids.length
}

/**
 * Step 0 of the erasure: the automation runs that read what it reaches keep
 * their steps and lose every value (`account-purge-runs.ts`), and the webhook
 * deliveries about her go. Both read `records` — collected before anything
 * below deletes or empties them.
 */
export const scrubWhatErasureReaches = async (
  { tx, dialect }: TransactionOn,
  userId: string,
  records: ErasedRecords
): Promise<void> => {
  await scrubRunsReading({ tx, dialect }, records)
  await deleteWebhookDeliveriesAbout({ tx, dialect }, userId, records)
}
