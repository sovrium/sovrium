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
 * Whether a file key is still referenced by any record OTHER than the one
 * being purged. Includes soft-deleted records so a key shared between a live
 * record and a deleted record is preserved. A failed lookup answers `false`.
 *
 * ONE query, whatever the table's width: the fields are folded into a single
 * `or` filter. One unbounded, unprojected `listRecords` PER attachment field
 * would make a purge cost |keys| x |fields| reads against a ten-connection
 * pool — 419 queries for a 14-field record, the shape behind a production 504.
 *
 * `limit: 2` and not `limit: 1`: the purged record is itself a match, so one
 * row cannot distinguish "only this record references the key" from "another
 * record does too". Two rows can — at most one of them is the excluded id, so
 * a second row is by definition a different record. `columns: ['id']` because
 * the id is the whole question; the rest of the row was never read.
 */
const isFileKeyReferencedElsewhere = (
  scope: PurgeScope,
  fileKey: string,
  attachmentFieldNames: readonly string[]
): Effect.Effect<boolean, never, TableRepository> => {
  if (attachmentFieldNames.length === 0) return Effect.succeed(false)
  const { session, tableName, recordId } = scope
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const rows = yield* repo.listRecords({
      session,
      tableName,
      // `QueryFilter` exposes only a top-level `and`, whose entries may
      // themselves be `or` groups — so "this key in ANY attachment field" is
      // an `and` wrapping one `or`, not a bare `or`.
      filter: {
        and: [
          {
            or: attachmentFieldNames.map((fieldName) => ({
              field: fieldName,
              operator: 'eq',
              value: fileKey,
            })),
          },
        ],
      },
      includeDeleted: true,
      columns: ['id'],
      limit: 2,
    })
    return rows.some((r) => String(r['id']) !== String(recordId))
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[tables] could not check who else references a purged file', cause, { tableName })
      )
    ),
    // effect-swallow: an unanswered reference check reads as "not referenced",
    // as it always has; the purge goes on and the failure is logged above.
    Effect.orElseSucceed(() => false)
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
 * keeping every file another record — trashed ones included — still names.
 * Total: a row that cannot be read leaves its files in place, logged.
 */
export function purgeStoredAttachments(
  scope: PurgeScope & { readonly forgetDerivedVariants: (key: string) => void }
) {
  const { session, app, tableName, recordId } = scope
  const attachmentFieldNames =
    app.tables
      ?.find((t) => t.name === tableName)
      ?.fields?.filter((f) => f.type === 'single-attachment')
      .map((f) => f.name) ?? []
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
    // Bounded: one reference check is one pooled query, and a record carries
    // as many as the table has attachment fields — see
    // [internal ref].
    const unshared = yield* Effect.filter(
      collectAttachmentKeys(row, app, tableName),
      (ref) =>
        Effect.map(
          isFileKeyReferencedElsewhere(scope, ref.key, attachmentFieldNames),
          (referenced) => !referenced
        ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
    yield* deleteStoredObjects(unshared, scope.forgetDerivedVariants)
  }).pipe(Effect.withSpan('tables.purge-stored-attachments', { attributes: { tableName } }))
}
