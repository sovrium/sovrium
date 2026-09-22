/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { index, integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/boot-ledger.ts` — physical table
 * `system_boot_ledger`.
 *
 * Every exported identifier matches the pg-core module so the runtime barrel
 * swap stays transparent to importers. See the pg module for what a row is,
 * why redaction happens at capture, and why `config_hash` carries no unique
 * index.
 *
 * Two mechanical differences, both forced by the engine and neither a choice:
 * SQLite has no `jsonb`, so the four document columns are `text(…, { mode:
 * 'json' })` — the same substitution `schema-sqlite/audit-log.ts` makes for
 * `metadata`; and `booted_at` is `integer(…, { mode: 'timestamp_ms' })` rather
 * than a `timestamptz`.
 */
export const bootLedger = systemTable(
  'boot_ledger',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    appName: text('app_name').notNull().default('default'),
    appVersion: text('app_version'),
    engineVersion: text('engine_version').notNull(),
    prevEngineVersion: text('prev_engine_version'),
    configHash: text('config_hash').notNull(),
    prevConfigHash: text('prev_config_hash'),
    bootedAt: integer('booted_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    bootedBy: text('booted_by'),
    summary: text('summary').notNull(),
    stats: text('stats', { mode: 'json' }).notNull(),
    engineMigrations: text('engine_migrations', { mode: 'json' }).notNull(),
    derivedDdl: text('derived_ddl', { mode: 'json' }).notNull(),
    snapshot: text('snapshot', { mode: 'json' }).notNull(),
  },
  (table) => [index('boot_ledger_app_booted_at_idx').on(table.appName, table.bootedAt)]
)
