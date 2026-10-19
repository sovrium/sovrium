/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { uploadTargetParts } from '@/application/ports/services/storage-service'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { bucketColumnValue, pinnedCreatedAtSql } from './bytea-adapter'
import type { UploadTarget } from '@/application/ports/services/storage-service'

/**
 * `byteaUpload` that replaces nothing: the catalog row is inserted with
 * `ON CONFLICT DO NOTHING`, and its payload only when the row was new. `taken`
 * when a row is already recorded at `key`, whoever's: its row and its bytes are
 * left as they were. The row and its payload are one transaction: a payload
 * that cannot be written leaves no row behind, so the key is not left held by
 * a file with no bytes.
 */
export const byteaUploadCreateOnly = async (
  key: string,
  content: Uint8Array,
  mimeType: string,
  target: UploadTarget
): Promise<'written' | 'taken'> => {
  const { bucket, uploadedById, generatedBy } = uploadTargetParts(target)
  const filename = key.split('/').at(-1) ?? key
  const pinned = pinnedCreatedAtSql()
  return db.transaction(async (tx) => {
    const inserted = await executeRaw(
      tx,
      sql`
        INSERT INTO system.file_storage_metadata
          (key, filename, mime_type, size, storage_provider, bucket, uploaded_by_id, generated_by${pinned.column})
        VALUES (${key}, ${filename}, ${mimeType}, ${content.length}, 'bytea', ${bucketColumnValue(bucket)}, ${uploadedById ?? null}, ${generatedBy ?? null}${pinned.value})
        ON CONFLICT (key) DO NOTHING
        RETURNING id
      `
    )
    const row = inserted[0] as { id: string } | undefined
    if (row === undefined) return 'taken' as const
    await executeRaw(
      tx,
      sql`
        INSERT INTO system.file_storage_bytea (metadata_id, content)
        VALUES (${row.id}, ${Buffer.from(content)})
      `
    )
    return 'written' as const
  })
}
