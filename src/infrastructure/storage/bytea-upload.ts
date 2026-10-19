/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import {
  storageObjectNotFound,
  uploadTargetParts,
} from '@/application/ports/services/storage-service'
import { db } from '@/infrastructure/database'
import { executeRaw, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import { bucketColumnValue, pinnedCreatedAtSql } from './bytea-adapter'
import type { UploadTarget } from '@/application/ports/services/storage-service'

/**
 * The database a replacing bytea write runs in: anything that opens a
 * transaction over a raw-SQL runner. The `db` facade in production; a test
 * hands {@link byteaUploadIn} a handle whose payload statement fails.
 */
export interface ByteaTransactor {
  readonly transaction: <T>(run: (tx: RawSqlRunner) => Promise<T>) => Promise<T>
}

/**
 * Upsert a file: write metadata row (or update on key conflict) and
 * upsert binary content keyed by the resulting metadata id, in ONE
 * transaction — a payload that cannot be written leaves the previous row and
 * bytes as they were, and no row at all for a key that was free.
 *
 * The target's `uploadedById` names the person behind the write, and is recorded
 * only when the key is new. An overwrite replaces the bytes but never the
 * uploader: re-recording it would hand the object to whoever wrote last, who
 * could then delete it under the owner rule, and an unattributed road would
 * strip it of the owner erasure finds it by.
 */
export const byteaUploadIn =
  (database: ByteaTransactor) =>
  async (
    key: string,
    content: Uint8Array,
    mimeType: string,
    target: UploadTarget
  ): Promise<void> => {
    const { bucket, uploadedById, generatedBy } = uploadTargetParts(target)
    const filename = key.split('/').at(-1) ?? key
    const buf = Buffer.from(content)
    const pinned = pinnedCreatedAtSql()

    await database.transaction(async (tx) => {
      const result = await executeRaw(
        tx,
        sql`
        INSERT INTO system.file_storage_metadata
          (key, filename, mime_type, size, storage_provider, bucket, uploaded_by_id, generated_by${pinned.column})
        VALUES (${key}, ${filename}, ${mimeType}, ${content.length}, 'bytea', ${bucketColumnValue(bucket)}, ${uploadedById ?? null}, ${generatedBy ?? null}${pinned.value})
        ON CONFLICT (key) DO UPDATE SET
          filename = EXCLUDED.filename,
          mime_type = EXCLUDED.mime_type,
          size = EXCLUDED.size,
          storage_provider = EXCLUDED.storage_provider
        WHERE file_storage_metadata.bucket IS NOT DISTINCT FROM EXCLUDED.bucket
        RETURNING id
      `
      )

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

      await executeRaw(
        tx,
        sql`
        INSERT INTO system.file_storage_bytea (metadata_id, content)
        VALUES (${row.id}, ${buf})
        ON CONFLICT (metadata_id) DO UPDATE SET
          content = EXCLUDED.content,
          write_count = file_storage_bytea.write_count + 1
      `
      )
    })
  }

/** {@link byteaUploadIn} on the `db` facade: the provider's replacing write. */
export const byteaUpload = byteaUploadIn(db)
