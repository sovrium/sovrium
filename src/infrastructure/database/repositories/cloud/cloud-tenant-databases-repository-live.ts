/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  CloudTenantDatabasesDatabaseError,
  CloudTenantDatabasesRepository,
} from '@/application/ports/repositories/cloud/cloud-tenant-databases-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const wrap = makeDbWrap((cause) => new CloudTenantDatabasesDatabaseError({ cause }))

const TENANT_DB_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."cloud_tenant_databases" (
  "db_name" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

const TENANT_DB_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_cloud_tenant_databases (
  db_name TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const provisionPg = async (dbName: string): Promise<void> => {
  await db.execute(sql.raw(TENANT_DB_TABLE_DDL_PG))
  await db.execute(sql`
    INSERT INTO "system"."cloud_tenant_databases" ("db_name", "status")
    VALUES (${dbName}, 'provisioned')
    ON CONFLICT ("db_name")
    DO UPDATE SET "status" = 'provisioned', "updated_at" = NOW()
  `)
}

const provisionSqlite = async (dbName: string): Promise<void> => {
  const sqliteDb = db as any
  await sqliteDb.run(sql.raw(TENANT_DB_TABLE_DDL_SQLITE))
  await sqliteDb.run(sql`
    INSERT INTO system_cloud_tenant_databases (db_name, status)
    VALUES (${dbName}, 'provisioned')
    ON CONFLICT (db_name)
    DO UPDATE SET status = 'provisioned', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
  `)
}

const dropPg = async (dbName: string): Promise<void> => {
  await db.execute(sql.raw(TENANT_DB_TABLE_DDL_PG))
  await db.execute(sql`
    UPDATE "system"."cloud_tenant_databases"
    SET "status" = 'dropped', "updated_at" = NOW()
    WHERE "db_name" = ${dbName}
  `)
}

const dropSqlite = async (dbName: string): Promise<void> => {
  const sqliteDb = db as any
  await sqliteDb.run(sql.raw(TENANT_DB_TABLE_DDL_SQLITE))
  await sqliteDb.run(sql`
    UPDATE system_cloud_tenant_databases
    SET status = 'dropped', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
    WHERE db_name = ${dbName}
  `)
}

export const CloudTenantDatabasesRepositoryLive = Layer.succeed(CloudTenantDatabasesRepository, {
  provision: (dbName) =>
    wrap(() => (isSqliteRuntime() ? provisionSqlite(dbName) : provisionPg(dbName))),
  drop: (dbName) => wrap(() => (isSqliteRuntime() ? dropSqlite(dbName) : dropPg(dbName))),
})
