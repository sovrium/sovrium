/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Removal of the stored objects a purged record owned: find the keys, name
 * their buckets, keep the ones another record still references, delete the
 * rest and drop their derived variants. The first step of a purge, run by
 * `record-delete-orchestration.ts` before the row itself is removed.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { StorageService } from '@/application/ports/services/storage-service'
import { parseJsonObjectCell } from '@/domain/kernel/sql/sqlite-json-cell'
import { parseBucketFileUrl } from '@/domain/kernel/url/bucket-file-url'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { resolveFieldBucket } from '@/domain/models/app/buckets/field-bucket'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { logError } from '@/infrastructure/logging/logger'
import { rawGetRecordProgram } from './read-record-programs'
import type { UserSession } from '@/application/ports/contracts/user-session'
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
 * Metadata objects store the key inside the url: "/api/buckets/<bucket>/files/<key>"
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
    // Only a bucket download URL names a stored object. The last path segment
    // of an ARBITRARY url is not a key: reading it as one let a record whose
    // attachment was `{ url: 'https://x/<key>' }` — a shape the reference
    // confinement rightly ignores, since it names no stored file — delete that
    // key out of the column's bucket when the record was purged.
    if (typeof obj['url'] === 'string') return parseBucketFileUrl(obj['url'])?.key
  }
  return undefined
}

/** The bucket key of a stored signature's image (`{ image, … }`, TEXT on SQLite). */
function signatureImageKey(value: unknown): string | undefined {
  const parsed = parseJsonObjectCell(value) ?? value
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const { image } = parsed as { readonly image?: unknown }
  return typeof image === 'string' && image.length > 0 ? image : undefined
}

/**
 * Collect storage keys from single-attachment and signature fields in a raw DB record,
 * each paired with the bucket its column declares (falling back to the
 * built-in `system`, the same resolution the read path uses for the URL).
 * Handles both plain string keys and storeMetadata objects (url-embedded key).
 */
export function collectAttachmentKeys(
  record: Readonly<Record<string, unknown>>,
  app: App,
  tableName: string
): readonly AttachmentRef[] {
  const table = app.tables?.find((t) => t.name === tableName)
  if (!table?.fields) return []
  return table.fields
    .filter((f) => f.type === 'single-attachment' || f.type === 'signature')
    .map((f) => ({
      key:
        f.type === 'signature'
          ? signatureImageKey(record[f.name])
          : extractAttachmentKey(record[f.name]),
      bucket: resolveFieldBucket(app, tableName, f.name) ?? SYSTEM_BUCKET_NAME,
    }))
    .filter((ref): ref is AttachmentRef => ref.key !== undefined)
}

/** The record a purge addresses, as its caller reads it. */
export interface PurgeScope {
  readonly session: Readonly<UserSession>
  readonly app: App
  readonly tableName: string
  readonly recordId: string
}

/**
 * Whether a file key is still named by any record OTHER than the one being
 * purged: in any attachment field of ANY table, a single cell or a list, a
 * bare key or a metadata object, trashed records included — the question
 * {@link TableRepository.isFileNamedByAnyRecord} answers for a replaced file
 * too. A generated file attached to one record is often reused by another (a
 * badge that becomes a sponsor's logo, a picture added to a gallery), so
 * looking only at the purged table's single-attachment columns deleted a file
 * another record still served.
 *
 * Fails closed: a lookup that could not answer keeps the file. A file left
 * behind is recoverable; a file deleted from under a record is not.
 */
export const isFileKeyReferencedElsewhere = (
  scope: PurgeScope,
  fileKey: string
): Effect.Effect<boolean, never, TableRepository> => {
  const { app, tableName, recordId } = scope
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.isFileNamedByAnyRecord(app, fileKey, { tableName, recordId })
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[tables] could not check who else references a purged file', cause, { tableName })
      )
    ),
    // effect-swallow: an unanswered reference check keeps the file — the purge
    // goes on without deleting it, and the failure is logged above.
    Effect.orElseSucceed(() => true),
    Effect.withSpan('tables.is-file-key-referenced-elsewhere')
  )
}

/**
 * Delete files from storage, ignoring errors so a missing file does not block
 * the record purge. Each key's derived variants are forgotten after the delete
 * — whether or not it succeeded — so a later `GET .../files/<key>` returns 404
 * instead of serving stale cached transformed bytes.
 */
const deleteStoredObjects = (
  refs: readonly AttachmentRef[],
  forgetDerivedVariants: (key: string) => void
) =>
  Effect.forEach(
    refs,
    ({ key, bucket }) =>
      Effect.gen(function* () {
        const storage = yield* StorageService
        yield* storage['delete'](key, bucket)
      }).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[tables] could not delete a purged attachment', cause, { key, bucket })
          )
        ),
        // effect-swallow: a file already gone must not block the purge of the record that named it
        Effect.ignoreCause,
        Effect.andThen(Effect.sync(() => forgetDerivedVariants(key)))
      ),
    { discard: true }
  )

/**
 * Remove the stored files a record names before the record itself is purged,
 * keeping every file another record — of any table, trashed ones included —
 * still names.
 * Total: a row that cannot be read leaves its files in place, logged.
 */
export function purgeStoredAttachments(
  scope: PurgeScope & { readonly forgetDerivedVariants: (key: string) => void }
) {
  const { session, app, tableName, recordId } = scope
  return Effect.gen(function* () {
    const row = yield* rawGetRecordProgram(session, tableName, recordId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError('[tables] could not read the record a purge removes files for', cause, {
            tableName,
          })
        )
      ),
      // effect-swallow: an unreadable row keeps its files, as it always has;
      // the permanent delete that follows reports its own failure.
      Effect.orElseSucceed(() => null)
    )
    if (!row) return
    // Bounded: one reference check runs one pooled query at a time (one per
    // attachment column of the app, stopping at the first that names the
    // key), and a record carries as many keys as its table has attachment
    // fields —.
    const unshared = yield* Effect.filter(
      collectAttachmentKeys(row, app, tableName),
      (ref) =>
        Effect.map(isFileKeyReferencedElsewhere(scope, ref.key), (referenced) => !referenced),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
    yield* deleteStoredObjects(unshared, scope.forgetDerivedVariants)
  }).pipe(Effect.withSpan('tables.purge-stored-attachments', { attributes: { tableName } }))
}
