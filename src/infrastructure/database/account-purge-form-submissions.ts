/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { executeRaw } from './sql/dialect-execute'
import { systemTableRef } from './sql/dialect-sql'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * Erase an account's form-submission ledger rows.
 *
 * 1. The rows the user submitted. PHYSICAL delete, not a `deleted_at`
 *    tombstone and not a null-ified `submitter_user_id` — the submitted body is
 *    itself personal data (people disclose addresses and phone numbers in
 *    free-text fields), so orphaning the row would leave that data in place.
 *    Rows with a NULL `submitter_user_id` are anonymous submissions belonging
 *    to nobody and are left untouched.
 * 2. The drafts saved under the user's address (`saveAndResume`). A draft is
 *    keyed by the address its resume link was mailed to, not by an account,
 *    and holds half-typed answers — personal data like any submission. Only
 *    `draft` rows: a sent anonymous submission that merely carried the address
 *    is not the user's to have deleted by this match. An address that could
 *    not be read is never matched as an empty string.
 */
export async function deleteFormSubmissionsOf(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  erasedEmail: string | undefined
): Promise<void> {
  const ledger = systemTableRef('form_submissions')
  await executeRaw(tx, sql`DELETE FROM ${ledger} WHERE submitter_user_id = ${userId}`)
  if (erasedEmail === undefined || erasedEmail === '') return
  await executeRaw(
    tx,
    sql`DELETE FROM ${ledger} WHERE status = 'draft' AND guest_email = ${erasedEmail}`
  )
}
