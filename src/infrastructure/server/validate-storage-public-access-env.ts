/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { resolveStoragePublicAccess } from '@/domain/models/process-env/storage/storage-public-access'

/**
 * Raised when `STORAGE_PUBLIC_PATHS` / `STORAGE_DEFAULT_ACCESS` is malformed.
 *
 * `message` is carried EXPLICITLY alongside `cause` — it is the field
 * `formatRuntimeError` prints as prose, so the parser's descriptive text
 * ("Invalid STORAGE_DEFAULT_ACCESS: expected …") is what the operator's
 * terminal shows. Same contract as `EcoEnvError`.
 *
 * Exported for one reason only: `validateOperatorEnv` names this tag in its
 * declared error channel, and a `.d.ts` cannot reference a name its declaring
 * module keeps to itself. No caller catches it by tag — an operator reads it.
 */
export class StoragePublicAccessEnvError extends Data.TaggedError('StoragePublicAccessEnvError')<{
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Fail-fast on a malformed `STORAGE_PUBLIC_PATHS` (a glob wildcard) or
 * `STORAGE_DEFAULT_ACCESS` (a value other than `public` / `private`).
 *
 * An operator misconfiguring the public-access toggle must be caught at
 * startup, not on the first download request.
 * `resolveStoragePublicAccess` throws a descriptive `Error` naming the
 * offending env var; `StoragePublicAccessEnvError` wraps it in `cause` and
 * surfaces it through the Effect failure channel so `createServer` rejects the
 * server boot. As a `Data.TaggedError` it is still an `Error` subtype, so
 * `createServer`'s existing `Error` union accommodates it without widening any
 * caller signature.
 */
export const validateStoragePublicAccessEnv: Effect.Effect<void, StoragePublicAccessEnvError> =
  Effect.try({
    try: () => resolveStoragePublicAccess(),
    catch: (cause) =>
      new StoragePublicAccessEnvError({
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  }).pipe(Effect.asVoid)
