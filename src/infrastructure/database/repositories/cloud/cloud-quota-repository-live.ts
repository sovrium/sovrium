/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  CloudQuotaDatabaseError,
  CloudQuotaRepository,
} from '@/application/ports/repositories/cloud/cloud-quota-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const wrap = makeDbWrap((cause) => new CloudQuotaDatabaseError({ cause }))

const REGISTRY_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."cloud_quota_registry" (
  "app_slug" TEXT PRIMARY KEY,
  "container_size" TEXT NOT NULL,
  "cpu_limit" NUMERIC NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

const REGISTRY_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_cloud_quota_registry (
  app_slug TEXT PRIMARY KEY,
  container_size TEXT NOT NULL,
  cpu_limit REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const sqliteDb = (): any => db as any

const applyTierPg = async (
  appSlug: string,
  containerSize: string,
  cpuLimit: number
): Promise<void> => {
  await db.execute(sql.raw(REGISTRY_TABLE_DDL_PG))
  await db.execute(sql`
    INSERT INTO "system"."cloud_quota_registry" ("app_slug", "container_size", "cpu_limit")
    VALUES (${appSlug}, ${containerSize}, ${cpuLimit})
    ON CONFLICT ("app_slug")
    DO UPDATE SET
      "container_size" = ${containerSize},
      "cpu_limit" = ${cpuLimit},
      "updated_at" = NOW()
  `)
}

const applyTierSqlite = async (
  appSlug: string,
  containerSize: string,
  cpuLimit: number
): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql.raw(REGISTRY_TABLE_DDL_SQLITE))
  await sdb.run(sql`
    INSERT INTO system_cloud_quota_registry (app_slug, container_size, cpu_limit)
    VALUES (${appSlug}, ${containerSize}, ${cpuLimit})
    ON CONFLICT (app_slug)
    DO UPDATE SET
      container_size = ${containerSize},
      cpu_limit = ${cpuLimit},
      updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
  `)
}

export const CloudQuotaRepositoryLive = Layer.succeed(CloudQuotaRepository, {
  applyTier: (appSlug, containerSize, cpuLimit) =>
    wrap(() =>
      isSqliteRuntime()
        ? applyTierSqlite(appSlug, containerSize, cpuLimit)
        : applyTierPg(appSlug, containerSize, cpuLimit)
    ),
})
