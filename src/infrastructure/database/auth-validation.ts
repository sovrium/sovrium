/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { isUserReferenceField, isUserField } from './sql-generators'
import type { Table } from '@/domain/models/app/table'

export class BetterAuthUsersTableRequired extends Data.TaggedError('BetterAuthUsersTableRequired')<{
  readonly message: string
}> {}

/**
 * Check if any table needs the users table for foreign keys
 */
export const needsUsersTable = (tables: readonly Table[]): boolean =>
  tables.some((table) =>
    table.fields.some((field) => isUserReferenceField(field) || isUserField(field))
  )

/**
 * Check if any table has updated-by fields that need the trigger function
 */
export const needsUpdatedByTrigger = (tables: readonly Table[]): boolean =>
  tables.some((table) => table.fields.some((field) => field.type === 'updated-by'))

/**
 * Verify Better Auth users table exists for foreign key references
 *
 * User fields (user, created-by, updated-by) require Better Auth's users table.
 * Better Auth uses TEXT ids, so user fields store TEXT foreign keys.
 *
 * @throws BetterAuthUsersTableRequired if users table doesn't exist or lacks required columns
 */
/* eslint-disable functional/no-throw-statements */
export const ensureBetterAuthUsersTable = async (tx: {
  unsafe: (sql: string) => Promise<unknown>
}): Promise<void> => {
  console.log('[ensureBetterAuthUsersTable] Verifying Better Auth users table exists...')

  // Check if users table exists
  const tableExistsResult = (await tx.unsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
    ) as exists
  `)) as readonly { exists: boolean }[]

  if (!tableExistsResult[0]?.exists) {
    throw new BetterAuthUsersTableRequired({
      message:
        'User fields require Better Auth users table. Please configure Better Auth authentication before using user, created-by, or updated-by field types.',
    })
  }

  // Verify Better Auth schema (TEXT id column)
  const idColumnResult = (await tx.unsafe(`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
  `)) as readonly { data_type: string }[]

  if (!idColumnResult[0]) {
    throw new BetterAuthUsersTableRequired({
      message:
        'Users table exists but lacks id column. Please ensure Better Auth is properly configured.',
    })
  }

  const idType = idColumnResult[0].data_type.toLowerCase()
  if (idType !== 'text' && idType !== 'character varying') {
    throw new BetterAuthUsersTableRequired({
      message: `Users table has incompatible id column type '${idType}'. Better Auth uses TEXT ids. Please configure Better Auth authentication.`,
    })
  }

  console.log('[ensureBetterAuthUsersTable] Better Auth users table verified successfully')
}
/* eslint-enable functional/no-throw-statements */

/**
 * Ensure global set_updated_by trigger function exists
 * This function is shared across all tables with updated-by fields
 */
/* eslint-disable functional/no-expression-statements */
export const ensureUpdatedByTriggerFunction = async (tx: {
  unsafe: (sql: string) => Promise<unknown>
}): Promise<void> => {
  await tx.unsafe(`
    CREATE OR REPLACE FUNCTION set_updated_by()
    RETURNS TRIGGER AS $$
    BEGIN
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
}
/* eslint-enable functional/no-expression-statements */
