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
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import { createdByFieldNames } from '@/domain/models/app/tables/authorship-fields'
import { evaluateRecordAgainstPredicate } from '@/domain/models/app/tables/row-level-evaluator-service'
import { logError } from '@/infrastructure/logging/logger'
import { dispatchAutomationOnce } from './dispatch-automation-trigger'
import { loadPausedAutomationNames } from './paused-automation-names'
import type { TriggerData } from './resolve-trigger-data'
import type { ExecuteAutomationRunRequirements } from './run-automation'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
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
  readonly author: {
    readonly id: string
    readonly email: string
    readonly name: string
  }
  readonly mentions: readonly string[]
  readonly processEnv: Readonly<Record<string, string | undefined>>
}

/**
 * Match a `comment`-typed automation against the just-posted comment.
 *
 * `when` lifecycle gate semantics (PG-02 lock):
 * - `undefined` / `'created'` (default): fires on any new comment insert.
 * - `'approved'`: fires only when the comment row's status is `'approved'`.
 *   The DB column defaults to `'approved'`, so today every new comment
 *   passes this gate. When the moderation pipeline lands and starts
 *   emitting `'pending'` / `'rejected'` rows, this gate already excludes
 *   them without further matcher changes.
 * - `'any'`: fires on any new comment regardless of status.
 *
 * `filter.mentionsOnly` short-circuits when the caller's mentions list is
 * empty (the trigger envelope's `{{trigger.mentions}}` would be empty too).
 */
const matchesCommentTrigger = (input: {
  readonly automation: NonNullable<App['automations']>[number]
  readonly tableName: string
  readonly mentions: readonly string[]
  readonly status: 'pending' | 'approved' | 'rejected'
  readonly pausedNames: ReadonlySet<string>
}): boolean => {
  const { automation, tableName, mentions, status, pausedNames } = input
  if (!isAutomationOperationallyEnabled(automation, pausedNames)) return false
  const { trigger } = automation
  if (trigger.type !== 'comment') return false
  if (trigger.table !== tableName) return false
  if (trigger.filter?.mentionsOnly === true && mentions.length === 0) return false
  // PG-02 lock: `when: 'approved'` fires only for approved comments. Other
  // values (`'created'`, `'any'`, undefined) fire on any insert.
  if (trigger.when === 'approved' && status !== 'approved') return false
  return true
}

/**
 * Read the first non-empty owner user id from `record`, searching the table's
 * declared `created-by` field name(s) FIRST (GAP-21: the owner column may be
 * custom-named, e.g. `author`), then the literal `created_by` / `createdBy`
 * fallthrough (back-compat — keeps [internal ref] green
 * for tables whose created-by field IS literally named `created_by`).
 */
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

/**
 * Resolve the record OWNER's email for the GAP-13 first-comment fallback.
 *
 * The record envelope surfaces the owner's user id in the table's declared
 * `created-by` field — which may be CUSTOM-NAMED (GAP-21, e.g. `author`) — or
 * the literal snake_case `created_by` (the transformed envelope's camelCase
 * `createdBy` is also accepted defensively in case the upstream shape changes).
 * When a record has no prior comment authors (the very first comment),
 * `threadParticipants` would otherwise be empty and a "notify the thread"
 * automation would fail with "requires a `to` address". We fall back to the
 * record owner's email so notifications still deliver. Returns an empty array
 * when the owner cannot be resolved (no owner field, owner is the new author,
 * or the user row is missing).
 */
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
    const emailResult = yield* Effect.result(
      comments.getUserEmailById({ session, userId: ownerId })
    )
    if (emailResult._tag === 'Failure' || !emailResult.success) return [] as readonly string[]
    return [emailResult.success]
  })

