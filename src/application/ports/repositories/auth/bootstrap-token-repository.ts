/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { BootstrapToken, BootstrapTokenError } from '@/domain/models/system'

export class BootstrapTokenDatabaseError extends Data.TaggedError('BootstrapTokenDatabaseError')<{
  readonly cause: unknown
}> {}

export class BootstrapTokenRepository extends Context.Tag('BootstrapTokenRepository')<
  BootstrapTokenRepository,
  {
    readonly create: (input: {
      readonly tokenHash: string
      readonly expiresAt: Date
    }) => Effect.Effect<BootstrapToken, BootstrapTokenDatabaseError>
    readonly claim: (
      tokenHash: string
    ) => Effect.Effect<BootstrapToken, BootstrapTokenDatabaseError | BootstrapTokenError>
    readonly expireAll: () => Effect.Effect<void, BootstrapTokenDatabaseError>
    readonly purgeAll: () => Effect.Effect<void, BootstrapTokenDatabaseError>
  }
>() {}
