/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `comment` `create` — post a comment on a record's thread from a workflow.
 *
 * It is the comments API's own post (`postCommentProgram`): the same reply
 * rule, mention audience, moderation and comment triggers. Two things differ,
 * on purpose. The anti-abuse guards — the per-address rate limit, the honeypot,
 * the spam heuristics — do not apply: they guard against strangers, and a
 * workflow is not one. And the comment is judged on its RENDERED content, the
 * text a template produced, which must hold 1 to 10,000 characters exactly as a
 * posted body must.
 *
 * A comment the step writes starts the table's comment automations in the
 * background, one automation write deeper than the run that wrote it; past the
 * depth limit the step fails, naming it, and writes nothing.
 */

import { Effect } from 'effect'
import {
  NestedCommentReplyError,
  postCommentProgram,
} from '@/application/use-cases/tables/comment-post-programs'
import { logError } from '@/infrastructure/logging/logger'
import {
  COMMENT_REFUSAL,
  commentActorOf,
  commentFailure,
  commentTargetOf,
  threadReachOf,
  type CommentActor,
  type CommentTarget,
} from './comment-actor'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'
import type {
  CommentAuthor,
  PostedCommentEvent,
} from '@/application/use-cases/tables/comment-post-programs'
import type { App } from '@/domain/models/app'

/** The longest comment the comments API stores. */
const MAX_COMMENT_LENGTH = 10_000

/** Why the rendered content cannot be posted, or `undefined` when it can. */
const contentRefusal = (content: string): string | undefined => {
  if (content.length === 0) return 'the content is empty once rendered'
  if (content.length > MAX_COMMENT_LENGTH) {
    return `the content holds ${content.length.toLocaleString('en-US')} characters once rendered, past the limit of 10,000`
  }
  return undefined
}

/** The ids a step's `mentions` prop names, rendered: non-empty strings only. */
const mentionsOf = (props: Readonly<Record<string, unknown>>): readonly string[] => {
  const raw = props['mentions']
  return Array.isArray(raw)
    ? raw.map((id) => String(id ?? '').trim()).filter((id) => id.length > 0)
    : []
}

/**
 * Who the comment is written as, or the refusal a person meets: a record they
 * may not read, or a table whose comment grant does not admit them.
 */
const authorOf = (
  app: App,
  target: CommentTarget,
  actor: CommentActor
): Effect.Effect<
  CommentAuthor | undefined,
  never,
  Effect.Services<ReturnType<typeof threadReachOf>>
> =>
  Effect.gen(function* () {
    if (actor.kind === 'system') return { kind: 'system' } as const
    const reach = yield* threadReachOf(app, target.table, actor.userId, target.recordId)
    if (reach === undefined || !reach.mayComment) return undefined
    return { kind: 'session', session: reach.session, userRole: reach.role } as const
  })

/** The step's outcome for a post the comment sequence refused or could not complete. */
const postFailure = (error: unknown): ActionOutcome => {
  if (error instanceof NestedCommentReplyError) return commentFailure('create', error.message)
  if (error instanceof Error && error.name === 'NotFoundError') return COMMENT_REFUSAL
  logError('[automations] comment.create could not write the comment', error)
  return commentFailure('create', 'the comment could not be written')
}

/** Announce a published comment through the run's channel, one automation write deeper. */
const announceThrough = (runContext: ActionRunContext | undefined) => (event: PostedCommentEvent) =>
  Effect.sync(() => runContext?.recordEvents?.comments?.dispatch(event))

/**
 * The step's thread, once its content and the depth limit allow a post, or the
 * failure that stops it before anything is judged or written.
 */
const preflight = (
  app: App,
  props: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): CommentTarget | ActionOutcome => {
  const target = commentTargetOf('create', app, props)
  if ('status' in target) return target
  const refused = contentRefusal(stringProp(props, 'content'))
  if (refused !== undefined) return commentFailure('create', refused)
  const loop = runContext?.recordEvents?.comments?.refusal(target.table.name)
  return loop === undefined ? target : { status: 'failure', error: loop, retryable: false }
}

export const handleCommentCreate: ActionHandler = (action, app, automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const target = preflight(app, props, runContext)
    if ('status' in target) return target
    const actor = commentActorOf(props, automation)
    const author = actor === undefined ? undefined : yield* authorOf(app, target, actor)
    if (author === undefined) return COMMENT_REFUSAL
    const parent = stringProp(props, 'parentCommentId').trim()
    const posted = yield* Effect.result(
      postCommentProgram({
        ...{ app, table: target.table, tableId: target.table.name, recordId: target.recordId },
        content: stringProp(props, 'content'),
        parentCommentId: parent === '' ? undefined : parent,
        mentions: mentionsOf(props),
        author,
        announce: announceThrough(runContext),
      })
    )
    if (posted._tag === 'Failure') return postFailure(posted.failure)
    const { comment } = posted.success
    return {
      status: 'success',
      output: { id: comment.id, status: comment.status, parentCommentId: comment.parentCommentId },
    } as const
  }).pipe(
    Effect.withSpan('automations.handle-comment-create', { attributes: actionAttributes(action) })
  )
