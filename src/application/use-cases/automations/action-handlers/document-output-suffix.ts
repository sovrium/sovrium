/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { GeneratedFileWriteError } from './document-output-error'
import { storeHoldsKey } from './starter-overwrite-gate'

/**
 * `ifExists: suffix` — the first numbered name after a taken key that nothing
 * holds, in every run. A numbered name is taken when the catalog records a
 * file there, or when the store holds anything there — an object the catalog
 * does not record, or another spelling of a stored key — as the overwrite gate
 * judges a key.
 */

/** `name-<n>.ext` for the n-th suffixed copy of a key. */
export const suffixedKey = (key: string, n: number): string => {
  const slash = key.lastIndexOf('/')
  const dot = key.lastIndexOf('.')
  return dot > slash + 1 ? `${key.slice(0, dot)}-${n}${key.slice(dot)}` : `${key}-${n}`
}

/** The highest number `suffix` tries before it refuses. */
const SUFFIX_LIMIT = 1000

/** Whether anything, catalogued or not, is stored at `key`. */
const isTaken = (key: string): Effect.Effect<boolean, never, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const row = yield* Effect.result(storage.getMetadata(key, UNATTRIBUTED_BUCKET))
    return row._tag === 'Success' || (yield* storeHoldsKey(key))
  })

/** The first free `name-<n>.ext` after `key`, or a refusal once `name-1000.ext` is taken. */
export const firstFreeSuffix = (
  key: string,
  n = 1
): Effect.Effect<string, GeneratedFileWriteError, StorageService> =>
  Effect.flatMap(isTaken(suffixedKey(key, n)), (taken) => {
    if (!taken) return Effect.succeed(suffixedKey(key, n))
    return n >= SUFFIX_LIMIT
      ? Effect.fail(
          new GeneratedFileWriteError({
            message: `every name from "${suffixedKey(key, 1)}" to "${suffixedKey(key, SUFFIX_LIMIT)}" is taken (ifExists: suffix stops at ${SUFFIX_LIMIT})`,
          })
        )
      : firstFreeSuffix(key, n + 1)
  }).pipe(Effect.withSpan('automations.first-free-suffix'))
