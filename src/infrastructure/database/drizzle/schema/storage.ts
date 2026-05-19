/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, integer, index, customType } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

export const fileStorageMetadata = systemSchema.table(
  'file_storage_metadata',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    key: text('key').notNull().unique(),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    storageProvider: text('storage_provider').notNull(),
    storagePath: text('storage_path'),
    uploadedById: text('uploaded_by_id').references(() => users.id, { onDelete: 'set null' }),
    tableName: text('table_name'),
    recordId: text('record_id'),
    fieldName: text('field_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('file_storage_metadata_key_idx').on(table.key),
    index('file_storage_metadata_table_record_idx').on(table.tableName, table.recordId),
    index('file_storage_metadata_uploadedById_idx').on(table.uploadedById),
  ]
)

export const fileStorageBytea = systemSchema.table('file_storage_bytea', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  metadataId: text('metadata_id')
    .notNull()
    .references(() => fileStorageMetadata.id, { onDelete: 'cascade' })
    .unique(),
  content: bytea('content').notNull(),
})

export type FileStorageMetadataRow = typeof fileStorageMetadata.$inferSelect
export type NewFileStorageMetadata = typeof fileStorageMetadata.$inferInsert
export type FileStorageByteaRow = typeof fileStorageBytea.$inferSelect
