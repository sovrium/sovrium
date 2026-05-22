/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data } from 'effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logInfo } from '@/infrastructure/logging/logger'
import { isUserReferenceField, isUserField } from '../sql/sql-generators'
import type { Table } from '@/domain/models/app/tables'

type Dialect = 'sqlite' | 'postgres'

const defaultDialect = (): Dialect => (isSqliteRuntime() ? 'sqlite' : 'postgres')

export class BetterAuthUsersTableRequired extends Data.TaggedError('BetterAuthUsersTableRequired')<{
  readonly message: string
}> {}

export const needsUsersTable = (tables: readonly Table[]): boolean =>
  tables.some((table) =>
    table.fields.some((field) => isUserReferenceField(field) || isUserField(field))
  )

export const needsUpdatedByTrigger = (tables: readonly Table[]): boolean =>
  tables.some((table) => table.fields.some((field) => field.type === 'updated-by'))

export const ensureBetterAuthUsersTable = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  dialect: Dialect = defaultDialect()
): Promise<void> => {
  logInfo('[ensureBetterAuthUsersTable] Verifying Better Auth users table exists...')

  const tableExistsResult =
    dialect === 'sqlite'
      ? ((await tx.unsafe(`
          SELECT EXISTS (
            SELECT 1 FROM sqlite_master
            WHERE type = 'table' AND name = 'auth_user'
          ) as "exists"
        `)) as readonly { exists: number | boolean }[])
      : ((await tx.unsafe(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'auth' AND table_name = 'user'
          ) as exists
        `)) as readonly { exists: boolean }[])

  if (!tableExistsResult[0]?.exists) {
    throw new BetterAuthUsersTableRequired({
      message:
        'User fields require Better Auth users table. Please configure Better Auth authentication before using user, created-by, updated-by, or deleted-by field types.',
    })
  }

  const idType =
    dialect === 'sqlite' ? await readSqliteAuthUserIdType(tx) : await readPostgresAuthUserIdType(tx)

  if (idType === undefined) {
    throw new BetterAuthUsersTableRequired({
      message:
        'Users table exists but lacks id column. Please ensure Better Auth is properly configured.',
    })
  }

  const acceptableIdTypes =
    dialect === 'sqlite' ? new Set(['text']) : new Set(['text', 'character varying'])

  if (!acceptableIdTypes.has(idType)) {
    throw new BetterAuthUsersTableRequired({
      message: `Users table has incompatible id column type '${idType}'. Better Auth uses TEXT ids. Please configure Better Auth authentication.`,
    })
  }

  logInfo('[ensureBetterAuthUsersTable] Better Auth users table verified successfully')
}

const readSqliteAuthUserIdType = async (tx: {
  unsafe: (sql: string) => Promise<unknown>
}): Promise<string | undefined> => {
  const result = (await tx.unsafe(`
    SELECT type FROM pragma_table_info('auth_user') WHERE name = 'id'
  `)) as readonly { type: string }[]
  return result[0]?.type.toLowerCase()
}

const readPostgresAuthUserIdType = async (tx: {
  unsafe: (sql: string) => Promise<unknown>
}): Promise<string | undefined> => {
  const result = (await tx.unsafe(`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'user' AND column_name = 'id'
  `)) as readonly { data_type: string }[]
  return result[0]?.data_type.toLowerCase()
}

export const ensureUpdatedByTriggerFunction = async (
  tx: { unsafe: (sql: string) => Promise<unknown> },
  dialect: Dialect = defaultDialect()
): Promise<void> => {
  if (dialect === 'sqlite') return
  await tx.unsafe(`
    CREATE OR REPLACE FUNCTION set_updated_by()
    RETURNS TRIGGER AS $$
    BEGIN
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)
}
