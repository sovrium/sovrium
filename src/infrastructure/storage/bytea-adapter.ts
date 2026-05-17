/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/no-expression-statements, functional/no-throw-statements */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'

/**
 * PostgreSQL bytea storage adapter.
 *
 * Persists binary content to the platform-internal `system.file_storage_bytea`
 * table, with metadata in `system.file_storage_metadata`. Both tables are
 * created by Drizzle schema migrations (see
 * `src/infrastructure/database/drizzle/schema/storage.ts`) and follow the
 * `system.*` naming convention documented in
 * `docs/architecture/patterns/internal-table-naming-convention.md`.
 *
 * This is the zero-dependency fallback when no S3 or local storage is configured.
 */

/**
 * Validate the database connection at server startup when the bytea storage
 * provider is selected (auto-fallback when STORAGE_PROVIDER is unset and
 * DATABASE_URL is set). Only checks connectivity — the
 * `system.file_storage_bytea` and `system.file_storage_metadata` tables are
 * created by Drizzle migrations during `serverFactory.create()`, which runs
 * AFTER this validation but BEFORE any real upload/download is attempted.
 *
 * Naturally rejects if the database is unreachable — the surrounding
 * `Effect.tryPromise` converts this to a `StorageError` that fails server
 * startup.
 */
export const byteaValidateAndInit = async (): Promise<void> => {
  await db.execute(sql`SELECT 1`)
}

/**
 * Upsert a file: write metadata row (or update on key conflict) and
 * upsert binary content keyed by the resulting metadata id.
 */
export const byteaUpload = async (
  key: string,
  content: Uint8Array,
  mimeType: string
): Promise<void> => {
  const filename = key.split('/').at(-1) ?? key
  const buf = Buffer.from(content)

  const result = (await db.execute(sql`
    INSERT INTO system.file_storage_metadata
      (key, filename, mime_type, size, storage_provider)
    VALUES (${key}, ${filename}, ${mimeType}, ${content.length}, 'bytea')
    ON CONFLICT (key) DO UPDATE SET
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      storage_provider = EXCLUDED.storage_provider
    RETURNING id
  `)) as readonly Record<string, unknown>[]

  const row = result[0] as { id: string } | undefined
  if (!row) {
    throw new Error(`Failed to upsert metadata for key: ${key}`)
  }

  await db.execute(sql`
    INSERT INTO system.file_storage_bytea (metadata_id, content)
    VALUES (${row.id}, ${buf})
    ON CONFLICT (metadata_id) DO UPDATE SET content = EXCLUDED.content
  `)
}

export const byteaDownload = async (key: string): Promise<Uint8Array> => {
  const result = (await db.execute(sql`
    SELECT b.content
    FROM system.file_storage_bytea b
    JOIN system.file_storage_metadata m ON m.id = b.metadata_id
    WHERE m.key = ${key} AND m.storage_provider = 'bytea'
    LIMIT 1
  `)) as readonly Record<string, unknown>[]

  const row = result[0] as { content: Uint8Array | Buffer } | undefined
  if (!row) {
    throw new Error(`File not found: ${key}`)
  }
  return row.content instanceof Uint8Array
    ? row.content
    : new Uint8Array(row.content as ArrayBuffer)
}

/**
 * Delete by key. The bytea row is removed automatically via the
 * `metadata_id` FK ON DELETE CASCADE.
 * Throws "File not found: <key>" when no row matches, so the route handler
 * can return 404 via `isNotFoundError`.
 */
export const byteaDelete = async (key: string): Promise<void> => {
  const result = (await db.execute(sql`
    DELETE FROM system.file_storage_metadata
    WHERE key = ${key} AND storage_provider = 'bytea'
    RETURNING key
  `)) as readonly Record<string, unknown>[]
  if (result.length === 0) {
    throw new Error(`File not found: ${key}`)
  }
}

