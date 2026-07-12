/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { fileStorageMetadataTable } from '@/infrastructure/database/drizzle/dialect-schema'


export const byteaValidateAndInit = async (): Promise<void> => {
  await db.execute(sql`SELECT 1`)
}

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

export const byteaGetTotalBytes = async (): Promise<number> => {
  const result = (await db.execute(sql`
    SELECT COALESCE(SUM(size), 0) AS total
    FROM system.file_storage_metadata
    WHERE storage_provider = 'bytea'
  `)) as readonly Record<string, unknown>[]
  const row = result[0] as { total: string | number } | undefined
  return Number(row?.total ?? 0)
}

export const writeFileMetadata = async (
  key: string,
  mimeType: string,
  size: number,
  storageProvider: string
): Promise<void> => {
  const filename = key.split('/').at(-1) ?? key
  const baseMimeType = (mimeType.split(';').at(0) ?? mimeType).trim()
  const files = fileStorageMetadataTable()
  await db
    .insert(files)
    .values({ key, filename, mimeType: baseMimeType, size, storageProvider })
    .onConflictDoUpdate({
      target: files.key,
      set: { filename, mimeType: baseMimeType, size, storageProvider },
    })
}

export const deleteFileMetadata = async (key: string): Promise<boolean> => {
  const files = fileStorageMetadataTable()
  const deleted = await db.delete(files).where(eq(files.key, key)).returning({ key: files.key })
  return deleted.length > 0
}

export const readFileMetadata = async (
  key: string
): Promise<
  { readonly contentType: string; readonly size: number; readonly lastModified: string } | undefined
> => {
  const files = fileStorageMetadataTable()
  const rows = await db
    .select({ mimeType: files.mimeType, size: files.size, modified: files.createdAt })
    .from(files)
    .where(eq(files.key, key))
    .limit(1)
  const row = rows[0]
  if (!row) return undefined
  const modified =
    row.modified instanceof Date
      ? row.modified.toISOString()
      : new Date(row.modified as unknown as string).toISOString()
  return { contentType: row.mimeType, size: Number(row.size), lastModified: modified }
}

export const byteaExists = async (key: string): Promise<boolean> => {
  const result = (await db.execute(sql`
    SELECT 1 FROM system.file_storage_metadata
    WHERE key = ${key} AND storage_provider = 'bytea'
    LIMIT 1
  `)) as readonly Record<string, unknown>[]
  return result.length > 0
}
