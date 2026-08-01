/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Layer } from 'effect'
import {
  AccountRepository,
  type AccountDatabaseError,
  type AccountFormSubmissionRow,
  type AccountLinkedRow,
  type AccountSessionRow,
  type AccountUserRow,
} from '@/application/ports/repositories/auth/account-repository'
import {
  accountDeleteCancelledResponseSchema,
  accountDeleteScheduledResponseSchema,
  accountExportResponseSchema,
  accountPendingErasureResponseSchema,
} from '@/domain/models/api/account/account'
import { AccountRepositoryLive } from '@/infrastructure/database/repositories/auth/account-repository-live'

export const GRACE_PERIOD_DAYS = 7


interface AuthoredRecord {
  readonly tableSlug: string
  readonly recordId: string
  readonly fields: Record<string, unknown>
  readonly createdAt: string
  readonly updatedAt: string
}

function shapeAuthoredRecord(
  tableName: string,
  row: Readonly<Record<string, unknown>>
): AuthoredRecord {
  const recordId = row['id']
  const createdAt = row['created_at']
  const updatedAt = row['updated_at']
  const fields = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => key !== 'id' && key !== 'created_at' && key !== 'updated_at'
    )
  )
  return {
    tableSlug: tableName,
    recordId: String(recordId),
    fields,
    createdAt: new Date(String(createdAt)).toISOString(),
    updatedAt: new Date(String(updatedAt ?? createdAt)).toISOString(),
  }
}

interface ExportedFormSubmission {
  readonly submissionId: string
  readonly formName: string | null
  readonly status: string | null
  readonly data: Record<string, unknown>
  readonly userAgent: string | null
  readonly submittedAt: string
}

function shapeFormSubmission(row: Readonly<AccountFormSubmissionRow>): ExportedFormSubmission {
  return {
    submissionId: row.id,
    formName: row.formName,
    status: row.status,
    data: (row.data ?? {}) as Record<string, unknown>,
    userAgent: row.userAgent,
    submittedAt: new Date(row.submittedAt).toISOString(),
  }
}

function normalizeRole(role: string | null): 'admin' | 'member' | 'viewer' {
  return role === 'admin' || role === 'viewer' ? role : 'member'
}

interface ExportSources {
  readonly user: AccountUserRow
  readonly sessionRows: readonly AccountSessionRow[]
  readonly accountRows: readonly AccountLinkedRow[]
  readonly authoredRecords: readonly AuthoredRecord[]
  readonly formSubmissions: readonly ExportedFormSubmission[]
}

function buildExportPayload(sources: Readonly<ExportSources>) {
  const { user, sessionRows, accountRows, authoredRecords, formSubmissions } = sources
  return {
    exportedAt: new Date().toISOString(),
    format: 'json' as const,
    schemaVersion: '1.0' as const,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: Boolean(user.emailVerified),
      role: normalizeRole(user.role),
      createdAt: new Date(user.createdAt).toISOString(),
      updatedAt: new Date(user.updatedAt).toISOString(),
    },
    sessions: sessionRows.map((s) => ({
      id: s.id,
      userId: s.userId,
      expiresAt: new Date(s.expiresAt).toISOString(),
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: new Date(s.createdAt).toISOString(),
      updatedAt: new Date(s.updatedAt).toISOString(),
    })),
    accounts: accountRows.map((a) => ({
      id: a.id,
      userId: a.userId,
      providerId: a.providerId,
      accountId: a.accountId,
      scope: a.scope,
      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
    })),
    authoredRecords,
    formSubmissions,
  }
}


export type ExportAccountOutcome =
  | { readonly _tag: 'Ok'; readonly body: ReturnType<typeof accountExportResponseSchema.parse> }
  | { readonly _tag: 'Unauthorized' }

export const ExportAccount = (
  userId: string,
  tableNames: readonly string[]
): Effect.Effect<ExportAccountOutcome, AccountDatabaseError, AccountRepository> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository

    const user = yield* repo.loadProfile(userId)
    if (user === undefined) {
      return { _tag: 'Unauthorized' } as const
    }

    const [sessionRows, accountRows, submissionRows] = yield* Effect.all([
      repo.loadSessions(userId),
      repo.loadAccounts(userId),
      repo.loadFormSubmissions(userId),
    ])

    const recordTables = yield* repo.tablesWithCreatedBy(tableNames)
    const perTable = yield* Effect.all(
      recordTables.map((tableName) =>
        repo
          .readAuthoredRecords(tableName, userId)
          .pipe(Effect.map((rows) => rows.map((row) => shapeAuthoredRecord(tableName, row))))
      ),
      { concurrency: 'unbounded' }
    )
    const authoredRecords = perTable.flat()

    const body = accountExportResponseSchema.parse(
      buildExportPayload({
        user,
        sessionRows,
        accountRows,
        authoredRecords,
        formSubmissions: submissionRows.map(shapeFormSubmission),
      })
    )
    return { _tag: 'Ok', body } as const
  })


export interface ScheduleAccountDeletionResult {
  readonly body: ReturnType<typeof accountDeleteScheduledResponseSchema.parse>
  readonly scheduledErasureAt: Date
}

export const ScheduleAccountDeletion = (
  userId: string
): Effect.Effect<ScheduleAccountDeletionResult, AccountDatabaseError, AccountRepository> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository

    const scheduledErasureAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    yield* repo.scheduleErasure(userId, scheduledErasureAt)

    const body = accountDeleteScheduledResponseSchema.parse({
      status: 'scheduled',
      scheduledErasureAt: scheduledErasureAt.toISOString(),
      gracePeriodDays: GRACE_PERIOD_DAYS,
      cancellable: true,
    })
    return { body, scheduledErasureAt }
  })

export const CancelAccountDeletion = (
  userId: string
): Effect.Effect<
  ReturnType<typeof accountDeleteCancelledResponseSchema.parse>,
  AccountDatabaseError,
  AccountRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository
    yield* repo.cancelErasure(userId)
    return accountDeleteCancelledResponseSchema.parse({ status: 'cancelled' })
  })


export const LoadPendingErasure = (
  userId: string
): Effect.Effect<
  ReturnType<typeof accountPendingErasureResponseSchema.parse>,
  AccountDatabaseError,
  AccountRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AccountRepository
    const scheduledAt = yield* repo.loadScheduledErasure(userId)
    if (scheduledAt === undefined) {
      return accountPendingErasureResponseSchema.parse({ items: [] })
    }
    const user = yield* repo.loadProfile(userId)
    if (user === undefined) {
      return accountPendingErasureResponseSchema.parse({ items: [] })
    }
    const requestedAt = new Date(scheduledAt.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    return accountPendingErasureResponseSchema.parse({
      items: [
        {
          id: userId,
          email: user.email,
          scheduledErasureAt: scheduledAt.toISOString(),
          requestedAt: requestedAt.toISOString(),
          gracePeriodDays: GRACE_PERIOD_DAYS,
        },
      ],
    })
  })

export const AccountLayer = Layer.mergeAll(AccountRepositoryLive)
