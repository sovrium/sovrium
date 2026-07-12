/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'


export class AccountDatabaseError extends Data.TaggedError('AccountDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AccountUserRow {
  readonly id: string
  readonly email: string
  readonly name: string | null
  readonly image: string | null
  readonly emailVerified: boolean
  readonly role: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface AccountSessionRow {
  readonly id: string
  readonly userId: string
  readonly expiresAt: Date
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface AccountLinkedRow {
  readonly id: string
  readonly userId: string
  readonly providerId: string
  readonly accountId: string
  readonly scope: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class AccountRepository extends Context.Tag('AccountRepository')<
  AccountRepository,
  {
    readonly loadProfile: (
      userId: string
    ) => Effect.Effect<AccountUserRow | undefined, AccountDatabaseError>

    readonly loadSessions: (
      userId: string
    ) => Effect.Effect<readonly AccountSessionRow[], AccountDatabaseError>

    readonly loadAccounts: (
      userId: string
    ) => Effect.Effect<readonly AccountLinkedRow[], AccountDatabaseError>

    readonly loadScheduledErasure: (
      userId: string
    ) => Effect.Effect<Date | undefined, AccountDatabaseError>

    readonly tablesWithCreatedBy: (
      tableNames: readonly string[]
    ) => Effect.Effect<readonly string[], AccountDatabaseError>

    readonly readAuthoredRecords: (
      tableName: string,
      userId: string
    ) => Effect.Effect<readonly Record<string, unknown>[], AccountDatabaseError>

    readonly cancelErasure: (userId: string) => Effect.Effect<void, AccountDatabaseError>

    readonly scheduleErasure: (
      userId: string,
      scheduledAt: Date
    ) => Effect.Effect<void, AccountDatabaseError>
  }
>() {}