/**
 * Resolve `threadParticipants` for the just-posted comment (GAP-13).
 *
 * Distinct EMAIL ADDRESSES of all (non-soft-deleted) comment authors on the
 * same record OF THE SAME TABLE, minus the new author — usable directly as an
 * `email.send` `to`. The thread is keyed on `(tableId, recordId)`: record ids
 * are per-table sequences, so a record-only lookup would notify the
 * commenters of every same-numbered record in the app. When the resolved list is empty (a first comment), falls back to the
 * record OWNER's email so a notify-thread automation still has a recipient.
 * Returns `readonly string[]` so the trigger envelope can surface it directly
 * at `{{trigger.threadParticipants}}`.
 */
const resolveThreadParticipants = (params: {
  readonly session: Readonly<UserSession>
  readonly record: Readonly<Record<string, unknown>>
  readonly tableId: string
  readonly recordId: string
  readonly newAuthorId: string
  readonly createdByNames: readonly string[]
}): Effect.Effect<readonly string[], never, CommentRepository> =>
  Effect.gen(function* () {
    const { session, record, tableId, recordId, newAuthorId, createdByNames } = params
    const comments = yield* CommentRepository
    const authorsResult = yield* Effect.result(
      comments.listAuthorEmailsForRecord({ session, tableId, recordId })
    )
    const priorEmails =
      authorsResult._tag === 'Failure'
        ? ([] as readonly string[])
        : authorsResult.success
            .filter((author) => author.userId !== newAuthorId)
            .map((author) => author.email)
    if (priorEmails.length > 0) return priorEmails
    return yield* resolveOwnerFallbackEmails(session, record, newAuthorId, createdByNames)
  })

/**
 * Resolve `mentionedEmails` for the just-posted comment (GAP-22).
 *
 * The EMAIL ADDRESSES of the users named in `mentions`, in mention order,
 * usable directly as an `email.send` `to`. This is the exact twin of GAP-13:
 * `mentions` is — and stays — `UUID` ([internal ref]
 * pins that, and it is the documented payload contract), so
 * `to: '{{trigger.mentions}}'` renders a comma-joined list of ids and the
 * action fails with "email.send requires a `to` address". Rather than change
 * the type of `mentions` and break both, we surface a SIBLING field that is
 * already addresses.
 *
 * The comment's own author is dropped even when they appear in `mentions`:
 * a self-mention must not send someone a notification about their own
 * comment. Ids that do not resolve to a user row (deleted user, bad id from
 * the caller) are skipped rather than failing the dispatch — a mention
 * automation that half-delivers is better than a comment endpoint that
 * silently drops its automation. Duplicate ids collapse to one address.
 */
