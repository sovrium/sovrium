/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, blob, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'


export const fileStorageMetadata = systemTable(
  'file_storage_metadata',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
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
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index('file_storage_metadata_key_idx').on(table.key),
    index('file_storage_metadata_table_record_idx').on(table.tableName, table.recordId),
    index('file_storage_metadata_uploadedById_idx').on(table.uploadedById),
  ]
)

export const fileStorageBytea = systemTable('file_storage_bytea', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  metadataId: text('metadata_id')
    .notNull()
    .references(() => fileStorageMetadata.id, { onDelete: 'cascade' })
    .unique(),
  content: blob('content', { mode: 'buffer' }).notNull(),
})

export type FileStorageMetadataRow = typeof fileStorageMetadata.$inferSelect
export type NewFileStorageMetadata = typeof fileStorageMetadata.$inferInsert
export type FileStorageByteaRow = typeof fileStorageBytea.$inferSelect
