/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { pgTable, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

/**
 * Migration History Table Schema
 *
 * Tracks all schema migrations with timestamps and checksums.
 * Each migration is recorded with a version number and the complete schema snapshot.
 */
export const sovriumMigrationHistory = pgTable('_sovrium_migration_history', {
  id: serial('id').primaryKey(),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema'),
  appliedAt: timestamp('applied_at').defaultNow(),
})

/**
 * Migration Log Table Schema
 *
 * Tracks migration operations including rollbacks with status and reason.
 * Used for debugging and audit trail of schema changes.
 */
export const sovriumMigrationLog = pgTable('_sovrium_migration_log', {
  id: serial('id').primaryKey(),
  operation: text('operation').notNull(),
  fromVersion: integer('from_version'),
  toVersion: integer('to_version'),
  reason: text('reason'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

/**
 * Schema Checksum Table Schema
 *
 * Singleton table storing current schema checksum for change detection.
 * Uses a single row with id='singleton' to track the current state.
 */
export const sovriumSchemaChecksum = pgTable('_sovrium_schema_checksum', {
  id: text('id').primaryKey(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema').notNull(),
})

// Type exports for consumers
export type SovriumMigrationHistory = typeof sovriumMigrationHistory.$inferSelect
export type NewSovriumMigrationHistory = typeof sovriumMigrationHistory.$inferInsert
export type SovriumMigrationLog = typeof sovriumMigrationLog.$inferSelect
export type NewSovriumMigrationLog = typeof sovriumMigrationLog.$inferInsert
export type SovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferSelect
export type NewSovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferInsert
