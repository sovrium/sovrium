/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isStagingName } from '@/domain/kernel/identity/storage-key'
import { SqliteToPostgresCopyError, type Sql } from './sqlite-to-postgres-copy-statements'

/**
 * Load a SQLite backup's uploads into the PostgreSQL database's file table,
 * inside the copy's transaction, when the restored server keeps its files in
 * the database (PostgreSQL with no `STORAGE_PROVIDER`, or the database one).
 *
 * ### Which record a file belongs to
 *
 * Local storage keeps an object at `<storage folder>/<key>`, and only there:
 * `resolveStoragePath` (`storage/local-adapter.ts`) refuses any key whose path
 * relative to the folder is not the key itself. The archive's
 * `storage/<path>` entries are that folder, so an entry's path below
 * `storage/` IS its record's `key`. The record's `storage_path` plays no part:
 * no writer sets it.
 *
 * ### What the record says afterwards
 *
 * Exactly what a database-storage upload writes (`storage/bytea-upload.ts`):
 * `storage_provider = 'bytea'`, no `storage_path`, and the bytes in
 * `system.file_storage_bytea` keyed by the record's id.
 *
 * Every file needs a record and every locally stored record needs its file;
 * either gap stops the copy, naming the file, so no upload is served as
 * missing after a restore that reported success. A leftover from an
 * interrupted write (a staging file) is not an object and is skipped.
 */

const FILE_TABLE = 'system.file_storage_metadata'

interface FileRecord {
  readonly id: string
  readonly key: string
  readonly provider: string
}

/** Load `uploads` (storage key → bytes) beside their file records; resolves with how many. */
export const loadUploadsIntoDatabase = async (
  tx: Sql,
  uploads: ReadonlyMap<string, Uint8Array>
): Promise<number> => {
  const records = (await tx.unsafe(
    `SELECT id::text AS id, key, storage_provider AS provider FROM system.file_storage_metadata`
  )) as readonly FileRecord[]
  const byKey = new Map(records.map((record) => [record.key, record]))
  const files = [...uploads].filter(([key]) => !isStagingName(key.slice(key.lastIndexOf('/') + 1)))
  const orphan = files.find(([key]) => !byKey.has(key))
  if (orphan !== undefined) {
    throw new SqliteToPostgresCopyError(
      FILE_TABLE,
      `the uploaded file storage/${orphan[0]} has no file record in the backup`
    )
  }
  const archived = new Set(files.map(([key]) => key))
  const missing = records.find((record) => record.provider === 'local' && !archived.has(record.key))
  if (missing !== undefined) {
    throw new SqliteToPostgresCopyError(
      FILE_TABLE,
      `the file record for ${missing.key} has no file in the backup's storage/ folder`
    )
  }
  for (const [key, content] of files) {
    const record = byKey.get(key)
    if (record === undefined) continue
    await tx.unsafe(
      `INSERT INTO system.file_storage_bytea (metadata_id, content, write_count)
       VALUES ($1::text, $2::bytea, 1)`,
      [record.id, content]
    )
    await tx.unsafe(
      `UPDATE system.file_storage_metadata
          SET storage_provider = 'bytea', storage_path = NULL
        WHERE id = $1::text`,
      [record.id]
    )
  }
  return files.length
}
