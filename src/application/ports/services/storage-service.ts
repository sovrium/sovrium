/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class StorageError extends Data.TaggedError('StorageError')<{
  readonly cause: unknown
}> {}

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
    readonly getSignedUploadUrl: (
      key: string,
      expiresIn: number,
      contentType?: string
    ) => Effect.Effect<string, StorageError>
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
    readonly getTotalBytes: () => Effect.Effect<number, StorageError>
  }
>() {}
