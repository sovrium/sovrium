/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TEMP_STORAGE_PREFIX } from '@/domain/models/app/automations/actions/file/shared'
import { parseStorageTempCleanupAfter } from '@/domain/models/env/storage/storage-temp-cleanup-after'
import type { StorageService } from '@/application/ports/services/storage-service'


type StoragePort = Effect.Effect.Success<typeof StorageService>

const TEMP_LIST_PREFIX = TEMP_STORAGE_PREFIX.replace(/\/$/, '')

export interface SweepTempStorageOptions {
  readonly preserve?: string
  readonly env?: Readonly<Record<string, string | undefined>>
}

const reclaimIfAged = (
  storage: StoragePort,
  key: string,
  cutoff: number
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const metadata = yield* Effect.either(storage.getMetadata(key))
    if (metadata._tag === 'Left') return
    const lastModified = Date.parse(metadata.right.lastModified)
    if (!Number.isFinite(lastModified) || lastModified > cutoff) return
    yield* Effect.ignore(storage.delete(key))
  })

export const sweepAgedTempFiles = (
  storage: StoragePort,
  options?: SweepTempStorageOptions
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const ttlMs = parseStorageTempCleanupAfter(options?.env ?? process.env)
    if (ttlMs <= 0) return

    const listed = yield* Effect.either(storage.list(TEMP_LIST_PREFIX))
    if (listed._tag === 'Left') return

    const cutoff = Date.now() - ttlMs
    const candidates = listed.right.filter(
      (key) => key.startsWith(TEMP_STORAGE_PREFIX) && key !== options?.preserve
    )
    yield* Effect.forEach(candidates, (key) => reclaimIfAged(storage, key, cutoff), {
      discard: true,
    })
  })
