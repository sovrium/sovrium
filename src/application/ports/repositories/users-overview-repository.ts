/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export interface UserOverviewRow {
  readonly role: string | null
  readonly createdAt: Date | string | number
}

export interface SessionOverviewRow {
  readonly createdAt: Date | string | number
}

export class UsersOverviewDatabaseError extends Data.TaggedError('UsersOverviewDatabaseError')<{
  readonly cause: unknown
}> {}

export class UsersOverviewRepository extends Context.Tag('UsersOverviewRepository')<
  UsersOverviewRepository,
  {
    readonly listUserRows: () => Effect.Effect<
      readonly UserOverviewRow[],
      UsersOverviewDatabaseError
    >

    readonly countActiveUsersSince: (
      since: Date
    ) => Effect.Effect<number, UsersOverviewDatabaseError>

    readonly listSessionRowsSince: (
      since: Date
    ) => Effect.Effect<readonly SessionOverviewRow[], UsersOverviewDatabaseError>
  }
>() {}
