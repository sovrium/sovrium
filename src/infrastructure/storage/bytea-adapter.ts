/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  UNATTRIBUTED_BUCKET,
  storageObjectNotFound,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { hasBuiltDbClient } from '@/infrastructure/database/drizzle/db-bun'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { pingThroughMaintenanceSlot } from '@/infrastructure/database/sql/postgres-connection-budget'
import type { BucketBinding, UploadTarget } from '@/application/ports/services/storage-service'

/**
 * The value the `bucket` column takes for a binding.
 *
 * An unattributed write records NULL — the caller declined to name a bucket,
 * and inventing one would expose the object through that bucket's route.
 */
/*
 * `null`, not `undefined`: Drizzle treats the two differently. `null` writes SQL
 * NULL and CLEARS a previous binding on conflict; `undefined` omits the column
 * and would silently RETAIN it, letting an unattributed write inherit a bucket
 * it never asserted.
 */
export const bucketColumnValue = (bucket: BucketBinding): string | null =>
  bucket === UNATTRIBUTED_BUCKET ? null : bucket

/**
 * Does the bucket a caller named match the binding recorded for the object?
 *
 * FAIL CLOSED. A recorded NULL matches NOTHING: an object written before this
 * binding existed, or by a caller that named no bucket, has no known owner, and
 * an object with no known owner must not be reachable through a bucket that is
 * merely guessing. Objects a boot-time repair can attribute are repaired; the
 * rest stay dark until re-uploaded, which is the accepted cost of not serving
 * an admin-only file through a public route.
 *
 * `UNATTRIBUTED_BUCKET` opts out of the comparison entirely — it is the marker
 * for callers that have no bucket concept, and no HTTP route can reach it.
 */
export const bucketBindingMatches = (
  bucket: BucketBinding,
  recorded: string | null | undefined
): boolean => bucket === UNATTRIBUTED_BUCKET || recorded === bucket

/**
 * May a write to this key record `bucket`, given the binding already on the row?
 *
 * A write to a key nobody owns CREATES the binding; a write to a key this same
 * bucket already owns REPLACES the bytes, which is an ordinary re-upload. Any
 * other pairing is a REBIND, and a rebind is what turns a permissive bucket's
 * write right into a write right over every other bucket's objects: a catalog
 * upsert ending `bucket = EXCLUDED.bucket` would let the read-side ownership
 * check on the download path compare against the value the attacker had just
 * written, and agree.
 *
 * Read the asymmetry with {@link bucketBindingMatches} deliberately, because the
 * two treat `UNATTRIBUTED_BUCKET` in opposite ways and both are correct:
 *
 * - On READ it is a WAIVER — "I have no bucket concept, give me the object" —
 *   so it skips the comparison and does not even require a catalog row. The
 *   automation `file:*` actions address keys written out of band.
 * - On WRITE it is a VALUE, the NULL that {@link bucketColumnValue} produces,
 *   and so it must be compared like any other. An unattributed write that
 *   silently cleared a real binding would be a rebind too — to nothing — and
 *   under fail-closed reads that does not open the object up, it makes it dark.
 *
 * A recorded NULL is therefore claimable only by another unattributed write.
 * Legacy rows from before this binding existed stay unwritable through a named
 * bucket until the boot-time repair attributes them, which is the same
 * fail-closed trade the read path already makes.
 */
export const bucketBindingPermitsWrite = (
  bucket: BucketBinding,
  recorded: string | null | undefined
): boolean => recorded === undefined || recorded === bucketColumnValue(bucket)

/**
 * PostgreSQL bytea storage adapter.
 *
 * Persists binary content to the platform-internal `system.file_storage_bytea`
 * table, with metadata in `system.file_storage_metadata`. Both tables are
 * created by Drizzle schema migrations (see
 * `src/infrastructure/database/drizzle/schema/storage.ts`) and follow the
 * `system.*` naming convention documented in
 * `[internal ref]`.
 *
 * This is the zero-dependency fallback when no S3 or local storage is configured.
 */

