/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Effect, Option } from 'effect'
import {
  isStorageObjectNotFound,
  type StorageError,
} from '@/application/ports/services/storage-service'
import { logError } from '@/infrastructure/logging/logger'

/** Whether a failed storage call is the "no such object" verdict rather than an outage. */
export const isStorageMiss = (cause: Cause.Cause<StorageError>): boolean => {
  const error = Cause.findErrorOption(cause)
  return Option.isSome(error) && isStorageObjectNotFound(error.value)
}

/**
 * Log a failed storage call with its cause, before the caller answers it with
 * a fallback. A missing object is the ordinary answer to a lookup and is not
 * logged; every other failure — an unreachable store, a refused binding — is,
 * so the fallback never hides an outage.
 */
export const logStorageFailure =
  (message: string, attributes?: Readonly<Record<string, string>>) =>
  <A, R>(effect: Effect.Effect<A, StorageError, R>): Effect.Effect<A, StorageError, R> =>
    effect.pipe(
      Effect.tapCause((cause) =>
        isStorageMiss(cause) ? Effect.void : Effect.sync(() => logError(message, cause, attributes))
      )
    )

/**
 * `read`'s value, or `undefined` when it fails. A missing object answers
 * `undefined` silently, as it always has; any other failure is logged with its
 * cause first — naming `reader`, the caller — then answered the same way.
 */
export const storageReadOrUndefined = <A, R>(
  read: Effect.Effect<A, StorageError, R>,
  key: string,
  reader: string
): Effect.Effect<A | undefined, never, R> =>
  read.pipe(
    Effect.tapCause((cause) =>
      isStorageMiss(cause)
        ? Effect.void
        : Effect.sync(() =>
            logError(
              `[storage] ${reader} could not read the stored object; answering as missing`,
              cause,
              {
                'sovrium.storage.key': key,
              }
            )
          )
    ),
    // effect-swallow: every caller answers an unread object as a missing one (its documented fallback); a failure other than a miss was logged just above.
    Effect.orElseSucceed((): A | undefined => undefined),
    Effect.withSpan('storage.read-or-undefined', {
      attributes: { 'sovrium.storage.reader': reader },
    })
  )
