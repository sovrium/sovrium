/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, blob, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * Storage tables — sqlite-core mirror of `schema/storage.ts`.
 *
 * The pg-core `bytea` custom column type (used for `file_storage_bytea.content`)
 * maps to a SQLite `blob({ mode: 'buffer' })` column — both surface a `Buffer`
 * to the application layer.
 */

/**
 * File Storage Metadata Table
 *
 * Metadata for files across all storage backends (S3, local, bytea/blob).
 */
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
    /**
     * The declared bucket this object belongs to, or NULL when the writer
     * declined to attribute one (see `UNATTRIBUTED_BUCKET`).
     *
     * Storage keys are FLAT — every bucket addresses the same physical
     * keyspace — so this column is the only thing that binds an object to the
     * bucket whose permission block guards it. Reads and deletes that name a
     * bucket compare against it and refuse on mismatch, which is what stops a
     * caller reaching an admin-only object through a sibling public bucket.
     */
    bucket: text('bucket'),
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
    index('file_storage_metadata_bucket_idx').on(table.bucket),
  ]
)

/**
 * File Storage Blob Table
 *
 * SQLite blob content storage (fallback when S3/local not configured) —
 * mirror of the pg-core `bytea` content column. References
 * file_storage_metadata for metadata.
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
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

// Type inference
