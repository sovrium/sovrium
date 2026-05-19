/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class UserAccessDatabaseError extends Data.TaggedError('UserAccessDatabaseError')<{
  readonly cause: unknown
}> {}

export interface UserAccessRow {
  readonly id: string
  readonly userId: string
  readonly tableSlug: string
  readonly recordIds: readonly string[]
  readonly role: string
  readonly createdAt: Readonly<Date>
  readonly createdBy: string | undefined
}

export interface UserAccessInsertInput {
  readonly userId: string
  readonly tableSlug: string
  readonly recordIds: readonly string[]
  readonly role: string
}

export class UserAccessRepository extends Context.Tag('UserAccessRepository')<
  UserAccessRepository,
  {
    readonly insert: (
      input: Readonly<UserAccessInsertInput>,
      createdBy: string
    ) => Effect.Effect<UserAccessRow, UserAccessDatabaseError>

    readonly list: (
      filter: Readonly<{ userId?: string }>
    ) => Effect.Effect<readonly UserAccessRow[], UserAccessDatabaseError>
  }
>() {}
