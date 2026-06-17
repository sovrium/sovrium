/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  CloudHostRegistryDatabaseError,
  CloudHostRegistryRepository,
} from '@/application/ports/repositories/cloud/cloud-host-registry-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { CloudHostRegistryRecord } from '@/application/ports/repositories/cloud/cloud-host-registry-repository'

const wrap = makeDbWrap((cause) => new CloudHostRegistryDatabaseError({ cause }))

const nullable = (value: string | number | undefined): string | number | null =>
  value ?? null

const REGISTRY_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."cloud_host_registry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "effect" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "status" TEXT,
  "config_ref" TEXT,
  "port" INTEGER,
  "container_size" TEXT,
  "version" TEXT,
  "lines" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

const REGISTRY_INDEX_EFFECT_TARGET_PG = `
CREATE INDEX IF NOT EXISTS "idx_cloud_host_registry_effect_target"
  ON "system"."cloud_host_registry" ("effect", "target")
`.trim()

const REGISTRY_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_cloud_host_registry (
  id TEXT PRIMARY KEY,
  effect TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT,
  config_ref TEXT,
  port INTEGER,
  container_size TEXT,
  version TEXT,
  lines INTEGER,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const REGISTRY_INDEX_EFFECT_TARGET_SQLITE = `
CREATE INDEX IF NOT EXISTS idx_cloud_host_registry_effect_target
  ON system_cloud_host_registry (effect, target)
`.trim()

const recordPg = async (input: CloudHostRegistryRecord): Promise<void> => {
  await db.execute(sql.raw(REGISTRY_TABLE_DDL_PG))
  await db.execute(sql.raw(REGISTRY_INDEX_EFFECT_TARGET_PG))
  await db.execute(sql`
    INSERT INTO "system"."cloud_host_registry"
      ("effect", "target", "status", "config_ref", "port", "container_size", "version", "lines")
    VALUES (
      ${input.effect},
      ${input.target},
      ${nullable(input.status)},
      ${nullable(input.configRef)},
      ${nullable(input.port)},
      ${nullable(input.containerSize)},
      ${nullable(input.version)},
      ${nullable(input.lines)}
    )
  `)
}

const recordSqlite = async (input: CloudHostRegistryRecord): Promise<void> => {
  const sqliteDb = db as any
  await sqliteDb.run(sql.raw(REGISTRY_TABLE_DDL_SQLITE))
  await sqliteDb.run(sql.raw(REGISTRY_INDEX_EFFECT_TARGET_SQLITE))
  await sqliteDb.run(sql`
    INSERT INTO system_cloud_host_registry
      (id, effect, target, status, config_ref, port, container_size, version, lines)
    VALUES (
      ${crypto.randomUUID()},
      ${input.effect},
      ${input.target},
      ${nullable(input.status)},
      ${nullable(input.configRef)},
      ${nullable(input.port)},
      ${nullable(input.containerSize)},
      ${nullable(input.version)},
      ${nullable(input.lines)}
    )
  `)
}

export const CloudHostRegistryRepositoryLive = Layer.succeed(CloudHostRegistryRepository, {
  record: (input) => wrap(() => (isSqliteRuntime() ? recordSqlite(input) : recordPg(input))),
})
