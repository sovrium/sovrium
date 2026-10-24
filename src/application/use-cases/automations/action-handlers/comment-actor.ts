/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Whose rules a `comment` step meets, and the reach of a person on a thread.
 *
 * `runAs` decides it, as on record steps (`resolveRunAsActor`): the system by
 * default, the triggering user under `runAs: 'triggering-user'`, and always the
 * starter of a run someone started by hand. The system meets no permission. A
 * person meets the comments API's own: the table's read grant and its row-level
 * read rule on the record the thread belongs to — a thread is part of its
 * record — and, to post, the table's comment grant. Every refusal is the
 * records API's `Resource not found`, so a step never tells a record it may not
 * read from one that does not exist.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { loadCallerIdentity } from '@/application/use-cases/tables/permissions/caller-write-authority'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  hasCommentPermissionForRoles,
  hasReadPermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { rowPassesRule } from '@/domain/models/app/tables/row-level-write-decision-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import { logError } from '@/infrastructure/logging/logger'
import { buildSyntheticSession, buildSystemSession } from '../build-guest-session'
import { resolveRunAsActor } from './record'
import { CALLER_REFUSAL } from './record-caller-gate'
import { stringProp, type ActionOutcome, type AutomationContext } from './shared'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App, Table } from '@/domain/models/app'

/** The operators of the `comment` family. */
export type CommentOperator = 'create' | 'list' | 'delete' | 'update' | 'moderate'

/** The longest comment the comments API stores. */
const MAX_COMMENT_LENGTH = 10_000

/**
 * Why a comment's rendered content cannot be stored, or `undefined` when it
 * can: 1 to 10,000 characters, as a posted body — judged on the text a
 * template produced, for a post and an edit alike.
 */
export const commentContentRefusal = (content: string): string | undefined => {
  if (content.length === 0) return 'the content is empty once rendered'
  if (content.length > MAX_COMMENT_LENGTH) {
    return `the content holds ${content.length.toLocaleString('en-US')} characters once rendered, past the limit of 10,000`
  }
  return undefined
}

/** A step that failed for a reason the run history shows. */
export const commentFailure = (operator: CommentOperator, reason: string): ActionOutcome => ({
  status: 'failure',
  error: `comment.${operator}: ${reason}`,
})

/** The refusal a person meets: the records API's own words, and never worth a retry. */
export const COMMENT_REFUSAL: ActionOutcome = {
  status: 'failure',
  error: CALLER_REFUSAL,
  retryable: false,
}

/** Who a `comment` step acts as. */
export type CommentActor =
  { readonly kind: 'system' } | { readonly kind: 'user'; readonly userId: string }

/**
 * The actor of a step, or `undefined` when nobody may act: a run a signed-out
 * visitor started by hand has no account to comment, read or delete with, and
 * a hand-started run that no longer names its starter acts as nobody — never
 * as the system, which reads every moderation status and deletes any comment
 * (the record steps refuse the same run, `callerMayWrite`).
 */
export const commentActorOf = (
  props: Readonly<Record<string, unknown>>,
  automation: AutomationContext
): CommentActor | undefined => {
  const starterless = automation.startedAsGuest === true || automation.userId === undefined
  if (automation.startedByHand === true && starterless) return undefined
  const actorId = resolveRunAsActor(props, automation)
  return actorId === SYSTEM_USER_ID ? { kind: 'system' } : { kind: 'user', userId: actorId }
}

/** A person's standing on one thread, once the record has been judged readable. */
export interface ThreadReach {
  readonly session: Readonly<UserSession>
  readonly role: string
  /** The table's comment grant admits them. */
  readonly mayComment: boolean
  /** They moderate: they read every status and delete any comment. */
  readonly moderates: boolean
}

type ReachRequirements = AuthRepository | DataSourceRepository | TableRepository

/**
 * A person's reach on the thread of `recordId`, or `undefined` when they may
 * not read that record — no account, no read grant, a row-level read rule the
 * record fails, or no such record. A lookup that fails refuses: it can only
 * narrow what the step does.
 */
export const threadReachOf = (
  app: App,
  table: Table,
  userId: string,
  recordId: string
): Effect.Effect<ThreadReach | undefined, never, ReachRequirements> =>
  Effect.gen(function* () {
    const identity = yield* loadCallerIdentity(app, userId, table)
    if (identity === undefined) return undefined
    if (!hasReadPermissionForRoles(table, identity.effectiveRoles, app)) return undefined
    const row = yield* (yield* TableRepository)
      .getRecord(buildSystemSession(), table.name, recordId)
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => logError('[automations] comment step could not read the record', cause))
        ),
        // effect-swallow: logged above; an unreadable record is refused as a missing one.
        Effect.orElseSucceed(() => null)
      )
    if (row === null || row === undefined) return undefined
    const readable = rowPassesRule(
      table.rowLevelPermissions,
      'read',
      readStoredValues(table, row),
      identity.ctx
    )
    if (!readable) return undefined
    return {
      session: buildSyntheticSession(userId),
      role: identity.role,
      mayComment: hasCommentPermissionForRoles(table, identity.effectiveRoles, app),
      moderates: isAdminEquivalent(identity.role, app),
    }
  }).pipe(Effect.withSpan('automations.comment-thread-reach'))

/** The table and record a step addresses, read off its rendered props. */
export interface CommentTarget {
  readonly table: Table
  readonly recordId: string
}

/** The step's thread, or the failure that names what is missing. */
export const commentTargetOf = (
  operator: CommentOperator,
  app: App,
  props: Readonly<Record<string, unknown>>
): CommentTarget | ActionOutcome => {
  const tableName = stringProp(props, 'table').trim()
  const recordId = stringProp(props, 'recordId').trim()
  const table = app.tables?.find((candidate) => candidate.name === tableName)
  if (table === undefined) return commentFailure(operator, `no table named '${tableName}'`)
  if (recordId === '') return commentFailure(operator, 'requires a non-empty `recordId`')
  return { table, recordId }
}
