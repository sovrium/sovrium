/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  UsersDirectoryRepository,
  type UsersDirectoryDatabaseError,
  type DirectoryUserRow,
} from '@/application/ports/repositories/tables/users-directory-repository'
import {
  adminUsersDirectoryResponseSchema,
  type AdminUsersDirectoryResponse,
} from '@/domain/models/api/admin/users'
import { UsersDirectoryRepositoryLive } from '@/infrastructure/database/repositories/tables/users-directory-repository-live'

const DEFAULT_DIRECTORY_ROLE = 'member'

const projectRow = (
  row: DirectoryUserRow
): Readonly<AdminUsersDirectoryResponse['users'][number]> => ({
  id: row.id,
  email: row.email,
  role: typeof row.role === 'string' && row.role.length > 0 ? row.role : DEFAULT_DIRECTORY_ROLE,
  banned: row.banned === true,
})

export type UsersDirectoryOutcome =
  | { readonly _tag: 'Ok'; readonly body: AdminUsersDirectoryResponse }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

export const BuildUsersDirectory = (): Effect.Effect<
  UsersDirectoryOutcome,
  UsersDirectoryDatabaseError,
  UsersDirectoryRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UsersDirectoryRepository

    const rows = yield* repo.listAllUsers()
    const body = { users: rows.map(projectRow) } satisfies AdminUsersDirectoryResponse

    const parsed = adminUsersDirectoryResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  })

export const UsersDirectoryLayer = Layer.mergeAll(UsersDirectoryRepositoryLive)
