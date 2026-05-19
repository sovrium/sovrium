/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { pgSchema, serial, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const systemSchema = pgSchema('system')

export const sovriumMigrationHistory = systemSchema.table('migration_history', {
  id: serial('id').primaryKey(),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema'),
  appliedAt: timestamp('applied_at').defaultNow(),
  rolledBackAt: timestamp('rolled_back_at'),
})

export const sovriumMigrationLog = systemSchema.table('migration_log', {
  id: serial('id').primaryKey(),
  operation: text('operation').notNull(),
  fromVersion: integer('from_version'),
  toVersion: integer('to_version'),
  reason: text('reason'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const sovriumSchemaChecksum = systemSchema.table('schema_checksum', {
  id: text('id').primaryKey(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export type SovriumMigrationHistory = typeof sovriumMigrationHistory.$inferSelect
export type NewSovriumMigrationHistory = typeof sovriumMigrationHistory.$inferInsert
export type SovriumMigrationLog = typeof sovriumMigrationLog.$inferSelect
export type NewSovriumMigrationLog = typeof sovriumMigrationLog.$inferInsert
export type SovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferSelect
export type NewSovriumSchemaChecksum = typeof sovriumSchemaChecksum.$inferInsert