export const byteaList = async (prefix: string): Promise<readonly string[]> => {
  const limit = 1000
  const result = (await db.execute(sql`
    SELECT key FROM system.file_storage_metadata
    WHERE storage_provider = 'bytea' AND key LIKE ${prefix + '%'}
    ORDER BY key
    LIMIT ${limit}
  `)) as readonly Record<string, unknown>[]
  return result.map((r) => (r as { key: string }).key)
}

/**
 * Sum the `size` column across all bytea-provider rows in
 * `system.file_storage_metadata`. Used for total-storage quota enforcement
 * (`STORAGE_MAX_TOTAL_SIZE`). Returns 0 when the table is empty.
 */
export const byteaGetTotalBytes = async (): Promise<number> => {
  const result = (await db.execute(sql`
    SELECT COALESCE(SUM(size), 0) AS total
    FROM system.file_storage_metadata
    WHERE storage_provider = 'bytea'
  `)) as readonly Record<string, unknown>[]
  const row = result[0] as { total: string | number } | undefined
  return Number(row?.total ?? 0)
}

/**
 * Upsert a metadata row in system.file_storage_metadata for non-bytea providers
 * (e.g. S3, local) that store binary content outside the database. This lets every
 * storage backend maintain a consistent, queryable metadata catalog without
 * duplicating the upsert logic across adapters.
 */
export const writeFileMetadata = async (
  key: string,
  mimeType: string,
  size: number,
  storageProvider: string
): Promise<void> => {
  const filename = key.split('/').at(-1) ?? key
  // Strip MIME type parameters (e.g. "text/plain;charset=utf-8" → "text/plain")
  // so the stored value is always the canonical base type.
  const baseMimeType = (mimeType.split(';').at(0) ?? mimeType).trim()
  await db.execute(sql`
    INSERT INTO system.file_storage_metadata
      (key, filename, mime_type, size, storage_provider)
    VALUES (${key}, ${filename}, ${baseMimeType}, ${size}, ${storageProvider})
    ON CONFLICT (key) DO UPDATE SET
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      storage_provider = EXCLUDED.storage_provider
  `)
}

/**
 * Delete the metadata row for any storage provider by key.
 * Returns `true` when the row was found and deleted, `false` when the key
 * does not exist in `system.file_storage_metadata`.
 *
 * Used by non-bytea providers (e.g. S3) to detect "file not found" before
 * issuing their own idempotent delete calls.
 */
export const deleteFileMetadata = async (key: string): Promise<boolean> => {
  const result = (await db.execute(sql`
    DELETE FROM system.file_storage_metadata
    WHERE key = ${key}
    RETURNING key
  `)) as readonly Record<string, unknown>[]
  return result.length > 0
}

/**
 * Read the catalog row for `key` from `system.file_storage_metadata`. Every
 * provider (S3, local, bytea) keeps this table in sync via {@link writeFileMetadata}
 * / {@link byteaUpload}, so this is the provider-agnostic source for a file's
 * content type / size / last-modified timestamp. Returns `undefined` when no
 * file is stored under `key`.
 */
export const readFileMetadata = async (
  key: string
): Promise<
  { readonly contentType: string; readonly size: number; readonly lastModified: string } | undefined
> => {
  const result = (await db.execute(sql`
    SELECT mime_type, size, created_at AS modified
    FROM system.file_storage_metadata
    WHERE key = ${key}
    LIMIT 1
  `)) as readonly Record<string, unknown>[]
  const row = result[0] as
    | { mime_type: string; size: string | number; modified: string | Date }
    | undefined
  if (!row) return undefined
  const modified =
    row.modified instanceof Date ? row.modified.toISOString() : new Date(row.modified).toISOString()
  return { contentType: row.mime_type, size: Number(row.size), lastModified: modified }
}

/** @public */
export const byteaExists = async (key: string): Promise<boolean> => {
  const result = (await db.execute(sql`
    SELECT 1 FROM system.file_storage_metadata
    WHERE key = ${key} AND storage_provider = 'bytea'
    LIMIT 1
  `)) as readonly Record<string, unknown>[]
  return result.length > 0
}
