/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { StorageError } from '@/application/ports/services/storage-service'

/** Any failure a storage driver raises, as the port's one error. */
export const toStorageError = (cause: unknown): StorageError => new StorageError({ cause })

/**
 * One call into a storage driver: a thunk of a Promise (the local disk and the
 * database drivers), or an Effect whose error channel holds the driver's own
 * failure (the S3 adapter, which runs in the caller's fiber so the request's
 * span and interruption reach it).
 */
export type DriverCall<A> = (() => Promise<A>) | Effect.Effect<A, unknown>

const isDriverEffect = <A>(run: DriverCall<A>): run is Effect.Effect<A, unknown> =>
  Effect.isEffect(run)

/** A driver call that may fail, with the failure as a `StorageError` carrying it. */
export const attemptStorage = <A>(run: DriverCall<A>): Effect.Effect<A, StorageError> =>
  isDriverEffect(run)
    ? Effect.mapError(run, toStorageError)
    : Effect.tryPromise({ try: run, catch: toStorageError })
