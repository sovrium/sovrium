/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect, Option } from 'effect'

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
 * A key the store would resolve onto an object another stored key already
 * names: the same text after Unicode normalisation, or after letter case too on
 * a store that folds it. Keys are compared, never rewritten, so the write is
 * refused rather than redirected. Carried as a `StorageError` `cause`; the
 * message names the caller's key only, never the stored spelling.
 */
export class StorageKeySpellingTaken extends Data.TaggedError('StorageKeySpellingTaken')<{
  readonly key: string
  readonly message: string
}> {}

/** The second-spelling refusal for `key`, with its canonical message. */
export const storageKeySpellingTaken = (key: string): Readonly<StorageKeySpellingTaken> =>
  new StorageKeySpellingTaken({
    key,
    message: `A file is already stored under another spelling of ${key}`,
  })

/** A stored object another spelling of a key would land on, as the catalog records it. */
export interface StoredSpelling {
  readonly key: string
  /** The bucket the object is bound to, absent when it belongs to none. */
  readonly bucket?: string
  /** Who uploaded it, absent when nobody is recorded. */
  readonly uploadedBy?: string
}

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
 * NULL, and an unattributed read performs no comparison. One HTTP path reaches
 * it, and only with the operator's say-so: a download link a `file.signUrl`
 * step minted, whose token binds the `automation` scope (`signed-download.ts`)
 * — it reads exactly the key the operator's step named, as that step's own
 * `file` actions could. Every other route resolves and passes a real bucket
 * name, and no sign route can mint that scope.
 *
 * A symbol, not a string, so it can never collide with a configured bucket.
 */
export const UNATTRIBUTED_BUCKET: unique symbol = Symbol.for('sovrium/storage/unattributed-bucket')

/** The bucket an operation is attributed to, or an explicit opt-out. */
export type BucketBinding = string | typeof UNATTRIBUTED_BUCKET

/** A write naming its bucket AND the signed-in person — or the automation — behind it. */
export interface AttributedUpload {
  readonly bucket: BucketBinding
  readonly uploadedById: string | undefined
  /**
   * The automation that generated the object (its name), recorded when the
   * key is new: what lets a document output overwrite only its own files.
   */
  readonly generatedBy?: string
}

/**
 * Where an upload lands: a bare {@link BucketBinding} for a road with nobody
 * behind it (an anonymous form, an automation, `sovrium seed`), or an
 * {@link AttributedUpload} naming the uploader too.
 */
export type UploadTarget = BucketBinding | AttributedUpload

/** The bucket and the uploader an {@link UploadTarget} names. */
export const uploadTargetParts = (target: UploadTarget): AttributedUpload =>
  typeof target === 'object' ? target : { bucket: target, uploadedById: undefined }

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
 *
 * `upload` also records WHO wrote the object (`uploadedById`, the catalog's
 * `uploaded_by_id`) whenever a signed-in person is behind the write: that is
 * what erasure removes a person's objects by, and what decides who may delete
 * or replace an object in a bucket that declares no `delete` / `upload`. A
 * road with nobody behind it (an anonymous form, an automation, `sovrium
 * seed`) passes none, and a re-upload that names nobody keeps the uploader the
 * catalog already records.
 */
export class StorageService extends Context.Service<
  StorageService,
  {
    readonly upload: (
      key: string,
      content: Uint8Array,
      mimeType: string,
      target: UploadTarget
    ) => Effect.Effect<void, StorageError>
    readonly download: (
      key: string,
      bucket: BucketBinding
    ) => Effect.Effect<Uint8Array, StorageError>
    readonly delete: (key: string, bucket: BucketBinding) => Effect.Effect<void, StorageError>
    /**
     * Remove the stored BYTES of an object whose catalog row has already been
     * deleted — erasure deletes the rows inside its transaction and calls this
     * after the commit, so a rolled-back erasure never destroys a file.
     * Idempotent: an absent object is not a failure. A no-op for the bytea
     * provider, whose payload cascades with the row.
     */
    readonly deleteUncataloguedBytes: (key: string) => Effect.Effect<void, StorageError>
    readonly getSignedUrl: (key: string, expiresIn: number) => Effect.Effect<string, StorageError>
    /**
     * File metadata from the storage catalog (`system.file_storage_metadata`),
     * which every provider keeps in sync. Fails with `StorageError` when no
     * file is stored under `key`. `bucket` is the binding the catalog records
     * for the object, absent when it belongs to none — what a copy carries to
     * its destination so the object stays reachable where it was. `uploadedBy`
     * is the id of the person who uploaded it, absent when nobody is recorded;
     * `generatedBy` the automation that generated it, absent when none did.
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
        readonly bucket?: string
        readonly uploadedBy?: string
        readonly generatedBy?: string
      },
      StorageError
    >
    /**
     * The size of the object stored under `key`, answered by the OBJECT STORE
     * itself — an S3 `HEAD`, a `stat` on local storage, the payload length on
     * bytea — and never by the catalog. It requires no catalog row, so it sizes
     * an object another app wrote into a shared store, which is why it takes no
     * bucket: it is the unattributed size lookup, and a caller naming a bucket
     * reads {@link getMetadata} instead, where the binding is checked. Fails
     * with the not-found marker when nothing is stored under `key`, and with a
     * `StorageError` naming `key` when the store reports no usable size.
     */
    readonly statObject: (key: string) => Effect.Effect<{ readonly size: number }, StorageError>
    /**
     * The stored object, other than `key` itself and in any bucket, that a
     * write at `key` would land on: a key equal to it after Unicode NFC
     * normalisation on every provider, and after letter case too where the
     * store folds it (a local directory on a case-insensitive disk, measured
     * when the provider starts). `None` when there is none. Every
     * provider's `upload` already refuses such a write; this read lets a caller
     * judge the refusal (who may replace the stored object) before it writes.
     */
    readonly findOtherSpelling: (
      key: string
    ) => Effect.Effect<Option.Option<StoredSpelling>, StorageError>
    readonly list: (prefix: string) => Effect.Effect<readonly string[], StorageError>
    /** Total bytes used across all keys for the active provider — used for quota enforcement. */
    readonly getTotalBytes: Effect.Effect<number, StorageError>
  }
>()('StorageService') {}
