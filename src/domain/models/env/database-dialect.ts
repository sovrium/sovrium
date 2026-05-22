/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as path from 'node:path'
import { Schema } from 'effect'
import { defaultSqliteDbPath } from './data-dir'

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
      description: 'Resolved SQLite database file path, or ":memory:"',
      examples: ['./database.db', ':memory:'],
    })
  ),
})

export const DatabaseDialectSchema = Schema.Union(PostgresDialectSchema, SqliteDialectSchema)

export type DatabaseDialectConfig = Schema.Schema.Type<typeof DatabaseDialectSchema>
export type PostgresDialectConfig = Schema.Schema.Type<typeof PostgresDialectSchema>
export type SqliteDialectConfig = Schema.Schema.Type<typeof SqliteDialectSchema>

export const SQLITE_MEMORY_PATH = ':memory:'

const SQLITE_SCHEME_RE = /^(file:|sqlite:\/\/|sqlite:)/

const parseSqliteUrl = (raw: string): string => {
  if (raw === SQLITE_MEMORY_PATH) return SQLITE_MEMORY_PATH

  const match = SQLITE_SCHEME_RE.exec(raw)
  if (!match) {
    throw new Error(
      `Unsupported DATABASE_URL scheme: "${raw}". Use postgres://, postgresql://, ` +
        `file:, sqlite:, or :memory:. A bare filesystem path is not accepted — ` +
        `prefix it with file: (e.g. file:./database.db).`
    )
  }

  const strippedPath = raw.slice(match[0].length)
  if (strippedPath === '') {
    throw new Error(
      `Empty path in DATABASE_URL: "${raw}". Provide a file path (e.g. file:./database.db).`
    )
  }
  return path.resolve(strippedPath)
}

export const parseDatabaseDialectConfig = (): DatabaseDialectConfig => {
  const databaseUrl = process.env.DATABASE_URL

  if (databaseUrl && /^postgres(ql)?:\/\//.test(databaseUrl)) {
    return Schema.decodeUnknownSync(PostgresDialectSchema)({
      dialect: 'postgres',
      databaseUrl,
    })
  }

  if (!databaseUrl) {
    return Schema.decodeUnknownSync(SqliteDialectSchema)({
      dialect: 'sqlite',
      path: defaultSqliteDbPath(),
    })
  }

  return Schema.decodeUnknownSync(SqliteDialectSchema)({
    dialect: 'sqlite',
    path: parseSqliteUrl(databaseUrl),
  })
}

export const resolveRuntimeLabel = (): SovriumRuntimeLabel =>
  parseDatabaseDialectConfig().dialect === 'postgres' ? 'postgres' : 'sqlite-aio'