/**
 * Check connectivity when the bytea provider is selected (STORAGE_PROVIDER
 * unset, DATABASE_URL set); migrations create the tables later. A start's
 * check, its first read, uses the maintenance slot so the request pool is
 * built once, after the runtime-settings probe. Later checks (an account
 * erasure builds this layer per call) reuse the pool: a second connection
 * beside it could exceed `DATABASE_POOL_MAX`. Rejects when unreachable.
 */
export const byteaValidateAndInit = async (): Promise<void> => {
  const config = parseDatabaseDialectConfig()
  await (config.dialect === 'postgres' && !hasBuiltDbClient()
    ? pingThroughMaintenanceSlot(config.databaseUrl)
    : db.execute(sql`SELECT 1`))
}

/**
 * Upsert a file: write metadata row (or update on key conflict) and
 * upsert binary content keyed by the resulting metadata id.
 *
 * The target's `uploadedById` names the person behind the write, and is recorded
 * only when the key is new. An overwrite replaces the bytes but never the
 * uploader: re-recording it would hand the object to whoever wrote last, who
 * could then delete it under the owner rule, and an unattributed road would
 * strip it of the owner erasure finds it by.
 */
export const byteaUpload = async (
  key: string,
  content: Uint8Array,
  mimeType: string,
  target: UploadTarget
): Promise<void> => {
  const { bucket, uploadedById, generatedBy } = uploadTargetParts(target)
  const filename = key.split('/').at(-1) ?? key
  const buf = Buffer.from(content)

  const result = (await db.execute(sql`
    INSERT INTO system.file_storage_metadata
      (key, filename, mime_type, size, storage_provider, bucket, uploaded_by_id, generated_by)
    VALUES (${key}, ${filename}, ${mimeType}, ${content.length}, 'bytea', ${bucketColumnValue(bucket)}, ${uploadedById ?? null}, ${generatedBy ?? null})
    ON CONFLICT (key) DO UPDATE SET
      filename = EXCLUDED.filename,
      mime_type = EXCLUDED.mime_type,
      size = EXCLUDED.size,
      storage_provider = EXCLUDED.storage_provider
    WHERE file_storage_metadata.bucket IS NOT DISTINCT FROM EXCLUDED.bucket
    RETURNING id
  `)) as readonly Record<string, unknown>[]

  // `bucket` is no longer in the SET list, and the guarded `DO UPDATE` skips the
  // row entirely when the recorded owner disagrees — so a rebind writes nothing
  // and RETURNING is empty. `IS NOT DISTINCT FROM` rather than `=` so that a
  // NULL binding matches only another NULL. See {@link bucketBindingPermitsWrite}.
  //
  // The content upsert below is deliberately downstream of this: refusing here
  // means the stored bytes are never touched.
  const row = result[0] as { id: string } | undefined
  if (!row) {
    // Shaped as not-found so the route answers 404 and never distinguishes
    // "owned by another bucket" from "absent" (S1 anti-enumeration).
    throw storageObjectNotFound(key)
  }

  await db.execute(sql`
    INSERT INTO system.file_storage_bytea (metadata_id, content)
    VALUES (${row.id}, ${buf})
    ON CONFLICT (metadata_id) DO UPDATE SET content = EXCLUDED.content
  `)
}

export const byteaDownload = async (key: string, bucket: BucketBinding): Promise<Uint8Array> => {
  // An unattributed caller compares nothing; a bucket-scoped one must match the
  // recorded binding, and a NULL binding matches no bucket (fail closed).
  const bucketPredicate = bucket === UNATTRIBUTED_BUCKET ? sql`` : sql`AND m.bucket = ${bucket}`
  const result = (await db.execute(sql`
    SELECT b.content
    FROM system.file_storage_bytea b
    JOIN system.file_storage_metadata m ON m.id = b.metadata_id
    WHERE m.key = ${key} AND m.storage_provider = 'bytea' ${bucketPredicate}
    LIMIT 1
  `)) as readonly Record<string, unknown>[]

  const row = result[0] as { content: Uint8Array | Buffer } | undefined
  if (!row) {
    throw storageObjectNotFound(key)
  }
  return row.content instanceof Uint8Array
    ? row.content
    : new Uint8Array(row.content as ArrayBuffer)
}

