/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { authTableRef } from './sql/dialect-sql'

/**
 * The identifier prefix Better Auth gives a mailed account-deletion token: the
 * row is `identifier = delete-account-<token>`, `value = <user id>`.
 */
export const DELETE_ACCOUNT_TOKEN_PREFIX = 'delete-account-'

/**
 * The statement that removes every outstanding account-deletion token of
 * `userId`.
 *
 * The erasure's other `auth.verification` sweep matches rows by the user's
 * EMAIL identifier; a deletion token is keyed by a random identifier and holds
 * the user's ID as its value, so without this a second, unused link would
 * outlive the account it names. Both the prefix and the id are bound
 * parameters — the id is never spliced into the pattern.
 */
export const deleteOutstandingAccountDeletionTokens = (userId: string): SQL =>
  sql`DELETE FROM ${authTableRef('verification')}
      WHERE identifier LIKE ${`${DELETE_ACCOUNT_TOKEN_PREFIX}%`} AND value = ${userId}`
