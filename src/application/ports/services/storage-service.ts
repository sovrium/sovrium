/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect, Option } from 'effect'

/**
 * Error for storage operations.
 *
 * `cause` is the failure it wraps, kept as the OBJECT the driver or the file
 * system raised, never as its text: the code on it is what tells a failure the
 * operator fixes (an unreachable database) from an engine defect. A wrapper that
 * has something to add for a human says it in `message`.
 */
export class StorageError extends Data.TaggedError('StorageError')<{
  readonly cause: unknown
  readonly message?: string
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
 * A bounded read found more bytes at the key than the caller's cap: the read
 * stopped at the cap, and nothing past it was held in memory. Carried as a
 * `StorageError` `cause`; the message names the caller's key and the cap.
 */
export class StorageObjectTooLarge extends Data.TaggedError('StorageObjectTooLarge')<{
  readonly key: string
  readonly maxBytes: number
  readonly message: string
}> {}

/** The over-the-cap verdict for `key`, with its canonical message. */
export const storageObjectTooLarge = (
  key: string,
  maxBytes: number
): Readonly<StorageObjectTooLarge> =>
  new StorageObjectTooLarge({
    key,
    maxBytes,
    message: `The file at ${key} is larger than ${String(maxBytes)} bytes`,
  })

/**
 * The most bytes one read of a stored file holds when nothing smaller bounds
 * it (100 MiB, the default upload cap): a file past it is refused, never read.
 */
export const FILE_SOURCE_MAX_BYTES = 104_857_600

/** Whether a storage failure is a bounded read that found more bytes than its cap. */
export const isStorageObjectTooLarge = (error: Readonly<StorageError>): boolean =>
  error.cause instanceof StorageObjectTooLarge

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

/**
 * A create-only write found something already stored at its key: an object in
 * the store, catalogued or not, or a catalog row. It replaced nothing. Carried
 * as a `StorageError` `cause`; the message names the caller's key only.
 */
export class StorageKeyTaken extends Data.TaggedError('StorageKeyTaken')<{
  readonly key: string
  readonly message: string
}> {}

/** The create-only refusal for `key`, with its canonical message. */
export const storageKeyTaken = (key: string): Readonly<StorageKeyTaken> =>
  new StorageKeyTaken({ key, message: `A file is already stored at ${key}` })

/** Whether a storage failure is a create-only write refused because its key holds something. */
export const isStorageKeyTaken = (error: Readonly<StorageError>): boolean =>
  error.cause instanceof StorageKeyTaken

/**
 * Whether a failed `create-only` write found its key held: taken, or held by
 * another bucket's object, which every write is answered as not-found.
 */
export const isCreateOnlyRefusal = (error: Readonly<StorageError>): boolean =>
  isStorageKeyTaken(error) || isStorageObjectNotFound(error)

/**
 * How `upload` treats a key that already holds something: `replace` (the
 * default) writes over it; `create-only` writes only when nothing is stored at
 * it, failing with {@link StorageKeyTaken} and leaving what is there unchanged.
 */
export type UploadMode = 'replace' | 'create-only'

/** One page of a listing: its keys in key order, and the key the next page starts after. */
export interface StorageListPage {
  readonly keys: readonly string[]
  /** `undefined` on the last page. */
  readonly after: string | undefined
}

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

/** What {@link StorageService} `objectIdentity` answers. */
export type StoredObjectIdentity =
  | { readonly kind: 'identity'; readonly value: string }
  | { readonly kind: 'absent' }
  | { readonly kind: 'none' }

/** What {@link StorageService} `hashObject` answers: the object's length and SHA-256 (hex). */
export interface StoredObjectHash {
  readonly size: number
  readonly sha256: string
}

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
  /** How the write treats a key that already holds something; `replace` when absent. */
  readonly mode?: UploadMode
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
 * Provides file storage operations (upload, bounded download, signed URLs).
 * Implementation lives in infrastructure layer (e.g., S3, local filesystem).
 *
 * `upload`, `downloadBounded`, `delete` and `getMetadata` each carry a
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
    /**
     * Store `content` at `key`. A target in `create-only` mode
     * ({@link UploadMode}) asks the object store not to replace anything (S3
     * `If-None-Match: *`, an exclusive create on local storage, an insert that
     * does not replace on the database provider), and its catalog row is
     * inserted, never upserted. A store that may ignore the condition is
     * checked again just before the bytes are sent.
     */
    readonly upload: (
      key: string,
      content: Uint8Array,
      mimeType: string,
      target: UploadTarget
    ) => Effect.Effect<void, StorageError>
    /**
     * The bytes stored under `key`, read up to `maxBytes`: the object is read
     * piece by piece and the read stops at the first byte past the cap, failing
     * with a {@link StorageObjectTooLarge} cause, so an object larger than the
     * cap is never held in memory whole. It is the only read of an object's
     * bytes the port offers: every read names the most it will hold, even one
     * whose size the catalog already records, because the store can grow past
     * the recorded size behind the catalog's back.
     */
    readonly downloadBounded: (
      key: string,
      bucket: BucketBinding,
      maxBytes: number
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
     * The object store's own identity of the object at `key`, read with one
     * metadata call and no download: a text that changes whenever the bytes
     * there may have changed, including by a write that did not go through
     * Sovrium. `absent` when nothing is stored there; `none` when this store,
     * or this mount, cannot give such an identity (the caller then hashes the
     * bytes). Fails when the store cannot answer. Every store answers it, so
     * "this store gives no identity" is the store's own `none`, never a
     * missing member a caller has to guess at.
     */
    readonly objectIdentity: (key: string) => Effect.Effect<StoredObjectIdentity, StorageError>
    /**
     * The length and SHA-256 of the object stored under `key`, computed while
     * the object is read as a stream (or by the database itself), so memory
     * stays constant whatever its size. Like {@link statObject} it takes no
     * bucket and needs no catalog row. Fails when nothing is stored there or
     * the store cannot be read.
     */
    readonly hashObject: (key: string) => Effect.Effect<StoredObjectHash, StorageError>
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
    /**
     * One page of the keys under `prefix`, in key order, starting after `after`
     * (`undefined`: the first page), at most `size` keys. A caller that stops
     * early reads only the pages it needs; {@link list} reads them all.
     */
    readonly listPage: (input: {
      readonly prefix: string
      readonly after: string | undefined
      readonly size: number
    }) => Effect.Effect<StorageListPage, StorageError>
    /**
     * The bucket the catalog records for each of `keys` that has a row, in one
     * read: a key with a row maps to its bucket (`undefined`: in none), a key
     * with no row is absent from the map.
     */
    readonly catalogBuckets: (
      keys: readonly string[]
    ) => Effect.Effect<ReadonlyMap<string, string | undefined>, StorageError>
    /** Total bytes used across all keys for the active provider — used for quota enforcement. */
    readonly getTotalBytes: Effect.Effect<number, StorageError>
  }
>()('StorageService') {}
