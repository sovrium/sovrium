/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `comment` `list`, `delete`, `update` and `moderate` — read a record's thread,
 * remove one of its comments, replace its text or set its moderation status,
 * from a workflow.
 *
 * As the system, a list reads every comment that is not deleted, whatever its
 * moderation status, and a deletion may remove any comment of the thread. As a
 * person, both meet the comments API's rules: nothing on a record they may not
 * read, published comments only unless they moderate, and only their own
 * comment to delete unless they moderate (`deleteCommentProgram`). An edit is
 * the author's alone (`updateCommentProgram`); a moderation decision needs a
 * person who moderates the table. A comment is always addressed by its thread
 * AND its id: one of another record's thread is refused as a missing one.
 *
 * A list never carries an author's email address: a step's output is shown in
 * run history, to people the address was never meant for.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import {
  deleteCommentProgram,
  updateCommentProgram,
  updateCommentStatusProgram,
} from '@/application/use-cases/tables/comment-programs'
import {
  belongsToAddress,
  commentTableKeysOf,
} from '@/domain/models/app/tables/comment-address-service'
import { logError } from '@/infrastructure/logging/logger'
import { buildSystemSession } from '../build-guest-session'
import {
  COMMENT_REFUSAL,
  commentActorOf,
  commentContentRefusal,
  commentFailure,
  commentTargetOf,
  threadReachOf,
  type CommentOperator,
  type CommentTarget,
} from './comment-actor'
import { actionAttributes, numberProp, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, AutomationContext } from './shared'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { ListedComment } from '@/application/ports/repositories/comment-repository'
import type { App } from '@/domain/models/app'
import type { CommentAddress } from '@/domain/models/app/tables/comment-address-service'

/** How a step reads or writes the thread: as the system, or within a person's reach. */
interface ThreadAccess {
  readonly session: Readonly<UserSession>
  /** `undefined` for the system, which meets no comment rule. */
  readonly moderates: boolean | undefined
}

/**
 * The access a step has to its thread, or `undefined` when it has none: the
 * caller may not read the record, or the record does not exist. The system
 * reads any live record; a missing one is refused as a person's would be.
 */
const threadAccessOf = (
  app: App,
  target: CommentTarget,
  props: Readonly<Record<string, unknown>>,
  automation: AutomationContext
) =>
  Effect.gen(function* () {
    const actor = commentActorOf(props, automation)
    if (actor === undefined) return undefined
    if (actor.kind === 'user') {
      const reach = yield* threadReachOf(app, target.table, actor.userId, target.recordId)
      return reach === undefined
        ? undefined
        : { session: reach.session, moderates: reach.moderates }
    }
    const session = buildSystemSession()
    const exists = yield* (yield* CommentRepository).checkRecordExists({
      ...{ session, tableName: target.table.name, recordId: target.recordId },
      isAdmin: true,
    })
    return exists ? ({ session, moderates: undefined } satisfies ThreadAccess) : undefined
  })

/** A comment as a step's output carries it: its author by id and name, never by address. */
const toStepComment = (comment: ListedComment) => ({
  id: comment.id,
  content: comment.content,
  status: comment.status,
  parentCommentId: comment.parentId,
  createdAt: comment.createdAt.toISOString(),
  author: comment.user === undefined ? null : { id: comment.user.id, name: comment.user.name },
})

/** A step that could not reach the comments: logged, and failed with a reason. */
const unreachable =
  (operator: CommentOperator) =>
  (cause: unknown): ActionOutcome => {
    logError(`[automations] comment.${operator} could not reach the comments`, cause)
    return commentFailure(operator, 'the comments could not be reached')
  }

export const handleCommentList: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const target = commentTargetOf('list', app, props)
    if ('status' in target) return target
    const access = yield* threadAccessOf(app, target, props, automation)
    if (access === undefined) return COMMENT_REFUSAL
    const limit = props['limit'] === undefined ? undefined : numberProp(props, 'limit', 1000)
    const listed = yield* (yield* CommentRepository).list({
      session: access.session,
      tableKeys: commentTableKeysOf(target.table),
      recordId: target.recordId,
      sortOrder: 'asc',
      ...(limit === undefined ? {} : { limit }),
      includeAllStatuses: access.moderates !== false,
    })
    const comments = listed.map(toStepComment)
    return { status: 'success', output: { comments, count: comments.length } } as const
  }).pipe(
    Effect.catch((cause) => Effect.succeed(unreachable('list')(cause))),
    Effect.withSpan('automations.handle-comment-list', { attributes: actionAttributes(action) })
  )

/** Soft-delete one comment of the thread as the system: any comment, but only of this thread. */
const deleteAsSystem = (
  session: Readonly<UserSession>,
  commentId: string,
  address: CommentAddress
) =>
  Effect.gen(function* () {
    const comments = yield* CommentRepository
    const comment = yield* comments.getForAuth({ session, commentId })
    if (comment === undefined || !belongsToAddress(comment, address)) return false
    yield* comments.remove({ session, commentId })
    return true
  })

/** Soft-delete one comment under a person's rules: their own, or any when they moderate. */
const deleteAsPerson = (input: {
  readonly app: App
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly address: CommentAddress
}) =>
  deleteCommentProgram(input).pipe(
    Effect.as(true),
    Effect.catchTags({
      NotFoundError: () => Effect.succeed(false),
      ForbiddenError: () => Effect.succeed(false),
    })
  )

