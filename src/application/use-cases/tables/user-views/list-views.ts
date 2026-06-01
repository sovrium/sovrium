/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  UserViewRepository,
  type UserViewDbError,
  type UserViewResponse,
} from '@/application/ports/repositories/user-view-repository'

export interface ListUserViewsInput {
  readonly userId: string
  readonly tableName: string
}

export const listUserViews = (
  input: ListUserViewsInput
): Effect.Effect<readonly UserViewResponse[], UserViewDbError, UserViewRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserViewRepository
    return yield* repo.list(input)
  })
