/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import {
  loadCurrentUserContext,
  rowRuleScopeOf,
  toSessionProjection,
} from '@/application/use-cases/tables/permissions/row-level-enforcement'
import { isSystemSession } from '@/domain/models/app/auth/guest-session'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import {
  firstMatchingTrigger,
  type TriggerOfType,
} from '@/domain/models/app/automations/trigger-entries-service'
import { createdByFieldNames } from '@/domain/models/app/tables/authorship-fields'
import { evaluateRecordAgainstPredicate } from '@/domain/models/app/tables/row-level-evaluator-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging/logger'
import { resolveMentionedEmails, resolveThreadParticipants } from './comment-trigger-recipients'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { CommentRepository } from '@/application/ports/repositories/comment-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { AudienceRequirements } from '@/application/use-cases/tables/comment-mention-programs'
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
 * `mentions` is an already-resolved list of user IDs: the create route derives
 * it from the body's `@[<user id>]` markup merged with the request's
 * `mentions` array, and keeps only people who can read the record
 * (`comment-mention-programs.ts`). This use case trusts that list.
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
    /**
     * Moderation status of the freshly-created comment row. Defaults to
     * `'approved'` in the create-handler (matching the DB column default
     * when no moderation pipeline has flipped it), so a comment is
     * effectively-approved at insert-time. PG-02 locked the trigger semantics
     * such that `when: 'approved'` automations fire only for approved
     * comments — when the moderation pipeline lands and starts emitting
     * `'pending'` rows, this gate already excludes them.
     */
    readonly status: 'pending' | 'approved' | 'rejected'
  }
  /** `null` for a comment the app wrote (an automation's `runAs: system`): no author account. */
  readonly author: { readonly id: string; readonly email: string; readonly name: string } | null
  readonly mentions: readonly string[]
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /** How many automation writes deep the comment was written; omitted means 0 (a person's post). */
  readonly depth?: number
}

/**
 * The comment entry of an automation that the just-posted comment starts — the
 * first that matches, so one comment starts one run. `when: 'approved'` (PG-02
 * lock) fires only for an approved comment; `'created'`, `'any'` and no value
 * fire on any insert. `filter.mentionsOnly` needs at least one mention.
 */
const matchesCommentTrigger = (input: {
  readonly automation: NonNullable<App['automations']>[number]
  readonly tableName: string
  readonly mentions: readonly string[]
  readonly status: 'pending' | 'approved' | 'rejected'
  readonly pausedNames: ReadonlySet<string>
}): TriggerOfType<'comment'> | undefined => {
  const { automation, tableName, mentions, status, pausedNames } = input
  if (!isAutomationOperationallyEnabled(automation, pausedNames)) return undefined
  return firstMatchingTrigger(
    automation,
    'comment',
    (trigger) =>
      trigger.table === tableName &&
      !(trigger.filter?.mentionsOnly === true && mentions.length === 0) &&
      !(trigger.when === 'approved' && status !== 'approved')
  )
}

/**
 * Build the trigger-data envelope for a comment-posted dispatch. `record`
 * is the record the comment was posted on (looked up once per dispatch);
 * `comment.author` is rebuilt from the caller-provided user metadata so
 * `{{trigger.comment.author.email}}` resolves without an extra DB hop.
 */
const buildCommentTriggerData = (
  input: TriggerCommentEventInput,
  record: Readonly<Record<string, unknown>>,
  threadParticipants: readonly string[],
  mentionedEmails: readonly string[]
): TriggerData => {
  // The `{{trigger.data.event}}` discriminator: an insert that lands approved is
  // `'approved'`; a later moderation flip dispatches its own event elsewhere.
  const event = input.comment.status === 'approved' ? 'approved' : 'created'
  const envelope = {
    record,
    comment: {
      id: input.comment.id,
      body: input.comment.body,
      // The create response's key too, so `{{trigger.comment.content}}` reads the same.
      content: input.comment.body,
      parentCommentId: input.comment.parentCommentId,
      createdAt: input.comment.createdAt.toISOString(),
      author: input.author,
      status: input.comment.status,
    },
    threadParticipants,
    mentions: input.mentions,
    mentionedEmails,
    event,
  }
  return envelope as TriggerData
}

/**
 * Apply Z-3 read-permission check for `respectReadPermissions: true`.
 *
 * Returns true when the trigger should fire (admin-equivalent author, no
 * row-level rules, or the comment author passes the `read.when` predicate
 * against the record, a lookup leaf judged in the table's scope). Returns
 * false when the trigger MUST be suppressed because the author cannot read the
 * record she commented on: an automation never reveals a record she cannot see.
 *
 * "Unrestricted" is decided by `isAdminEquivalent(role, app)` — the canonical
 * predicate the records API (`row-level-guard.ts`), the session-establish path
 * and the MCP tool-call path all share. `isAdminRole` alone was the previous
 * test here, and it matches the literal built-in `admin` and nothing else: an
 * app whose RESOLVED TOP custom role is e.g. `engineer` had that author
 * evaluated against a predicate they are exempt from everywhere else, so a
 * comment they posted on a record they can genuinely read unrestricted
 * silently suppressed the automation. `isAdminEquivalent` also admits the
 * literal `admin` whatever custom hierarchy an app declares (the hidden-field leak fixes in saved views and table definitions point 75),
 * so the built-in admin never loses the bypass. Mid-level custom roles return
 * false and stay gated.
 */
