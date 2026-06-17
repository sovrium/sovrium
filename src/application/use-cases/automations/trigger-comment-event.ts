/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  collectAssignmentScopeTables,
  loadCurrentUserContext,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { createdByFieldNames } from '@/domain/services/authorship-fields'
import { evaluateRecordAgainstPredicate } from '@/domain/validators/row-level-evaluator'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { UserSession } from '@/application/ports/models/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables/table'

export interface TriggerCommentEventInput {
  readonly app: App
  readonly tableName: string
  readonly tableId: string
  readonly recordId: string
  readonly session: Readonly<UserSession>
  readonly userRole: string
  readonly comment: {
    readonly id: string
    readonly body: string
    readonly parentCommentId: string | null
    readonly createdAt: Date
    readonly status: 'pending' | 'approved' | 'rejected'
  }
  readonly author: {
    readonly id: string
    readonly email: string
    readonly name: string
  }
  readonly mentions: readonly string[]
  readonly processEnv: Readonly<Record<string, string | undefined>>
}

const matchesCommentTrigger = (
  automation: NonNullable<App['automations']>[number],
  tableName: string,
  mentions: readonly string[],
  status: 'pending' | 'approved' | 'rejected'
): boolean => {
  if (automation.enabled === false) return false
  const { trigger } = automation
  if (trigger.type !== 'comment') return false
  if (trigger.table !== tableName) return false
  if (trigger.filter?.mentionsOnly === true && mentions.length === 0) return false
  if (trigger.when === 'approved' && status !== 'approved') return false
  return true
}

const readOwnerId = (
  record: Readonly<Record<string, unknown>>,
  createdByNames: readonly string[]
): string | undefined => {
  const candidates = [...createdByNames, 'created_by', 'createdBy']
  const owner = candidates
    .map((name) => record[name])
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  return owner
}

const resolveOwnerFallbackEmails = (
  session: Readonly<UserSession>,
  record: Readonly<Record<string, unknown>>,
  newAuthorId: string,
  createdByNames: readonly string[]
): Effect.Effect<readonly string[], never, CommentRepository> =>
  Effect.gen(function* () {
    const comments = yield* CommentRepository
    const ownerId = readOwnerId(record, createdByNames)
    if (ownerId === undefined) return [] as readonly string[]
    if (ownerId === newAuthorId) return [] as readonly string[]
    const emailResult = yield* Effect.either(
      comments.getUserEmailById({ session, userId: ownerId })
    )
    if (emailResult._tag === 'Left' || !emailResult.right) return [] as readonly string[]
    return [emailResult.right]
  })

const resolveThreadParticipants = (params: {
  readonly session: Readonly<UserSession>
  readonly record: Readonly<Record<string, unknown>>
  readonly recordId: string
  readonly newAuthorId: string
  readonly createdByNames: readonly string[]
}): Effect.Effect<readonly string[], never, CommentRepository> =>
  Effect.gen(function* () {
    const { session, record, recordId, newAuthorId, createdByNames } = params
    const comments = yield* CommentRepository
    const authorsResult = yield* Effect.either(
      comments.listAuthorEmailsForRecord({ session, recordId })
    )
    const priorEmails =
      authorsResult._tag === 'Left'
        ? ([] as readonly string[])
        : authorsResult.right
            .filter((author) => author.userId !== newAuthorId)
            .map((author) => author.email)
    if (priorEmails.length > 0) return priorEmails
    return yield* resolveOwnerFallbackEmails(session, record, newAuthorId, createdByNames)
  })

const buildCommentTriggerData = (
  input: TriggerCommentEventInput,
  record: Readonly<Record<string, unknown>>,
  threadParticipants: readonly string[]
): TriggerData => {
  const event = input.comment.status === 'approved' ? 'approved' : 'created'
  const envelope = {
    record,
    comment: {
      id: input.comment.id,
      body: input.comment.body,
      content: input.comment.body,
      parentCommentId: input.comment.parentCommentId,
      createdAt: input.comment.createdAt.toISOString(),
      author: input.author,
      status: input.comment.status,
    },
    threadParticipants,
    mentions: input.mentions,
    event,
  }
  return envelope as unknown as TriggerData
}

const passesReadPermissionGate = (input: {
  readonly table: Table | undefined
  readonly record: Readonly<Record<string, unknown>>
  readonly session: Readonly<UserSession>
  readonly userRole: string
  readonly respectReadPermissions: boolean | undefined
}): Effect.Effect<boolean, never, DataSourceRepository> =>
  Effect.gen(function* () {
    if (input.respectReadPermissions !== true) return true
    const predicate = input.table?.rowLevelPermissions?.read?.when
    if (!predicate) return true
    if (input.userRole === 'admin') return true

    const projection = toSessionProjection(input.session, {
      role: input.userRole,
      isUnrestricted: input.userRole === 'admin',
    })
    const scopeTables = collectAssignmentScopeTables(input.table?.rowLevelPermissions)
    const ctx = yield* loadCurrentUserContext(projection, scopeTables)
    return evaluateRecordAgainstPredicate(input.record, predicate, ctx)
  })

const fetchParentRecord = (
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | undefined, never, TableRepository> =>
  Effect.gen(function* () {
    const repo = yield* TableRepository
    const result = yield* Effect.either(repo.getRecord(session, tableName, recordId))
    if (result._tag === 'Left') return undefined
    return result.right ?? undefined
  })

const dispatchSingleCommentAutomation = (params: {
  readonly automation: NonNullable<App['automations']>[number]
  readonly input: TriggerCommentEventInput
  readonly table: Table | undefined
  readonly record: Readonly<Record<string, unknown>>
  readonly triggerData: TriggerData
}): Effect.Effect<void, never, ExecuteAutomationRunRequirements | DataSourceRepository> =>
  Effect.gen(function* () {
    const { automation, input, table, record, triggerData } = params
    const respectFlag =
      automation.trigger.type === 'comment' ? automation.trigger.respectReadPermissions : undefined
    const passes = yield* passesReadPermissionGate({
      table,
      record,
      session: input.session,
      userRole: input.userRole,
      respectReadPermissions: respectFlag,
    })
    if (!passes) return
    yield* dispatchAutomationOnce({
      automation,
      app: input.app,
      processEnv: input.processEnv,
      triggerData,
      userId: input.author.id,
    })
  })

export const triggerCommentEventAutomations = (
  input: TriggerCommentEventInput
): Effect.Effect<
  void,
  never,
  ExecuteAutomationRunRequirements | CommentRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    const matching = (input.app.automations ?? []).filter((automation) =>
      matchesCommentTrigger(automation, input.tableName, input.mentions, input.comment.status)
    )
    if (matching.length === 0) return

    const record = yield* fetchParentRecord(input.session, input.tableName, input.recordId)
    if (!record) return

    const createdByNames = createdByFieldNames(input.app.tables, input.tableName)
    const threadParticipants = yield* resolveThreadParticipants({
      session: input.session,
      record,
      recordId: input.recordId,
      newAuthorId: input.author.id,
      createdByNames,
    })

    const triggerData = buildCommentTriggerData(input, record, threadParticipants)
    const table = input.app.tables?.find((t) => t.name === input.tableName)

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchSingleCommentAutomation({ automation, input, table, record, triggerData }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchAllCause((cause) =>
      Effect.sync(() => {
        console.error('[automation:comment-posted] dispatch failure', cause)
      })
    )
  )
