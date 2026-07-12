/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export interface DirectoryUserRow {
  readonly id: string
  readonly email: string
  readonly role: string | null
  readonly banned: boolean | null
}

export class UsersDirectoryDatabaseError extends Data.TaggedError('UsersDirectoryDatabaseError')<{
  readonly cause: unknown
}> {}

export class UsersDirectoryRepository extends Context.Tag('UsersDirectoryRepository')<
  UsersDirectoryRepository,
  {
    readonly listAllUsers: () => Effect.Effect<
      readonly DirectoryUserRow[],
      UsersDirectoryDatabaseError
    >
  }
>() {}
