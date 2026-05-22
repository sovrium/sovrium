/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database-dialect'
import { UnsupportedInSqliteError } from '../unsupported-in-sqlite'
import * as schemaPg from './schema'
import * as schemaSqlite from './schema-sqlite'


export type DrizzleDB = ReturnType<typeof drizzlePg<typeof schemaPg>>

type SqliteDrizzleDB = ReturnType<typeof drizzleSqlite<typeof schemaSqlite>>

let cached: DrizzleDB | undefined

const buildClient = (): DrizzleDB => {
  const config = parseDatabaseDialectConfig()

  if (config.dialect === 'postgres') {
    return drizzlePg({ connection: { url: config.databaseUrl }, schema: schemaPg })
  }

  if (config.path !== ':memory:') {
    mkdirSync(dirname(config.path), { recursive: true })
  }
  const client = new BunSqlite(config.path, { create: true })
  client.exec('PRAGMA foreign_keys = ON')
  client.exec('PRAGMA journal_mode = WAL')
  client.exec('PRAGMA busy_timeout = 5000')

  const sqliteDb: SqliteDrizzleDB = drizzleSqlite({ client, schema: schemaSqlite })
  return sqliteDb as unknown as DrizzleDB
}

export const getDb = (): DrizzleDB => {
  if (cached !== undefined) return cached
  cached = buildClient()
  return cached
}

export const getPgDb = (): DrizzleDB => {
  if (parseDatabaseDialectConfig().dialect !== 'postgres') {
    throw new UnsupportedInSqliteError({
      feature: 'raw-sql',
      message:
        'db.execute / raw SQL requires the PostgreSQL runtime. This operation is not available on the SQLite (zero-config) runtime.',
    })
  }
  return getDb()
}

export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
})
