/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Layer } from 'effect'
import {
  UsersDirectoryRepository,
  UsersDirectoryDatabaseError,
} from '@/application/ports/repositories/tables/users-directory-repository'
import { db } from '@/infrastructure/database'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((error) => new UsersDirectoryDatabaseError({ cause: error }))

export const UsersDirectoryRepositoryLive = Layer.succeed(UsersDirectoryRepository, {
  listAllUsers: () =>
    wrap(async () => {
      const usersTable = authUsersTable()
      return (await db
        .select({
          id: usersTable.id,
          email: usersTable.email,
          role: usersTable.role,
          banned: usersTable.banned,
        })
        .from(usersTable)) as ReadonlyArray<{
        id: string
        email: string
        role: string | null
        banned: boolean | null
      }>
    }),
})
