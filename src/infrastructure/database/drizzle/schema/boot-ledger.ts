/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { index, jsonb, text, timestamp } from 'drizzle-orm/pg-core'
import { systemSchema } from './migration-audit'

/**
 * `system.boot_ledger` — one row per server start whose app version or config
 * hash differs from the row before it ([internal ref] amendment A6, surface 8).
 *
 * The same family as `system.automation_runs` and `system.audit_log`:
 * append-only, system-written, read-only over HTTP. Nothing here is authored —
 * an operator declares no ledger and cannot configure one. A6 draws the line
 * that admits it at all: **it records; it never stages.** Every row describes a
 * boot that already happened, which is what separates it from D1's refused
 * "version ledger", whose referent is [internal ref]'s *draft* store.
 *
 * ─── THE ROW IS REDACTED AT CAPTURE, NOT ON READ ────────────────────────────
 *
 * Because this table PERSISTS, redaction on the way out is not enough: a row
 * redacted at serialisation time is a plaintext credential at rest, reachable
 * by every backup, every restore, every ad-hoc query and the
 * `MCP_EXPOSE_INTERNALS` reader. `boot-ledger-capture.ts` therefore passes the
 * WHOLE payload — snapshot, derived DDL, summary and stats alike — through
 * `redactSecretsForApp` before the insert. Nothing below this line redacts;
 * nothing above it may assume a value here is unscrubbed.
 *
 * ─── NO UNIQUE INDEX ON `config_hash`, DELIBERATELY ─────────────────────────
 *
 * An operator who reverts a change and redeploys boots a hash the ledger has
 * already seen, and that is a real boot that must get a real row. A unique
 * index would refuse it. The consequence — that a hash is an address but not an
 * identity — is carried by the read: a hash resolves to the NEWEST row bearing
 * it, and `id` addresses any row exactly.
 *
 * `(app_name, booted_at)` is the only access path either read uses: the list
 * walks it backwards, and the detail read finds a row's predecessor with it.
 */
export const bootLedger = systemSchema.table(
  'boot_ledger',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    /** Which app's ledger, mirroring `design_system_shares.app_name`. */
    appName: text('app_name').notNull().default('default'),

    /** `app.version` as booted. Null when the config declares none — most do not. */
    appVersion: text('app_version'),

    /** `getSovriumVersion()` at the moment of capture. */
    engineVersion: text('engine_version').notNull(),

    /** The previous row's engine version. Null on the baseline row. */
    prevEngineVersion: text('prev_engine_version'),

    /**
     * Twelve hex characters over the canonical JSON of the REDACTED snapshot —
     * NOT over the config file's bytes, which is what the CLI lock file hashes.
     * Two properties follow and both are the point: re-formatting `app.ts`
     * writes no row, and rotating a hardcoded secret writes no row, because
     * `***` is `***` on both sides.
     */
    configHash: text('config_hash').notNull(),

    /** The previous row's config hash. Null on the baseline row. */
    prevConfigHash: text('prev_config_hash'),

    bootedAt: timestamp('booted_at', { withTimezone: true }).notNull().defaultNow(),

    /** `sovrium <verb>` through the CLI, `embedded` for a library boot. Never a person. */
    bootedBy: text('booted_by'),

    /** A one-line label generated from the diff at capture. Never operator prose. */
    summary: text('summary').notNull(),

    /** `{ added, removed, tables, fields, automations, agents, links }`, derived once. */
    stats: jsonb('stats').notNull(),

    /** `[{ folder, appliedAt, statements }]` applied SINCE the previous row. */
    engineMigrations: jsonb('engine_migrations').notNull(),

    /** `[{ statement, table, appliedAt }]` derived from the two snapshots' `tables`. */
    derivedDdl: jsonb('derived_ddl').notNull(),

    /** The redacted `App` this boot ran. Stored to be diffed against; never served. */
    snapshot: jsonb('snapshot').notNull(),
  },
  (table) => [index('boot_ledger_app_booted_at_idx').on(table.appName, table.bootedAt)]
)

export type BootLedgerRow = typeof bootLedger.$inferSelect
export type NewBootLedgerRow = typeof bootLedger.$inferInsert
