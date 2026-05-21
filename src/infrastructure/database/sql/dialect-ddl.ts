/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Database as BunSqlite } from 'bun:sqlite'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { TransactionLike } from './sql-execution'


export const openSqliteDdlDatabase = (path: string): BunSqlite => {
  const client = new BunSqlite(path, { create: true })
  client.exec('PRAGMA foreign_keys = ON')
  client.exec('PRAGMA journal_mode = WAL')
  client.exec('PRAGMA busy_timeout = 5000')
  return client
}

export const sqliteTransactionLike = (client: Readonly<BunSqlite>): TransactionLike => ({
  unsafe: (sql: string): Promise<readonly unknown[]> => {
    try {
      return Promise.resolve(client.query(sql).all() as readonly unknown[])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/statement|multiple|prepare/i.test(message)) {
        client.exec(sql)
        return Promise.resolve([])
      }
      return Promise.reject(error instanceof Error ? error : new Error(message))
    }
  },
})

export const runSqliteSchemaTransaction = async (
  client: Readonly<BunSqlite>,
  work: (tx: TransactionLike) => Promise<void>
): Promise<void> => {
  const tx = sqliteTransactionLike(client)
  client.exec('BEGIN')
  try {
    await work(tx)
    client.exec('COMMIT')
  } catch (error) {
    client.exec('ROLLBACK')
    throw error instanceof Error ? error : new Error(String(error))
  }
}

export const qualifiedSystemTable = (bareName: string): string =>
  isSqliteRuntime() ? `system_${bareName}` : `system.${bareName}`

export const systemObjectExistsSql = (bareName: string): string =>
  isSqliteRuntime()
    ? `SELECT EXISTS (
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = 'system_${bareName}'
      ) as "exists"`
    : `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'system' AND table_name = '${bareName}'
      ) as exists`

export const SQLITE_ISO_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"

export const nowSqlLiteral = (): string => (isSqliteRuntime() ? SQLITE_ISO_NOW : 'NOW()')
