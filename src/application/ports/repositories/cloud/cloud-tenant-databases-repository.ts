/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class CloudTenantDatabasesDatabaseError extends Data.TaggedError(
  'CloudTenantDatabasesDatabaseError'
)<{
  readonly cause: unknown
}> {}

export class CloudTenantDatabasesRepository extends Context.Tag('CloudTenantDatabasesRepository')<
  CloudTenantDatabasesRepository,
  {
    readonly provision: (dbName: string) => Effect.Effect<void, CloudTenantDatabasesDatabaseError>

    readonly drop: (dbName: string) => Effect.Effect<void, CloudTenantDatabasesDatabaseError>
  }
>() {}
