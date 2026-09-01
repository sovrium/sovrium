/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Removal of the stored objects a deleted record owned.
 *
 * Extracted from `record-delete-handlers.ts`: attachment cleanup is a cohesive
 * concern (find the keys, name their buckets, delete the objects, drop their
 * cached transforms) and keeping it inline pushed that route file past its
 * line budget once every delete had to carry a bucket.
 */

import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services/storage-service'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { DEFAULT_BUCKET_NAME } from '@/domain/utils/bucket-identity'
import { parseJsonObjectCell } from '@/domain/utils/database/sqlite-json-cell'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { evictTransformCacheForKey } from '@/infrastructure/storage/transform-cache'
import type { App } from '@/domain/models/app'

/**
 * A stored object to remove, paired with the bucket that owns it: storage keys
 * are flat, so a delete must name the bucket the object was written under or
 * the storage layer refuses it.
 */
export interface AttachmentRef {
  readonly key: string
  readonly bucket: string
}

/**
 * Extract the storage key from an attachment field value.
 * Handles both plain string keys and metadata objects (when storeMetadata: true).
 * Metadata objects store the key inside the url: "/api/buckets/default/files/<key>"
 *
 * The value arrives from a RAW database row, so the metadata object is only an
 * object on PostgreSQL. `storeMetadata: true` promotes the column to JSONB and
 * SQLite has no JSONB, so on the zero-config DEFAULT engine the same cell reads
 * back as the TEXT `'{"filename":…,"url":…}'`. Without the parse below, the bare-
 * string arm fired on the serialized document itself and handed the entire JSON
 * blob to `storage.delete()` as if it were a key: the delete matched nothing, and
 * purging a record left its file in the bucket forever. Postgres was unaffected,
 * so the leak was invisible on the engine the tests default to.
 */
function extractAttachmentKey(value: unknown): string | undefined {
  const parsed = parseJsonObjectCell(value) ?? value
  if (typeof parsed === 'string' && parsed.length > 0) return parsed
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>
    if (typeof obj['url'] === 'string') {
      const key = obj['url'].split('/').at(-1)
      if (key && key.length > 0) return key
    }
  }
  return undefined
}

/**
 * Collect storage keys from single-attachment fields in a raw DB record,
 * each paired with the bucket its column declares (falling back to the
 * implicit `default`, the same resolution the read path uses for the URL).
 * Handles both plain string keys and storeMetadata objects (url-embedded key).
 */
export function collectAttachmentKeys(
  record: Record<string, unknown>,
  app: App,
  tableName: string
): readonly AttachmentRef[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return []
  return table.fields
    .filter((f) => f.type === 'single-attachment')
    .map((f) => ({
      key: extractAttachmentKey(record[f.name]),
      bucket: resolveFieldBucket(app, tableName, f.name) ?? DEFAULT_BUCKET_NAME,
    }))
    .filter((ref): ref is AttachmentRef => ref.key !== undefined)
}

/**
 * Delete files from storage, ignoring errors so a missing file does not block
 * the record purge. Each key's cached image transforms are evicted after the
 * delete so a later `GET .../files/<key>` (with or without transform params)
 * returns 404 instead of serving stale cached transformed bytes.
 */
export async function deleteStorageFiles(refs: readonly AttachmentRef[]): Promise<void> {
  return Promise.all(
    refs.map(({ key, bucket }) => {
      const program = Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key, bucket)
      })
      return Effect.runPromise(Effect.result(Effect.provide(program, StorageServiceLive))).then(
        () => evictTransformCacheForKey(key)
      )
    })
  ).then(() => undefined)
}
