/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class CloudSupervisorDatabaseError extends Data.TaggedError('CloudSupervisorDatabaseError')<{
  readonly cause: unknown
}> {}

export class CloudSupervisorRepository extends Context.Tag('CloudSupervisorRepository')<
  CloudSupervisorRepository,
  {
    readonly register: (
      appSlug: string,
      sovriumVersion: string
    ) => Effect.Effect<void, CloudSupervisorDatabaseError>

    readonly stop: (appSlug: string) => Effect.Effect<void, CloudSupervisorDatabaseError>

    readonly remove: (appSlug: string) => Effect.Effect<void, CloudSupervisorDatabaseError>

    readonly recordEnv: (
      appSlug: string,
      envKeys: readonly string[]
    ) => Effect.Effect<void, CloudSupervisorDatabaseError>

    readonly injectEnv: (appSlug: string) => Effect.Effect<void, CloudSupervisorDatabaseError>
  }
>() {}
