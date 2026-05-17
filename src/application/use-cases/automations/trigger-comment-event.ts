/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import {
  collectAssignmentScopeTables,
  loadCurrentUserContext,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { evaluateRecordAgainstPredicate } from '@/domain/validators/row-level-evaluator'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { UserSession } from '@/application/ports/models/user-session'
import type { DataSourceRepository } from '@/application/ports/repositories/data-source-repository'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables/table'

/**
 * Inputs to the comment-posted trigger (Y-6).
 *
 * `comment` is the freshly-created row, surfaced to actions via
 * `{{trigger.comment.X}}` (top-level — NOT under `trigger.data`). The
 * `author` block carries the user metadata that the spec asserts
 * (`{{trigger.comment.author.email}}`); we accept it from the caller
 * rather than re-querying so the route does one fetch.
 *
 * `mentions` is an already-resolved list of user IDs. The engine does NOT
 * re-parse the body for `@<name>` markup — the spec passes the IDs
 * explicitly in the request body, so we trust the caller's list.
 *
 * `processEnv` mirrors `triggerRecordEventAutomations` so action handlers
 * can resolve `$env.VAR_NAME` and so secrets get redacted from history.
 */
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
  }
  readonly author: {
    readonly id: string
    readonly email: string
    readonly name: string
  }
  readonly mentions: readonly string[]
  readonly processEnv: Readonly<Record<string, string | undefined>>
}

/**
 * Match a `comment`-typed automation against the just-posted comment. The
 * `when` lifecycle gate is implicit on the `created` event today (we only
 * fire from the create handler); future migration specs add `approved`
 * and `any` semantics. `filter.mentionsOnly` short-circuits when the
 * caller's mentions list is empty.
 */
const matchesCommentTrigger = (
  automation: NonNullable<App['automations']>[number],
  tableName: string,
  mentions: readonly string[]
): boolean => {
  if (automation.enabled === false) return false
  const { trigger } = automation
  if (trigger.type !== 'comment') return false
  if (trigger.table !== tableName) return false
  if (trigger.filter?.mentionsOnly === true && mentions.length === 0) return false
  // The schema's `when` field is reserved for future approve/any semantics.
  // Today the trigger only fires on `created`; matching is therefore implicit.
  return true
}

/**
 * Resolve `threadParticipants` for the just-posted comment. Distinct
 * authors of all (non-soft-deleted) comments on the same record, minus the
 * new author. Returns `readonly string[]` so the trigger envelope can
 * surface it directly at `{{trigger.threadParticipants}}`.
 */
const resolveThreadParticipants = (
  session: Readonly<UserSession>,
  recordId: string,
  newAuthorId: string
): Effect.Effect<readonly string[], never, CommentRepository> =>
  Effect.gen(function* () {
    const comments = yield* CommentRepository
    const authorsResult = yield* Effect.either(comments.listAuthorsForRecord({ session, recordId }))
    if (authorsResult._tag === 'Left') return [] as readonly string[]
    return authorsResult.right.filter((authorId) => authorId !== newAuthorId)
  })

/**
 * Build the trigger-data envelope for a comment-posted dispatch. `record`
 * is the record the comment was posted on (looked up once per dispatch);
 * `comment.author` is rebuilt from the caller-provided user metadata so
 * `{{trigger.comment.author.email}}` resolves without an extra DB hop.
 */
const buildCommentTriggerData = (
  input: TriggerCommentEventInput,
  record: Readonly<Record<string, unknown>>,
  threadParticipants: readonly string[]
): TriggerData => {
  const envelope = {
    record,
    comment: {
      id: input.comment.id,
      body: input.comment.body,
      parentCommentId: input.comment.parentCommentId,
      createdAt: input.comment.createdAt.toISOString(),
      author: input.author,
    },
    threadParticipants,
    mentions: input.mentions,
  }
  return envelope as unknown as TriggerData
}

/**
 * Apply Z-3 read-permission check for `respectReadPermissions: true`.
 *
 * Returns true when the trigger should fire (admin, no row-level rules,
 * or the comment author passes the `read.when` predicate against the
 * record fields). Returns false when the trigger MUST be suppressed
 * because the author cannot read the record they just commented on —
 * matches the customer-facing privacy contract that an automation must
 * never reveal a record's existence to a user who could not have seen
 * it themselves.
 */
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

/**
 * Fetch the parent record by id. Returns `undefined` when the row vanished
 * between comment-create and trigger-dispatch (extremely unlikely in
 * practice but graceful — the caller short-circuits the dispatch).
 */
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

/**
 * Per-automation guard: short-circuits when `respectReadPermissions: true`
 * and the comment author does not pass the table's `read.when` predicate.
 * Returns the dispatch effect (or `void`) — extracted so the top-level
 * iterator stays under the 50-line/function limit.
 */
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

/**
 * Fire all comment-posted automations matching the just-created comment.
 *
 * Errors are absorbed at the boundary — a comment-create endpoint returns
 * 201 regardless of automation outcome. The mismatch between "comment
 * succeeded" and "automation failed" is captured in `system.automation_runs`,
 * mirroring the convention established by record-event and form-submission
 * triggers.
 */
export const triggerCommentEventAutomations = (
  input: TriggerCommentEventInput
): Effect.Effect<
  void,
  never,
  ExecuteAutomationRunRequirements | CommentRepository | DataSourceRepository
> =>
  Effect.gen(function* () {
    const matching = (input.app.automations ?? []).filter((automation) =>
      matchesCommentTrigger(automation, input.tableName, input.mentions)
    )
    if (matching.length === 0) return

    const record = yield* fetchParentRecord(input.session, input.tableName, input.recordId)
    if (!record) return

    const threadParticipants = yield* resolveThreadParticipants(
      input.session,
      input.recordId,
      input.author.id
    )

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