/**
 * The stored payload's length in bytes, read without fetching it; `undefined`
 * when no bytea payload is stored under `key`. The payload cascades off its
 * catalog row, so on this provider the store and the catalog are one.
 */
export const byteaStoredSize = async (key: string): Promise<number | undefined> => {
  const result = (await db.execute(sql`
    SELECT octet_length(b.content) AS size
    FROM system.file_storage_bytea b
    JOIN system.file_storage_metadata m ON m.id = b.metadata_id
    WHERE m.key = ${key} AND m.storage_provider = 'bytea'
    LIMIT 1
  `)) as readonly Record<string, unknown>[]
  return payloadSizeOf(result)
}

/** The `size` a {@link byteaStoredSize} query returned; `undefined` when no payload row came back. */
export const payloadSizeOf = (rows: readonly Record<string, unknown>[]): number | undefined => {
  const size = rows[0]?.['size']
  return size === undefined || size === null ? undefined : Number(size)
}

/**
 * Delete by key. The bytea row is removed automatically via the
 * `metadata_id` FK ON DELETE CASCADE.
 * Throws "File not found: <key>" when no row matches, so the route handler
 * can return 404 via `isNotFoundError`.
 */
export const byteaDelete = async (key: string, bucket: BucketBinding): Promise<void> => {
  const bucketPredicate = bucket === UNATTRIBUTED_BUCKET ? sql`` : sql`AND bucket = ${bucket}`
  const result = (await db.execute(sql`
    DELETE FROM system.file_storage_metadata
    WHERE key = ${key} AND storage_provider = 'bytea' ${bucketPredicate}
    RETURNING key
  `)) as readonly Record<string, unknown>[]
  if (result.length === 0) {
    throw storageObjectNotFound(key)
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
  return toFiniteCount(row?.total)
}

/**
 * Upsert a metadata row in the file_storage_metadata catalog for non-bytea
 * providers (e.g. S3, local) that store binary content outside the database.
 * This lets every storage backend maintain a consistent, queryable metadata
 * catalog without duplicating the upsert logic across adapters.
 *
 * Uses the Drizzle query builder via the dialect-aware
 * {@link fileStorageMetadataTable} selector (rather than raw `db.execute` SQL)
 * so the upsert is portable across both dialects: PostgreSQL
 * (`system.file_storage_metadata`) AND SQLite (`system_file_storage_metadata`).
 * The local provider — the zero-config SQLite default — relies on this path, and
 * the bun:sqlite runtime has no `db.execute()`.
 */
export const writeFileMetadata = async (file: {
  readonly key: string
  readonly mimeType: string
  readonly size: number
  readonly storageProvider: string
  readonly bucket: BucketBinding
  /** The person behind the write, recorded only when the key is new. */
  readonly uploadedById?: string
  /** The automation behind the write, recorded only when the key is new. */
  readonly generatedBy?: string
}): Promise<void> => {
  const { key, mimeType, size, storageProvider, uploadedById, generatedBy } = file
  const filename = key.split('/').at(-1) ?? key
  // Strip MIME type parameters (e.g. "text/plain;charset=utf-8" → "text/plain")
  // so the stored value is always the canonical base type.
  const baseMimeType = (mimeType.split(';').at(0) ?? mimeType).trim()
  const files = fileStorageMetadataTable()
  const bucketValue = bucketColumnValue(file.bucket)
  // Only update a row whose recorded owner already equals the one this write
  // asserts. Composed from `isNull` / `eq` rather than PostgreSQL's
  // `IS NOT DISTINCT FROM` because this path must also run on SQLite, where that
  // operator does not exist — the two-branch form says the same thing on both.
  const ownerUnchanged = bucketValue === null ? isNull(files.bucket) : eq(files.bucket, bucketValue)
  const written = await db
    .insert(files)
    .values({
      key,
      filename,
      mimeType: baseMimeType,
      size,
      storageProvider,
      bucket: bucketValue,
      uploadedById: uploadedById ?? null,
      generatedBy: generatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: files.key,
      // `bucket` is absent from the SET list on purpose: a write REPLACES bytes,
      // it never MOVES an object between buckets. `uploadedById` and
      // `generatedBy` are absent too: an overwrite never changes who the
      // catalog records behind the object (see `byteaUpload`).
      set: { filename, mimeType: baseMimeType, size, storageProvider },
      setWhere: ownerUnchanged,
    })
    .returning({ key: files.key })
  if (written.length === 0) {
    // The conflicting row belongs to a different bucket, so the guarded update
    // matched nothing. Not-found shaped for the same anti-enumeration reason as
    // {@link byteaUpload}.
    throw storageObjectNotFound(key)
  }
}

/**
 * Delete the metadata row for any storage provider by key.
 * Returns `true` when the row was found and deleted, `false` when the key
 * does not exist in the file_storage_metadata catalog.
 *
 * Used by non-bytea providers (e.g. S3, local) to detect "file not found"
 * before issuing their own idempotent delete calls. Uses the dialect-aware
 * Drizzle query builder so it works on both PostgreSQL and SQLite (same
 * rationale as {@link writeFileMetadata}).
 */
export const deleteFileMetadata = async (key: string, bucket: BucketBinding): Promise<boolean> => {
  const files = fileStorageMetadataTable()
  // `eq(files.bucket, bucket)` is never true for a NULL binding, so an object
  // with no recorded owner is refused rather than deleted (fail closed).
  const predicate =
    bucket === UNATTRIBUTED_BUCKET
      ? eq(files.key, key)
      : and(eq(files.key, key), eq(files.bucket, bucket))
  const deleted = await db.delete(files).where(predicate).returning({ key: files.key })
  return deleted.length > 0
}

/**
 * Read the catalog row for `key` from the file_storage_metadata catalog. Every
 * provider (S3, local, bytea) keeps this table in sync via {@link writeFileMetadata}
 * / {@link byteaUpload}, so this is the provider-agnostic source for a file's
 * content type / size / last-modified timestamp. Returns `undefined` when no
 * file is stored under `key`.
 *
 * Uses the dialect-aware Drizzle query builder so the read is portable across
 * PostgreSQL and SQLite (the local provider — the zero-config SQLite default —
 * resolves `StorageService.getMetadata` through this path, and bun:sqlite has no
 * `db.execute()`). Same rationale as {@link writeFileMetadata}.
 */
export const readFileMetadata = async (
  key: string
): Promise<
  | {
      readonly contentType: string
      readonly size: number
      readonly lastModified: string
      readonly bucket: string | null
      readonly uploadedBy: string | null
      readonly generatedBy: string | null
    }
  | undefined
> => {
  const files = fileStorageMetadataTable()
  const rows = await db
    .select({
      mimeType: files.mimeType,
      size: files.size,
      modified: files.createdAt,
      bucket: files.bucket,
      uploadedBy: files.uploadedById,
      generatedBy: files.generatedBy,
    })
    .from(files)
    .where(eq(files.key, key))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  // `createdAt` is a `Date` via the SQLite `timestamp_ms` / PG `timestamptz`
  // column mapping; coerce defensively in case a raw string slips through.
  const modified =
    row.modified instanceof Date
      ? row.modified.toISOString()
      : new Date(row.modified as unknown as string).toISOString()
  return {
    contentType: row.mimeType,
    size: Number(row.size),
    lastModified: modified,
    bucket: row.bucket,
    uploadedBy: row.uploadedBy,
    generatedBy: row.generatedBy,
  }
}
