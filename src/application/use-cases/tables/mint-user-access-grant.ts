/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Option } from 'effect'
import {
  UserAccessRepository,
  type UserAccessChange,
  type UserAccessDatabaseError,
  type UserAccessInsertInput,
  type UserAccessMinted,
  type UserAccessRow,
} from '@/application/ports/repositories/auth/user-access-repository'
import type { App } from '@/domain/models/app'

/** A grant refused because a value it names does not exist, naming the field to fix. */
export interface GrantValueRefusal {
  readonly field: 'user_id' | 'record_ids'
  readonly message: string
}

/**
 * The refusal of record ids that name no record of `tableSlug`, or `undefined`
 * when every id names one. A table the app does not declare holds no record,
 * so every id it is given is refused.
 */
export const grantRecordsRefusal = (
  app: App,
  tableSlug: string,
  recordIds: readonly string[]
): Effect.Effect<GrantValueRefusal | undefined, UserAccessDatabaseError, UserAccessRepository> =>
  Effect.gen(function* () {
    const table = app.tables?.find((candidate) => candidate.name === tableSlug)
    const found =
      table === undefined
        ? []
        : yield* (yield* UserAccessRepository).findRecordIds(
            { tableName: table.name, primaryKey: table.primaryKey?.field || 'id' },
            recordIds
          )
    const missing = [...new Set(recordIds)].filter((id) => !found.includes(id))
    if (missing.length === 0) return undefined
    return {
      field: 'record_ids' as const,
      message: `record_ids names ${missing.map((id) => `'${id}'`).join(', ')}, which ${
        missing.length === 1 ? 'is no record' : 'are no records'
      } of '${tableSlug}'`,
    }
  }).pipe(Effect.withSpan('tables.grant-records-refusal'))

/**
 * Mint a grant from the access-grant routes: the account and every record it
 * names must exist, and nothing is stored when one does not. A grant the
 * account already holds over the table under that role is joined rather than
 * duplicated (see {@link UserAccessRepository} `mintGrant`).
 */
export const mintUserAccessGrant = (
  app: App,
  input: Readonly<UserAccessInsertInput>,
  createdBy: string
): Effect.Effect<
  GrantValueRefusal | UserAccessMinted,
  UserAccessDatabaseError,
  UserAccessRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserAccessRepository
    const accounts = yield* repo.findAccounts([input.userId])
    if (accounts.length === 0) {
      return {
        field: 'user_id' as const,
        message: `user_id '${input.userId}' names no account`,
      }
    }
    const refused = yield* grantRecordsRefusal(app, input.tableSlug, input.recordIds)
    if (refused !== undefined) return refused
    return yield* repo.mintGrant(input, createdBy)
  }).pipe(Effect.withSpan('tables.mint-user-access-grant'))

/**
 * Change one grant from the access-grant routes: the records it would name are
 * checked as a new grant's are, and a refused change changes nothing. A role
 * change onto a role the account already holds over the table folds the grant
 * into the held one, which is the answer (see {@link UserAccessRepository}
 * `update`). None when no grant has the id.
 */
export const changeUserAccessGrant = (
  app: App,
  id: string,
  change: Readonly<UserAccessChange>
): Effect.Effect<
  GrantValueRefusal | Option.Option<UserAccessRow>,
  UserAccessDatabaseError,
  UserAccessRepository
> =>
  Effect.gen(function* () {
    const repo = yield* UserAccessRepository
    if (change.recordIds !== undefined) {
      const held = yield* repo.get(id)
      if (Option.isNone(held)) return Option.none()
      const refusal = yield* grantRecordsRefusal(app, held.value.tableSlug, change.recordIds)
      if (refusal !== undefined) return refusal
    }
    return yield* repo.update(id, change)
  }).pipe(Effect.withSpan('tables.change-user-access-grant'))