const resolveMentionedEmails = (params: {
  readonly session: Readonly<UserSession>
  readonly mentions: readonly string[]
  readonly newAuthorId: string
}): Effect.Effect<readonly string[], never, CommentRepository> =>
  Effect.gen(function* () {
    const { session, mentions, newAuthorId } = params
    const targets = [...new Set(mentions)].filter((userId) => userId !== newAuthorId)
    if (targets.length === 0) return [] as readonly string[]
    const comments = yield* CommentRepository
    const resolved = yield* Effect.forEach(
      targets,
      (userId) =>
        Effect.map(Effect.result(comments.getUserEmailById({ session, userId })), (result) =>
          result._tag === 'Failure' ? undefined : result.success
        ),
      { concurrency: 1 }
    )
    return resolved.filter(
      (email): email is string => typeof email === 'string' && email.length > 0
    )
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
  threadParticipants: readonly string[],
  mentionedEmails: readonly string[]
): TriggerData => {
  // Bridge from the create handler's `status` field to the auth-event-style
  // `event` discriminator surfaced at `{{trigger.data.event}}`. A
  // moderation-pipeline insert that arrives `'approved'` upfront fires the
  // `'created'` lifecycle (PG-02 lock — auto-mode comments are
  // approved-on-insert). Once `'pending'` flips to `'approved'` later, the
  // moderation pipeline will dispatch a separate `'approved'` event; that
  // hook lives outside this use case.
  const event = input.comment.status === 'approved' ? 'approved' : 'created'
  const envelope = {
    record,
    comment: {
      id: input.comment.id,
      body: input.comment.body,
      // Echo the wire-format key the create-comment handler surfaces in its
      // 201 response (`comment.content`) so templates can use either path —
      // `{{trigger.comment.body}}` or `{{trigger.comment.content}}` — and
      // resolve to the same string. Avoids action-template churn when an
      // operator copies a YAML snippet authored against the API response.
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
  return envelope as unknown as TriggerData
}

/**
 * Apply Z-3 read-permission check for `respectReadPermissions: true`.
 *
 * Returns true when the trigger should fire (admin-equivalent author, no
 * row-level rules, or the comment author passes the `read.when` predicate
 * against the record fields). Returns false when the trigger MUST be
 * suppressed because the author cannot read the record they just commented
 * on — matches the customer-facing privacy contract that an automation must
 * never reveal a record's existence to a user who could not have seen
 * it themselves.
 *
 * "Unrestricted" is decided by `isAdminEquivalent(role, app)` — the canonical
 * predicate the records API (`row-level-guard.ts`), the session-establish path
 * and the MCP tool-call path all share. `isAdminRole` alone was the previous
 * test here, and it matches the literal built-in `admin` and nothing else: an
 * app whose RESOLVED TOP custom role is e.g. `engineer` had that author
 * evaluated against a predicate they are exempt from everywhere else, so a
 * comment they posted on a record they can genuinely read unrestricted
 * silently suppressed the automation. The `isAdminRole` disjunct is kept for
 * the same built-in-admin conservatism `row-level-guard.ts` documents: a
 * literal `admin` never loses the bypass, whatever custom hierarchy an app
 * declares. Mid-level custom roles return false and stay gated.
 */
const passesReadPermissionGate = (input: {
  readonly app: Pick<App, 'auth'>
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
    const isUnrestricted =
      isAdminRole(input.userRole) || isAdminEquivalent(input.userRole, input.app)
    if (isUnrestricted) return true

    const projection = toSessionProjection(input.session, {
      role: input.userRole,
      isUnrestricted,
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
    const result = yield* Effect.result(repo.getRecord(session, tableName, recordId))
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
      app: input.app,
      processEnv: input.processEnv,
      triggerData,
      userId: input.author.id,
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
): Effect.Effect<TriggerData, never, CommentRepository> =>
  Effect.gen(function* () {
    // GAP-21: resolve the table's declared `created-by` field name(s) so the
    // first-comment owner fallback reads the owner from a CUSTOM-named column
    // (e.g. `author`), not just the literal `created_by`.
    const createdByNames = createdByFieldNames(input.app.tables, input.tableName)
    const threadParticipants = yield* resolveThreadParticipants({
      session: input.session,
      record,
      tableId: input.tableId,
      recordId: input.recordId,
      newAuthorId: input.author.id,
      createdByNames,
    })
    const mentionedEmails = yield* resolveMentionedEmails({
      session: input.session,
      mentions: input.mentions,
      newAuthorId: input.author.id,
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
  | DataSourceRepository
  | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    // Entry point: one read of the operational pauses per comment event.
    const pausedNames = yield* loadPausedAutomationNames
    const matching = (input.app.automations ?? []).filter((automation) =>
      matchesCommentTrigger({
        automation,
        tableName: input.tableName,
        mentions: input.mentions,
        status: input.comment.status,
        pausedNames,
      })
    )
    if (matching.length === 0) return

    const record = yield* fetchParentRecord(input.session, input.tableName, input.recordId)
    if (!record) return

    const triggerData = yield* buildEnvelopeForComment(input, record)
    const table = input.app.tables?.find((t) => t.name === input.tableName)

    yield* Effect.forEach(
      matching,
      (automation) =>
        dispatchSingleCommentAutomation({ automation, input, table, record, triggerData }),
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
