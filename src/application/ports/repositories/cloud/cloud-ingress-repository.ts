/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class CloudIngressDatabaseError extends Data.TaggedError('CloudIngressDatabaseError')<{
  readonly cause: unknown
}> {}

export class CloudIngressRepository extends Context.Tag('CloudIngressRepository')<
  CloudIngressRepository,
  {
    readonly attachRoute: (
      domain: string,
      port: number
    ) => Effect.Effect<void, CloudIngressDatabaseError>

    readonly verifyCustomDomain: (domain: string) => Effect.Effect<void, CloudIngressDatabaseError>

    readonly issueTls: (domain: string) => Effect.Effect<void, CloudIngressDatabaseError>
  }
>() {}
