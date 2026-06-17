/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  CloudSupervisorDatabaseError,
  CloudSupervisorRepository,
} from '@/application/ports/repositories/cloud/cloud-supervisor-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const wrap = makeDbWrap((cause) => new CloudSupervisorDatabaseError({ cause }))

const REGISTRY_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."cloud_supervisor_registry" (
  "app_slug" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "sovrium_version" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

const ENV_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."cloud_supervisor_env" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "app_slug" TEXT NOT NULL,
  "env_key" TEXT NOT NULL,
  "env_value" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("app_slug", "env_key")
)
`.trim()

const ENV_INDEX_APP_SLUG_PG = `
CREATE INDEX IF NOT EXISTS "idx_cloud_supervisor_env_app_slug"
  ON "system"."cloud_supervisor_env" ("app_slug")
`.trim()

const REGISTRY_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_cloud_supervisor_registry (
  app_slug TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  sovrium_version TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const ENV_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_cloud_supervisor_env (
  id TEXT PRIMARY KEY,
  app_slug TEXT NOT NULL,
  env_key TEXT NOT NULL,
  env_value TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  UNIQUE (app_slug, env_key)
)
`.trim()

const ENV_INDEX_APP_SLUG_SQLITE = `
CREATE INDEX IF NOT EXISTS idx_cloud_supervisor_env_app_slug
  ON system_cloud_supervisor_env (app_slug)
`.trim()

const sqliteDb = (): any => db as any

const registerPg = async (appSlug: string, sovriumVersion: string): Promise<void> => {
  await db.execute(sql.raw(REGISTRY_TABLE_DDL_PG))
  await db.execute(sql`
    INSERT INTO "system"."cloud_supervisor_registry" ("app_slug", "status", "sovrium_version")
    VALUES (${appSlug}, 'running', ${sovriumVersion})
    ON CONFLICT ("app_slug")
    DO UPDATE SET
      "status" = 'running',
      "sovrium_version" = ${sovriumVersion},
      "updated_at" = NOW()
  `)
}

const registerSqlite = async (appSlug: string, sovriumVersion: string): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql.raw(REGISTRY_TABLE_DDL_SQLITE))
  await sdb.run(sql`
    INSERT INTO system_cloud_supervisor_registry (app_slug, status, sovrium_version)
    VALUES (${appSlug}, 'running', ${sovriumVersion})
    ON CONFLICT (app_slug)
    DO UPDATE SET
      status = 'running',
      sovrium_version = ${sovriumVersion},
      updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
  `)
}

const stopPg = async (appSlug: string): Promise<void> => {
  await db.execute(sql.raw(REGISTRY_TABLE_DDL_PG))
  await db.execute(sql`
    INSERT INTO "system"."cloud_supervisor_registry" ("app_slug", "status")
    VALUES (${appSlug}, 'stopped')
    ON CONFLICT ("app_slug")
    DO UPDATE SET "status" = 'stopped', "updated_at" = NOW()
  `)
}

const stopSqlite = async (appSlug: string): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql.raw(REGISTRY_TABLE_DDL_SQLITE))
  await sdb.run(sql`
    INSERT INTO system_cloud_supervisor_registry (app_slug, status)
    VALUES (${appSlug}, 'stopped')
    ON CONFLICT (app_slug)
    DO UPDATE SET status = 'stopped', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
  `)
}

const removePg = async (appSlug: string): Promise<void> => {
  await db.execute(sql.raw(REGISTRY_TABLE_DDL_PG))
  await db.execute(sql`
    DELETE FROM "system"."cloud_supervisor_registry" WHERE "app_slug" = ${appSlug}
  `)
}

const removeSqlite = async (appSlug: string): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql.raw(REGISTRY_TABLE_DDL_SQLITE))
  await sdb.run(sql`
    DELETE FROM system_cloud_supervisor_registry WHERE app_slug = ${appSlug}
  `)
}

const recordEnvPg = async (appSlug: string, envKeys: readonly string[]): Promise<void> => {
  await db.execute(sql.raw(ENV_TABLE_DDL_PG))
  await db.execute(sql.raw(ENV_INDEX_APP_SLUG_PG))
  await db.execute(sql`
    DELETE FROM "system"."cloud_supervisor_env" WHERE "app_slug" = ${appSlug}
  `)
  await Promise.all(
    envKeys.map((envKey) =>
      db.execute(sql`
        INSERT INTO "system"."cloud_supervisor_env" ("app_slug", "env_key")
        VALUES (${appSlug}, ${envKey})
      `)
    )
  )
}

const recordEnvSqlite = async (appSlug: string, envKeys: readonly string[]): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql.raw(ENV_TABLE_DDL_SQLITE))
  await sdb.run(sql.raw(ENV_INDEX_APP_SLUG_SQLITE))
  await sdb.run(sql`
    DELETE FROM system_cloud_supervisor_env WHERE app_slug = ${appSlug}
  `)
  await Promise.all(
    envKeys.map((envKey) =>
      sdb.run(sql`
        INSERT INTO system_cloud_supervisor_env (id, app_slug, env_key)
        VALUES (${crypto.randomUUID()}, ${appSlug}, ${envKey})
      `)
    )
  )
}


const ENV_VARS_TABLE = 'environment_variables'
const SECRETS_TABLE = 'secrets'

type ResolvedEnvVar = { readonly key: string; readonly value: string }

const userTableExistsPg = async (table: string): Promise<boolean> => {
  const rows = (await db.execute(
    sql`SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS present`
  )) as unknown as ReadonlyArray<Record<string, unknown>>
  return rows[0]?.['present'] === true
}