const passesReadPermissionGate = (input: {
  readonly app: Pick<App, 'auth' | 'tables'>
  readonly table: Table | undefined
  readonly record: Readonly<Record<string, unknown>>
  readonly session: Readonly<UserSession>
  readonly userRole: string
  readonly respectReadPermissions: boolean | undefined
}): Effect.Effect<boolean, never, DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    if (input.respectReadPermissions !== true || isSystemSession(input.session.userId)) return true
    const predicate = input.table?.rowLevelPermissions?.read?.when
    if (!predicate) return true
    const isUnrestricted = isAdminEquivalent(input.userRole, input.app)
    if (isUnrestricted) return true

    const projection = toSessionProjection(input.session, {
      role: input.userRole,
      isUnrestricted,
    })
    const scope = rowRuleScopeOf(input.table, input.app.tables)
    const ctx = yield* loadCurrentUserContext(projection, input.table?.rowLevelPermissions, scope)
    // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
    return evaluateRecordAgainstPredicate(
      readStoredValues(input.table, input.record),
      predicate,
      ctx
    )
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
    // effect-swallow: fail-soft — a parent record that cannot be read short-circuits the dispatch, as a vanished one does; the cause is logged on the way.
    const result = yield* Effect.result(
      repo
        .getRecord(session, tableName, recordId)
        .pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() =>
              logError(
                '[automation:comment-posted] the parent record could not be read; the trigger is not dispatched',
                cause,
                { 'sovrium.table.name': tableName, 'sovrium.record.id': recordId }
              )
            )
          )
        )
    )
    if (result._tag === 'Failure') return undefined
    return result.success ?? undefined
  })

/**
 * Per-automation guard: short-circuits when `respectReadPermissions: true`
 * and the comment author does not pass the table's `read.when` predicate.
 * Returns the dispatch effect (or `void`) — extracted so the top-level
 * iterator stays under the 50-line/function limit.
 */
const dispatchSingleCommentAutomation = (params: {
  readonly automation: NonNullable<App['automations']>[number]
  readonly trigger: TriggerOfType<'comment'>
  readonly input: TriggerCommentEventInput
  readonly table: Table | undefined
  readonly record: Readonly<Record<string, unknown>>
  readonly triggerData: TriggerData
}): Effect.Effect<void, never, ExecuteAutomationRunRequirements | DataSourceRepository> =>
  Effect.gen(function* () {
    const { automation, trigger, input, table, record, triggerData } = params
    const respectFlag = trigger.respectReadPermissions
    const passes = yield* passesReadPermissionGate({
      app: input.app,
      table,
      record,
      session: input.session,
      userRole: input.userRole,
      respectReadPermissions: respectFlag,
    })
    if (!passes) return
    yield* dispatchAutomationOnce({
      automation,
      trigger,
      app: input.app,
      processEnv: input.processEnv,
      triggerData,
      userId: input.author?.id,
      ...(input.depth === undefined ? {} : { recordEventDepth: input.depth }),
    })
  })

/**
 * Resolve the two derived recipient lists and fold them into the envelope.
 *
 * Extracted from `triggerCommentEventAutomations` purely to keep that
 * function under the 50-line cap; it has no independent meaning. Both lists
 * are resolved unconditionally rather than per-automation because the
 * envelope is built ONCE and shared across every matching automation.
 */
const buildEnvelopeForComment = (
  input: TriggerCommentEventInput,
  record: Readonly<Record<string, unknown>>
): Effect.Effect<TriggerData, never, CommentRepository | AudienceRequirements> =>
  Effect.gen(function* () {
    // [internal ref]: resolve the table's declared `created-by` field name(s) so the
    // first-comment owner fallback reads the owner from a CUSTOM-named column
    // (e.g. `author`), not just the literal `created_by`.
    const createdByNames = createdByFieldNames(input.app.tables, input.tableName)
    const threadParticipants = yield* resolveThreadParticipants({
      input: { ...input, authorId: input.author?.id },
      record,
      createdByNames,
    })
    const mentionedEmails = yield* resolveMentionedEmails({
      session: input.session,
      mentions: input.mentions,
      newAuthorId: input.author?.id ?? '',
    })
    return buildCommentTriggerData(input, record, threadParticipants, mentionedEmails)
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
  | ExecuteAutomationRunRequirements
  | CommentRepository
  | AudienceRequirements
  | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    // Entry point: one read of the operational pauses per comment event.
    const pausedNames = yield* loadPausedAutomationNames
    const matching = (input.app.automations ?? []).flatMap((automation) => {
      const trigger = matchesCommentTrigger({
        automation,
        tableName: input.tableName,
        mentions: input.mentions,
        status: input.comment.status,
        pausedNames,
      })
      return trigger === undefined ? [] : [{ automation, trigger }]
    })
    if (matching.length === 0) return

    const record = yield* fetchParentRecord(input.session, input.tableName, input.recordId)
    if (!record) return

    const triggerData = yield* buildEnvelopeForComment(input, record)
    const table = input.app.tables?.find((t) => t.name === input.tableName)

    yield* Effect.forEach(
      matching,
      ({ automation, trigger }) =>
        dispatchSingleCommentAutomation({ automation, trigger, input, table, record, triggerData }),
      { concurrency: 1, discard: true }
    )
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        logError('[automation:comment-posted] dispatch failure', cause)
      })
    ),
    Effect.withSpan('automations.trigger-comment-event-automations')
  )
