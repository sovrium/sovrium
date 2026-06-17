/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { resolveStoragePublicAccess } from '@/domain/models/env/storage/storage-public-access'

class StoragePublicAccessEnvError extends Data.TaggedError('StoragePublicAccessEnvError')<{
  readonly cause: unknown
}> {}

export const validateStoragePublicAccessEnv = (): Effect.Effect<
  void,
  StoragePublicAccessEnvError
> =>
  Effect.try({
    try: () => resolveStoragePublicAccess(),
    catch: (cause) => new StoragePublicAccessEnvError({ cause }),
  }).pipe(Effect.asVoid)
