/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import type { UserSession } from '@/application/ports/models/user-session'
import type { SessionContextError } from '@/domain/errors'

export function rawListRecordsProgram(
  session: Readonly<UserSession>,
  tableName: string,
  filter: Parameters<TableRepository['Type']['listRecords']>[0]['filter'],
  includeDeleted?: boolean
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.listRecords({ session, tableName, filter, includeDeleted })
  })
}