export const handleCommentDelete: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const target = commentTargetOf('delete', app, props)
    if ('status' in target) return target
    const commentId = stringProp(props, 'commentId').trim()
    if (commentId === '') return commentFailure('delete', 'requires a non-empty `commentId`')
    const access = yield* threadAccessOf(app, target, props, automation)
    if (access === undefined) return COMMENT_REFUSAL
    const { table, recordId } = target
    const address = { recordId, tableKeys: commentTableKeysOf(table) }
    const deleted =
      access.moderates === undefined
        ? yield* deleteAsSystem(access.session, commentId, address)
        : yield* deleteAsPerson({
            ...{ app, session: access.session, commentId, tableName: table.name, address },
          })
    return deleted ? ({ status: 'success', output: { id: commentId } } as const) : COMMENT_REFUSAL
  }).pipe(
    Effect.catch((cause) => Effect.succeed(unreachable('delete')(cause))),
    Effect.withSpan('automations.handle-comment-delete', { attributes: actionAttributes(action) })
  )

/** The comment of the step's thread a step edits or moderates, or why it may not. */
const addressedComment = (
  operator: CommentOperator,
  app: App,
  props: Readonly<Record<string, unknown>>
): { readonly target: CommentTarget; readonly commentId: string } | ActionOutcome => {
  const target = commentTargetOf(operator, app, props)
  if ('status' in target) return target
  const commentId = stringProp(props, 'commentId').trim()
  if (commentId === '') return commentFailure(operator, 'requires a non-empty `commentId`')
  return { target, commentId }
}

/** Whether `commentId` is a comment of the step's thread, read as the system. */
const isOfThread = (session: Readonly<UserSession>, commentId: string, target: CommentTarget) =>
  Effect.gen(function* () {
    const comment = yield* (yield* CommentRepository).getForAuth({ session, commentId })
    const address = { recordId: target.recordId, tableKeys: commentTableKeysOf(target.table) }
    return comment !== undefined && belongsToAddress(comment, address)
  })

/** Replace a comment's text as the system: any comment, but only of this thread. */
const editAsSystem = (
  session: Readonly<UserSession>,
  input: { readonly commentId: string; readonly content: string; readonly target: CommentTarget }
) =>
  Effect.gen(function* () {
    if (!(yield* isOfThread(session, input.commentId, input.target))) return false
    yield* (yield* CommentRepository).update({
      ...{ session, commentId: input.commentId, content: input.content },
    })
    return true
  })

/** Replace a comment's text under the author's rule: her own comment, and no other. */
const editAsAuthor = (
  session: Readonly<UserSession>,
  input: { readonly commentId: string; readonly content: string; readonly target: CommentTarget }
) =>
  updateCommentProgram({
    session,
    commentId: input.commentId,
    tableName: input.target.table.name,
    content: input.content,
    address: { recordId: input.target.recordId, tableKeys: commentTableKeysOf(input.target.table) },
  }).pipe(
    Effect.as(true),
    Effect.catchTags({
      NotFoundError: () => Effect.succeed(false),
      ForbiddenError: () => Effect.succeed(false),
    })
  )

export const handleCommentUpdate: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const addressed = addressedComment('update', app, props)
    if ('status' in addressed) return addressed
    const content = stringProp(props, 'content')
    const refused = commentContentRefusal(content)
    if (refused !== undefined) return commentFailure('update', refused)
    const access = yield* threadAccessOf(app, addressed.target, props, automation)
    if (access === undefined) return COMMENT_REFUSAL
    const input = { ...addressed, content }
    const edited =
      access.moderates === undefined
        ? yield* editAsSystem(access.session, input)
        : yield* editAsAuthor(access.session, input)
    return edited
      ? ({ status: 'success', output: { id: addressed.commentId, content } } as const)
      : COMMENT_REFUSAL
  }).pipe(
    Effect.catch((cause) => Effect.succeed(unreachable('update')(cause))),
    Effect.withSpan('automations.handle-comment-update', { attributes: actionAttributes(action) })
  )

/** The moderation statuses a step may set. */
const MODERATION_STATUSES = ['approved', 'pending', 'rejected'] as const

type ModerationStatus = (typeof MODERATION_STATUSES)[number]

const isModerationStatus = (value: string): value is ModerationStatus =>
  (MODERATION_STATUSES as readonly string[]).includes(value)

export const handleCommentModerate: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const addressed = addressedComment('moderate', app, props)
    if ('status' in addressed) return addressed
    const status = stringProp(props, 'status').trim()
    if (!isModerationStatus(status)) {
      return commentFailure('moderate', '`status` must be approved, pending or rejected')
    }
    const access = yield* threadAccessOf(app, addressed.target, props, automation)
    // A person who does not moderate the table meets the refusal of a missing comment.
    if (access === undefined || access.moderates === false) return COMMENT_REFUSAL
    const { commentId, target } = addressed
    if (!(yield* isOfThread(access.session, commentId, target))) return COMMENT_REFUSAL
    const moderated = yield* updateCommentStatusProgram({
      ...{ session: access.session, commentId, tableName: target.table.name, status },
    })
    return moderated === undefined
      ? COMMENT_REFUSAL
      : ({ status: 'success', output: { id: commentId, status: moderated.status } } as const)
  }).pipe(
    Effect.catch((cause) => Effect.succeed(unreachable('moderate')(cause))),
    Effect.withSpan('automations.handle-comment-moderate', { attributes: actionAttributes(action) })
  )
