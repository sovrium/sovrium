/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq, sql } from 'drizzle-orm'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { emailSuppressions as suppressionsPg } from '@/infrastructure/database/drizzle/schema/email-deliverability'
import { emailSuppressions as suppressionsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/email-deliverability'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { deleteVerificationRows } from './account-purge-verification'
import type { EmailSuppressionEntry } from '@/application/ports/repositories/automations/email-deliverability-repository'
import type { PortableDb } from '@/infrastructure/database'
import type { TransactionOn } from '@/infrastructure/database/drizzle/layer'

/**
 * The mailing-list suppressions of one address, for the GDPR export and
 * erasure. The suppression list is keyed by address, not by account, so both
 * read it by the account's email, compared lower-cased.
 */

/** The suppressions of an address, newest first (the export's `emailSuppressions`). */
export const readEmailSuppressions = async (
  db: PortableDb,
  email: string
): Promise<readonly EmailSuppressionEntry[]> => {
  const suppressions = resolveDialectSchema(suppressionsPg, suppressionsSqlite)
  const rows = await db
    .select({
      category: suppressions.category,
      reason: suppressions.reason,
      createdAt: suppressions.createdAt,
    })
    .from(suppressions)
    .where(eq(suppressions.address, email.toLowerCase()))
    .orderBy(desc(suppressions.createdAt), desc(suppressions.id))
  return rows.map((row) => ({
    category: row.category,
    reason: row.reason as EmailSuppressionEntry['reason'],
    createdAt: new Date(row.createdAt),
  }))
}

/**
 * Erasure: every suppression of the erased address goes (a hard delete), so
 * the person is no longer remembered as having left a list.
 */
export async function deleteEmailSuppressionsOf(
  { tx, dialect }: TransactionOn,
  email: string | undefined
): Promise<void> {
  if (email === undefined || email === '') return
  await executeRawOn(
    dialect.kind,
    tx,
    sql`DELETE FROM ${dialect.sql.systemTableRef('email_suppressions')} WHERE address = ${email.toLowerCase()}`
  )
}

/**
 * The rows erasure finds by the person's id or address: her pending tokens
 * (reset, deletion and invitation links, trusted devices, emailed codes —
 * `deleteVerificationRows`), then her address's mailing-list suppressions.
 */
export async function deleteAddressKeyedRows(
  { tx, dialect }: TransactionOn,
  userId: string,
  email: string | undefined
): Promise<void> {
  await deleteVerificationRows({ tx, dialect }, userId, email)
  await deleteEmailSuppressionsOf({ tx, dialect }, email)
}
