/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'

/**
 * Migration & audit tables — sqlite-core mirror of `schema/migration-audit.ts`.
 *
 * The pg-core file exports a `systemSchema` (`pgSchema('system')`) object that
 * sibling files import. SQLite has no schemas, so the `systemTable()` helper
 * (which prepends `system_`) replaces it — sibling sqlite mirror files import
 * `systemTable` from `./table-helpers` directly rather than a `systemSchema`
 * object.
 */

/**
 * Migration History Table Schema
 *
 * Tracks all schema migrations with timestamps and checksums.
 * Each migration is recorded with a version number and the complete schema snapshot.
 */
export const sovriumMigrationHistory = systemTable('migration_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  schema: text('schema', { mode: 'json' }),
  appliedAt: integer('applied_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  rolledBackAt: integer('rolled_back_at', { mode: 'timestamp_ms' }),
})

/**
 * Migration Log Table Schema
 *
 * Tracks migration operations including rollbacks with status and reason.
 * Used for debugging and audit trail of schema changes.
 */
export const sovriumMigrationLog = systemTable('migration_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operation: text('operation').notNull(),
  fromVersion: integer('from_version'),
  toVersion: integer('to_version'),
  reason: text('reason'),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
})

/**
 * Schema Checksum Table Schema
 *
 * Singleton table storing current schema checksum for change detection.
 * Uses a single row with id='singleton' to track the current state.
 */
export const sovriumSchemaChecksum = systemTable('schema_checksum', {
  id: text('id').primaryKey(),
  checksum: text('checksum').notNull(),
  schema: text('schema', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
})

// Type exports for consumers
export type SovriumMigrationHistory = typeof sovriumMigrationHistory.$inferSelect
export type NewSovriumMigrationHistory = typeof sovriumMigrationHistory.$inferInsert
export type SovriumMigrationLog = typeof sovriumMigrationLog.$inferSelect
export type NewSovriumMigrationLog = typeof sovriumMigrationLog.$inferInsert
export type SovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferSelect
export type NewSovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferInsert
