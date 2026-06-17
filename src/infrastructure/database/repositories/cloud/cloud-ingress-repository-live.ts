/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  CloudIngressDatabaseError,
  CloudIngressRepository,
} from '@/application/ports/repositories/cloud/cloud-ingress-repository'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const wrap = makeDbWrap((cause) => new CloudIngressDatabaseError({ cause }))

const CUSTOM_DOMAINS_TABLE = 'custom_domains'

const ROUTES_TABLE_DDL_PG = `
CREATE TABLE IF NOT EXISTS "system"."cloud_ingress_routes" (
  "domain" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "port" INTEGER,
  "tls_status" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
`.trim()

const ROUTES_TABLE_DDL_SQLITE = `
CREATE TABLE IF NOT EXISTS system_cloud_ingress_routes (
  domain TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  port INTEGER,
  tls_status TEXT,
  created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000),
  updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s','now') AS INTEGER) * 1000)
)
`.trim()

const sqliteDb = (): any => db as any


const attachRoutePg = async (domain: string, port: number): Promise<void> => {
  await db.execute(sql.raw(ROUTES_TABLE_DDL_PG))
  await db.execute(sql`
    INSERT INTO "system"."cloud_ingress_routes" ("domain", "status", "port")
    VALUES (${domain}, 'attached', ${port})
    ON CONFLICT ("domain")
    DO UPDATE SET "status" = 'attached', "port" = ${port}, "updated_at" = NOW()
  `)
}

const attachRouteSqlite = async (domain: string, port: number): Promise<void> => {
  const sdb = sqliteDb()
  await sdb.run(sql.raw(ROUTES_TABLE_DDL_SQLITE))
  await sdb.run(sql`
    INSERT INTO system_cloud_ingress_routes (domain, status, port)
    VALUES (${domain}, 'attached', ${port})
    ON CONFLICT (domain)
    DO UPDATE SET status = 'attached', port = ${port},
      updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
  `)
}


const customDomainsTableExistsPg = async (): Promise<boolean> => {
  const rows = (await db.execute(
    sql`SELECT to_regclass(${`public.${CUSTOM_DOMAINS_TABLE}`}) IS NOT NULL AS present`
  )) as unknown as ReadonlyArray<Record<string, unknown>>
  return rows[0]?.['present'] === true
}

const customDomainsTableExistsSqlite = async (): Promise<boolean> => {
  const sdb = sqliteDb()
  const result = await sdb.all(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${CUSTOM_DOMAINS_TABLE}`
  )
  const rows = result as ReadonlyArray<Record<string, unknown>>
  return rows.length > 0
}

const verifyCustomDomainPg = async (domain: string): Promise<void> => {
  if (!(await customDomainsTableExistsPg())) return
  await db.execute(sql`
    UPDATE ${sql.identifier(CUSTOM_DOMAINS_TABLE)}
    SET verification_status = 'verified'
    WHERE domain = ${domain}
      AND verification_status IN ('pending', 'failed')
  `)
}

const verifyCustomDomainSqlite = async (domain: string): Promise<void> => {
  if (!(await customDomainsTableExistsSqlite())) return
  const sdb = sqliteDb()
  await sdb.run(sql`
    UPDATE ${sql.identifier(CUSTOM_DOMAINS_TABLE)}
    SET verification_status = 'verified'
    WHERE domain = ${domain}
      AND verification_status IN ('pending', 'failed')
  `)
}


const isDomainVerifiedPg = async (domain: string): Promise<boolean> => {
  if (!(await customDomainsTableExistsPg())) return true
  const rows = (await db.execute(sql`
    SELECT count(*)::int AS c
    FROM ${sql.identifier(CUSTOM_DOMAINS_TABLE)}
    WHERE domain = ${domain}
      AND verification_status IN ('pending', 'failed')
  `)) as unknown as ReadonlyArray<Record<string, unknown>>
  return Number(rows[0]?.['c'] ?? 0) === 0
}

const isDomainVerifiedSqlite = async (domain: string): Promise<boolean> => {
  if (!(await customDomainsTableExistsSqlite())) return true
  const sdb = sqliteDb()
  const result = await sdb.all(sql`
    SELECT count(*) AS c
    FROM ${sql.identifier(CUSTOM_DOMAINS_TABLE)}
    WHERE domain = ${domain}
      AND verification_status IN ('pending', 'failed')
  `)
  const rows = result as ReadonlyArray<Record<string, unknown>>
  return Number(rows[0]?.['c'] ?? 0) === 0
}

const issueTlsPg = async (domain: string): Promise<void> => {
  if (!(await isDomainVerifiedPg(domain))) return
  await db.execute(sql.raw(ROUTES_TABLE_DDL_PG))
  await db.execute(sql`
    UPDATE "system"."cloud_ingress_routes"
    SET "tls_status" = 'issued', "updated_at" = NOW()
    WHERE "domain" = ${domain}
  `)
}

const issueTlsSqlite = async (domain: string): Promise<void> => {
  if (!(await isDomainVerifiedSqlite(domain))) return
  const sdb = sqliteDb()
  await sdb.run(sql.raw(ROUTES_TABLE_DDL_SQLITE))
  await sdb.run(sql`
    UPDATE system_cloud_ingress_routes
    SET tls_status = 'issued', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
    WHERE domain = ${domain}
  `)
}

export const ensureCloudIngressRoutesTable = async (): Promise<void> => {
  if (isSqliteRuntime()) {
    const sdb = sqliteDb()
    await sdb.run(sql.raw(ROUTES_TABLE_DDL_SQLITE))
    return
  }
  await db.execute(sql.raw(ROUTES_TABLE_DDL_PG))
}

export const CloudIngressRepositoryLive = Layer.succeed(CloudIngressRepository, {
  attachRoute: (domain, port) =>
    wrap(() => (isSqliteRuntime() ? attachRouteSqlite(domain, port) : attachRoutePg(domain, port))),
  verifyCustomDomain: (domain) =>
    wrap(() =>
      isSqliteRuntime() ? verifyCustomDomainSqlite(domain) : verifyCustomDomainPg(domain)
    ),
  issueTls: (domain) =>
    wrap(() => (isSqliteRuntime() ? issueTlsSqlite(domain) : issueTlsPg(domain))),
})
