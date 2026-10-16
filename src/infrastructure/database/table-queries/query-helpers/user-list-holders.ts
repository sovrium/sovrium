/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, type DatabaseError } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { listMemberFragment } from '../server-operator-fragment'
import { wrapDatabaseError } from '../statement/error-handling'
import { tableIdentifier, validateColumnName } from '../statement/validation'

/** What a list-membership read names: the table, its list column, the people it looks for. */
export interface UserListHoldersInput {
  readonly table: string
  readonly column: string
  readonly userIds: readonly string[]
}

/**
 * The ids of the rows of `table` whose list of people `column` holds at least
 * one of `userIds` — a `contains` row rule's membership test on a `user` field
 * with `allowMultiple`. Every id is bound (S3); an empty `userIds` answers an
 * empty list without a query.
 */
export const readUserListHolders = (
  input: UserListHoldersInput
): Effect.Effect<readonly (string | number)[], DatabaseError> => {
  if (input.userIds.length === 0) return Effect.succeed([])
  return Effect.tryPromise({
    try: async () => {
      validateColumnName(input.column)
      const column = sql.identifier(input.column)
      const holds = sql.join(
        input.userIds.map((id) => listMemberFragment(column, id)),
        sql.raw(' OR ')
      )
      const rows = await executeRaw(
        db,
        sql`SELECT id FROM ${tableIdentifier(input.table)} WHERE ${holds}`
      )
      return rows.map((row) => row['id'] as string | number)
    },
    catch: wrapDatabaseError(`Failed to read the lists of people of ${input.table}`),
  })
}
