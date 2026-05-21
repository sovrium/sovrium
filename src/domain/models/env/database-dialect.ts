/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'
import { Schema } from 'effect'

export const DatabaseDialectType = Schema.Literal('postgres', 'sqlite')

export type DatabaseDialect = Schema.Schema.Type<typeof DatabaseDialectType>

export const SovriumRuntimeLabelType = Schema.Literal('postgres', 'sqlite-aio')

export type SovriumRuntimeLabel = Schema.Schema.Type<typeof SovriumRuntimeLabelType>

export const PostgresDialectSchema = Schema.Struct({
  dialect: Schema.Literal('postgres'),
  databaseUrl: Schema.String.pipe(
    Schema.pattern(/^postgres(ql)?:\/\/.+/),
    Schema.annotations({
      description: 'PostgreSQL connection string (DATABASE_URL)',
      examples: ['postgresql://user:pass@localhost:5432/sovrium'],
    })
  ),
})

export const SqliteDialectSchema = Schema.Struct({
  dialect: Schema.Literal('sqlite'),
  path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'SQLite database file path (SQLITE_PATH), or ":memory:"',
      examples: ['./sovrium.db', ':memory:'],
    })
  ),
})

export const DatabaseDialectSchema = Schema.Union(PostgresDialectSchema, SqliteDialectSchema)

export type DatabaseDialectConfig = Schema.Schema.Type<typeof DatabaseDialectSchema>
export type PostgresDialectConfig = Schema.Schema.Type<typeof PostgresDialectSchema>
export type SqliteDialectConfig = Schema.Schema.Type<typeof SqliteDialectSchema>

export const DEFAULT_SQLITE_PATH = './sovrium.db'

export const SQLITE_MEMORY_PATH = ':memory:'

export const parseDatabaseDialectConfig = (): DatabaseDialectConfig => {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    return Schema.decodeUnknownSync(PostgresDialectSchema)({
      dialect: 'postgres',
      databaseUrl,
    })
  }

  const rawPath = process.env.SQLITE_PATH || DEFAULT_SQLITE_PATH
  const resolvedPath = rawPath === SQLITE_MEMORY_PATH ? SQLITE_MEMORY_PATH : path.resolve(rawPath)
  return Schema.decodeUnknownSync(SqliteDialectSchema)({
    dialect: 'sqlite',
    path: resolvedPath,
  })
}

export const resolveRuntimeLabel = (): SovriumRuntimeLabel =>
  parseDatabaseDialectConfig().dialect === 'postgres' ? 'postgres' : 'sqlite-aio'
