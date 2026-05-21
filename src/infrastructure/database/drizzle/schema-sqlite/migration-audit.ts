/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text } from 'drizzle-orm/sqlite-core'
import { systemTable } from './table-helpers'


export const sovriumMigrationHistory = systemTable('migration_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  schema: text('schema', { mode: 'json' }),
  appliedAt: integer('applied_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  rolledBackAt: integer('rolled_back_at', { mode: 'timestamp_ms' }),
})

export const sovriumMigrationLog = systemTable('migration_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operation: text('operation').notNull(),
  fromVersion: integer('from_version'),
  toVersion: integer('to_version'),
  reason: text('reason'),
  status: text('status').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
})

export const sovriumSchemaChecksum = systemTable('schema_checksum', {
  id: text('id').primaryKey(),
  checksum: text('checksum').notNull(),
  schema: text('schema', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
})

export type SovriumMigrationHistory = typeof sovriumMigrationHistory.$inferSelect
export type NewSovriumMigrationHistory = typeof sovriumMigrationHistory.$inferInsert
export type SovriumMigrationLog = typeof sovriumMigrationLog.$inferSelect
export type NewSovriumMigrationLog = typeof sovriumMigrationLog.$inferInsert
export type SovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferSelect
export type NewSovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferInsert
