/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Error for storage operations
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly cause: unknown
}> {}

/**
 * The storage catalog has no object answering this key under the named bucket —
 * absent, bound to another bucket, or bound to none. Adapters shape all three
 * alike so a bucket-scoped caller can never tell them apart (S1
 * anti-enumeration), and carry it as a `StorageError` `cause`.
 *
 * A typed marker rather than message text: a caller that must separate "no such
 * object" (a verdict about the key) from "the catalog could not be read" (an
 * outage) branches on {@link isStorageObjectNotFound}, never on wording. The
 * message keeps the legacy `File not found: <key>` text because
 * `isNotFoundError` (the HTTP 404 mapping) still reads messages from every
 * adapter, the S3 SDK's included.
 */
export class StorageObjectNotFound extends Data.TaggedError('StorageObjectNotFound')<{
  readonly key: string
  readonly message: string
}> {}

/** The not-found marker for `key`, with its canonical message. */
export const storageObjectNotFound = (key: string): Readonly<StorageObjectNotFound> =>
  new StorageObjectNotFound({ key, message: `File not found: ${key}` })

/** Whether a storage failure is the catalog's "no such object" verdict (never an outage). */
export const isStorageObjectNotFound = (error: Readonly<StorageError>): boolean =>
  error.cause instanceof StorageObjectNotFound

/**
 * A caller that declines to attribute the operation to any bucket.
 *
 * Storage keys are FLAT — every declared bucket addresses one physical
 * keyspace — so a bucket-scoped read or delete must be checked against the
 * binding recorded in the storage catalog. `UNATTRIBUTED_BUCKET` is the
 * explicit opt-out for the callers that have no bucket to name:
 *
 * - the automation `file:*` actions, whose schema has no bucket concept at all
 *   and which address literal operator-authored keys, and
 * - the temp-storage sweep, an internal janitor that walks keys by prefix.
 *
 * It is deliberately NOT `'default'`. Stamping automation output with a
 * nameable bucket would re-expose those objects through that bucket's route,
 * which is the very hole this binding closes. An unattributed write records
 * NULL, and an unattributed read performs no comparison — safe because no
 * HTTP path can reach it: every route resolves and passes a real bucket name.
 *
 * A symbol, not a string, so it can never collide with a configured bucket.
 */
export const UNATTRIBUTED_BUCKET: unique symbol = Symbol.for('sovrium/storage/unattributed-bucket')

/** The bucket an operation is attributed to, or an explicit opt-out. */
export type BucketBinding = string | typeof UNATTRIBUTED_BUCKET

/**
 * Storage Service Port
 *
 * Provides file storage operations (upload, download, signed URLs).
 * Implementation lives in infrastructure layer (e.g., S3, local filesystem).
 *
 * `upload`, `download`, `delete` and `getMetadata` each carry a
 * {@link BucketBinding}: keys are flat, so the bucket is what decides whether
 * a caller naming bucket A may reach an object that belongs to bucket B.
 * `list` and `getTotalBytes` stay deliberately global — they back quota
 * accounting and operator dashboards, which measure the whole instance.
 */
export class StorageService extends Context.Service<
  StorageService,
  {
    readonly upload: (
      key: string,
      content: Uint8Array,
      mimeType: string,
      bucket: BucketBinding
    ) => Effect.Effect<void, StorageError>
    readonly download: (
      key: string,
      bucket: BucketBinding
    ) => Effect.Effect<Uint8Array, StorageError>
    readonly delete: (key: string, bucket: BucketBinding) => Effect.Effect<void, StorageError>
    readonly getSignedUrl: (key: string, expiresIn: number) => Effect.Effect<string, StorageError>
    /**
     * Presigned URL for an upload (HTTP PUT) to `key`. Backends that cannot
     * issue presigned URLs (local filesystem, bytea) fail with `StorageError`,
     * mirroring `getSignedUrl`.
     */
    readonly getSignedUploadUrl: (
      key: string,
      expiresIn: number,
      contentType?: string
    ) => Effect.Effect<string, StorageError>
    /**
     * File metadata from the storage catalog (`system.file_storage_metadata`),
     * which every provider keeps in sync. Fails with `StorageError` when no
     * file is stored under `key`.
     */
    readonly getMetadata: (
      key: string,
      bucket: BucketBinding
    ) => Effect.Effect<
      {
        readonly key: string
        readonly contentType: string
        readonly size: number
        readonly lastModified: string
      },
      StorageError
    >
    readonly list: (prefix: string) => Effect.Effect<readonly string[], StorageError>
    /** Total bytes used across all keys for the active provider — used for quota enforcement. */
    readonly getTotalBytes: Effect.Effect<number, StorageError>
  }
>()('StorageService') {}
