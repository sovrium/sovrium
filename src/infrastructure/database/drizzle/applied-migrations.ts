/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading `__drizzle_migrations` — which engine migrations this database has
 * applied, and when it applied them.
 *
 * `migrate.ts` and `migrate-preflight.ts` both read the same table, but each
 * opens its OWN driver connection from a `DATABASE_URL` because both run before
 * (or instead of) a shared client. This reader runs after the migrator, on the
 * boot path, with `db` already resolved — so it goes through the query builder
 * and is dialect-correct by construction rather than by two hand-written SQL
 * branches.
 *
 * ─── THESE TABLE OBJECTS ARE DELIBERATELY OUTSIDE THE SCHEMA BARRELS ────────
 *
 * `drizzle.config.ts` hands drizzle-kit `schema.ts` / `schema-sqlite.ts` and the
 * kit generates a migration for every Drizzle table it finds there. Re-exporting
 * these two from a barrel would therefore make the kit emit DDL for drizzle's
 * OWN bookkeeping table — a migration that creates the table recording which
 * migrations have run. They live here, imported only by their reader, for that
 * reason. Do not move them into `schema/`.
 *
 * The column sets below are drizzle v1's, verbatim from its migrator:
 *   - Postgres: `drizzle.__drizzle_migrations`, `created_at bigint`,
 *     `applied_at timestamp with time zone DEFAULT now()`
 *   - SQLite:   `__drizzle_migrations`, `created_at numeric`,
 *     `applied_at TEXT` (an ISO string the migrator writes explicitly)
 *
 * `created_at` is the migration FOLDER's timestamp — when it was authored — and
 * `applied_at` is when this database ran it. They are routinely weeks apart, and
 * confusing them is the defect that would make an engine upgrade's migrations
 * invisible to the ledger: a folder authored before the previous boot but
 * applied after it would fall outside any window computed on `created_at`.
 */

import { bigint, pgSchema, text, timestamp } from 'drizzle-orm/pg-core'
import { integer, sqliteTable, text as sqliteText } from 'drizzle-orm/sqlite-core'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '../sql/db-effect'
import { resolveDialectSchema } from './dialect-schema'
import { MigrationError } from './migration-error'

const drizzleSchema = pgSchema('drizzle')

const appliedMigrationsPg = drizzleSchema.table('__drizzle_migrations', {
  hash: text('hash').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }),
  name: text('name'),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
})

const appliedMigrationsSqlite = sqliteTable('__drizzle_migrations', {
  hash: sqliteText('hash').notNull(),
  createdAt: integer('created_at'),
  name: sqliteText('name'),
  appliedAt: sqliteText('applied_at'),
})

const appliedMigrations = resolveDialectSchema(appliedMigrationsPg, appliedMigrationsSqlite)

/** One migration this database has applied. */
export interface AppliedMigration {
  /** The folder name — drizzle v1's own identity for a migration. */
  readonly name: string
  /** When THIS database ran it. */
  readonly appliedAt: Date
}

const wrap = makeDbWrap(
  (cause) =>
    new MigrationError({ message: `Could not read __drizzle_migrations: ${String(cause)}`, cause })
)

/**
 * A stored `applied_at`, on either dialect, falling back to the folder
 * timestamp for a row written before the column had a default.
 *
 * A row that resolves to neither is dropped by the caller rather than dated
 * `now()`: a fabricated application time is exactly the more precise-looking
 * lie the ledger is written to avoid.
 */
const resolveAppliedAt = (appliedAt: unknown, createdAt: unknown): Readonly<Date> | undefined => {
  if (appliedAt instanceof Date && !Number.isNaN(appliedAt.getTime())) return appliedAt
  if (typeof appliedAt === 'string' && appliedAt.length > 0) {
    const parsed = new Date(appliedAt)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return new Date(createdAt)
  return undefined
}

/**
 * Every migration `__drizzle_migrations` currently records, by name and
 * application time.
 *
 * A row with no `name` is a legacy (pre-v1) entry that drizzle's own
 * `upgradeIfNeeded` failed to reconcile; it is dropped rather than reported
 * under a guessed folder, for the same reason the pre-flight ignores an applied
 * row matching no shipped migration — that is a different finding, and this
 * reader is not entitled to make it.
 */
export const readAppliedMigrations: Effect.Effect<readonly AppliedMigration[], MigrationError> =
  wrap(() =>
    db
      .select({
        name: appliedMigrations.name,
        createdAt: appliedMigrations.createdAt,
        appliedAt: appliedMigrations.appliedAt,
      })
      .from(appliedMigrations)
  ).pipe(
    Effect.map((rows) =>
      rows.flatMap((row): readonly AppliedMigration[] => {
        const { name } = row
        if (typeof name !== 'string' || name.length === 0) return []
        const appliedAt = resolveAppliedAt(row.appliedAt, row.createdAt)
        return appliedAt === undefined ? [] : [{ name, appliedAt }]
      })
    )
  )
