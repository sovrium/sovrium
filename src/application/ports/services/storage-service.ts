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
 * Storage Service Port
 *
 * Provides file storage operations (upload, download, signed URLs).
 * Implementation lives in infrastructure layer (e.g., S3, local filesystem).
 */
export class StorageService extends Context.Tag('StorageService')<
  StorageService,
  {
    readonly upload: (
      key: string,
      content: Uint8Array,
      mimeType: string
    ) => Effect.Effect<void, StorageError>
    readonly download: (key: string) => Effect.Effect<Uint8Array, StorageError>
    readonly delete: (key: string) => Effect.Effect<void, StorageError>
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
    readonly getMetadata: (key: string) => Effect.Effect<
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
    readonly getTotalBytes: () => Effect.Effect<number, StorageError>
  }
>() {}