const userTableExistsSqlite = async (table: string): Promise<boolean> => {
  const sdb = sqliteDb()
  const result = await sdb.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${table}`
  )
  return (result as ReadonlyArray<Record<string, unknown>>).length > 0
}

const resolveEnvVarsPg = async (appSlug: string): Promise<readonly ResolvedEnvVar[]> => {
  if (!(await userTableExistsPg(ENV_VARS_TABLE))) return []
  const hasSecrets = await userTableExistsPg(SECRETS_TABLE)
  const rows = (await db
    .execute(
      sql`
    SELECT "env_key", "value", "secret_ref"
    FROM ${sql.identifier(ENV_VARS_TABLE)}
    WHERE "app_slug" = ${appSlug}
  `
    )
    .catch(() => [] as unknown)) as unknown as ReadonlyArray<Record<string, unknown>>

  const resolved = await Promise.all(
    rows.map(async (row): Promise<ResolvedEnvVar | undefined> => {
      const key = row['env_key']
      if (typeof key !== 'string') return undefined
      const plain = row['value']
      if (typeof plain === 'string' && plain.length > 0) return { key, value: plain }
      const secretRef = row['secret_ref']
      if (typeof secretRef !== 'string' || secretRef.length === 0 || !hasSecrets) return undefined
      const secretRows = (await db.execute(sql`
        SELECT "value" FROM ${sql.identifier(SECRETS_TABLE)} WHERE "ref" = ${secretRef} LIMIT 1
      `)) as unknown as ReadonlyArray<Record<string, unknown>>
      const secretValue = secretRows[0]?.['value']
      return typeof secretValue === 'string' ? { key, value: secretValue } : undefined
    })
  )
  return resolved.filter((entry): entry is ResolvedEnvVar => entry !== undefined)
}

const resolveEnvVarsSqlite = async (appSlug: string): Promise<readonly ResolvedEnvVar[]> => {
  if (!(await userTableExistsSqlite(ENV_VARS_TABLE))) return []
  const sdb = sqliteDb()
  const hasSecrets = await userTableExistsSqlite(SECRETS_TABLE)
  const rows = (await sdb
    .all(
      sql`
    SELECT env_key, value, secret_ref
    FROM ${sql.identifier(ENV_VARS_TABLE)}
    WHERE app_slug = ${appSlug}
  `
    )
    .catch(() => [] as unknown)) as ReadonlyArray<Record<string, unknown>>

  const resolved = await Promise.all(
    rows.map(async (row): Promise<ResolvedEnvVar | undefined> => {
      const key = row['env_key']
      if (typeof key !== 'string') return undefined
      const plain = row['value']
      if (typeof plain === 'string' && plain.length > 0) return { key, value: plain }
      const secretRef = row['secret_ref']
      if (typeof secretRef !== 'string' || secretRef.length === 0 || !hasSecrets) return undefined
      const secretRows = (await sdb.all(sql`
        SELECT value FROM ${sql.identifier(SECRETS_TABLE)} WHERE ref = ${secretRef} LIMIT 1
      `)) as ReadonlyArray<Record<string, unknown>>
      const secretValue = secretRows[0]?.['value']
      return typeof secretValue === 'string' ? { key, value: secretValue } : undefined
    })
  )
  return resolved.filter((entry): entry is ResolvedEnvVar => entry !== undefined)
}

const injectEnvPg = async (appSlug: string): Promise<void> => {
  const vars = await resolveEnvVarsPg(appSlug)
  if (vars.length === 0) return
  await db.execute(sql.raw(ENV_TABLE_DDL_PG))
  await Promise.all(
    vars.map((entry) =>
      db.execute(sql`
        INSERT INTO "system"."cloud_supervisor_env" ("app_slug", "env_key", "env_value")
        VALUES (${appSlug}, ${entry.key}, ${entry.value})
        ON CONFLICT ("app_slug", "env_key")
        DO UPDATE SET "env_value" = ${entry.value}
      `)
    )
  )
}

const injectEnvSqlite = async (appSlug: string): Promise<void> => {
  const vars = await resolveEnvVarsSqlite(appSlug)
  if (vars.length === 0) return
  const sdb = sqliteDb()
  await sdb.run(sql.raw(ENV_TABLE_DDL_SQLITE))
  await Promise.all(
    vars.map((entry) =>
      sdb.run(sql`
        INSERT INTO system_cloud_supervisor_env (id, app_slug, env_key, env_value)
        VALUES (${crypto.randomUUID()}, ${appSlug}, ${entry.key}, ${entry.value})
        ON CONFLICT (app_slug, env_key)
        DO UPDATE SET env_value = ${entry.value}
      `)
    )
  )
}

export const CloudSupervisorRepositoryLive = Layer.succeed(CloudSupervisorRepository, {
  register: (appSlug, sovriumVersion) =>
    wrap(() =>
      isSqliteRuntime()
        ? registerSqlite(appSlug, sovriumVersion)
        : registerPg(appSlug, sovriumVersion)
    ),
  stop: (appSlug) => wrap(() => (isSqliteRuntime() ? stopSqlite(appSlug) : stopPg(appSlug))),
  remove: (appSlug) => wrap(() => (isSqliteRuntime() ? removeSqlite(appSlug) : removePg(appSlug))),
  recordEnv: (appSlug, envKeys) =>
    wrap(() =>
      isSqliteRuntime() ? recordEnvSqlite(appSlug, envKeys) : recordEnvPg(appSlug, envKeys)
    ),
  injectEnv: (appSlug) =>
    wrap(() => (isSqliteRuntime() ? injectEnvSqlite(appSlug) : injectEnvPg(appSlug))),
})
