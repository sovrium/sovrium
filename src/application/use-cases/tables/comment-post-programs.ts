/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Posting a comment on a record's thread — the one sequence behind both the
 * comments API (`POST /api/tables/:table/records/:id/comments`) and the
 * `comment` `create` automation step.
 *
 * Once a caller may post, the sequence is the same whoever posts:
 *
 *   1. a reply must answer a top-level comment of THIS thread — a parent that
 *      is missing or on another record fails as a missing one, and a reply to a
 *      reply is refused for its nesting;
 *   2. the comment is stored with its moderation verdict;
 *   3. the people it mentions are resolved, keeping only those who can read
 *      the record;
 *   4. a published comment is announced to the table's comment automations.
 *
 * What differs stays with each caller: the comments API runs its sign-in,
 * read, honeypot, rate-limit and spam gates first and hands in the verdict
 * they reach; an automation step judges its caller with the permission rules
 * and lets the table's moderation alone decide. Who writes it is
 * {@link CommentAuthor}: a session (a person, a visitor) or the app itself —
 * the system writes with no author account, and is never "authenticated" for
 * the moderation policy, so a manually moderated table queues its comment.
 */

import { Data, Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { NotFoundError } from '@/domain/errors'
import { isAuthenticatedSession, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import {
  resolveCommentModerationStatus,
  type CommentModerationConfig,
} from '@/domain/models/app/tables/comment-moderation-policy'
import { logError } from '@/infrastructure/logging/logger'
import { announceCommentChange } from './comment-change-programs'
import { resolveCreatedCommentMentions, type CommentMention } from './comment-mention-programs'
import { createCommentProgram, type CreatedCommentWithGuestEmail } from './comment-programs'
import type { UserMetadataWithOptionalImage } from '@/application/ports/contracts/user-metadata'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { TriggerCommentEventInput } from '@/application/use-cases/automations/trigger-comment-event'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'

/** A reply was aimed at a reply: threads are one level deep. */
export class NestedCommentReplyError extends Data.TaggedError('NestedCommentReplyError')<{
  readonly message: string
}> {}

/** Who writes the comment. */
export type CommentAuthor =
  | { readonly kind: 'system' }
  | {
      readonly kind: 'session'
      readonly session: Readonly<UserSession>
      /** The writer's role, as the comment trigger's read gate judges it. */
      readonly userRole: string
    }

/** A published comment, as the comment triggers read it. */
export type PostedCommentEvent = Omit<TriggerCommentEventInput, 'app' | 'processEnv' | 'depth'>

/** The comment moderation verdicts a stored comment can carry. */
export type CommentVerdict = 'approved' | 'pending' | 'rejected'

export interface PostCommentInput<R> {
  readonly app: App
  readonly table: Table
  /** The key the thread is addressed by — the table's name, or its id as a URL named it. */
  readonly tableId: string
  readonly recordId: string
  readonly content: string
  readonly parentCommentId?: string | undefined
  /** Ids mentioned besides the `@[<user id>]` markup of `content`. */
  readonly mentions: readonly string[]
  readonly guestName?: string | undefined
  readonly guestEmail?: string | undefined
  readonly author: CommentAuthor
  /** The caller's verdict (the API's spam and moderation gates); omitted, the moderation policy alone. */
  readonly status?: CommentVerdict
  /** Where a published comment is announced: run now (the API) or in the background (a step). */
  readonly announce: (event: PostedCommentEvent) => Effect.Effect<void, never, R>
}

export interface PostedComment {
  readonly comment: CreatedCommentWithGuestEmail
  /** The author with their email, for server-side consumers only — never the wire. */
  readonly author: UserMetadataWithOptionalImage | undefined
  /** The mentioned people who can read the record. */
  readonly mentioned: {
    readonly ids: readonly string[]
    readonly mentions: readonly CommentMention[]
  }
}

const sessionOf = (author: CommentAuthor): Readonly<UserSession> =>
  author.kind === 'system' ? buildSystemSession() : author.session

/** A stored comment belongs to the thread when it was written on this record of this table. */
const isInThread = (
  parent: Readonly<{ tableId: string; recordId: string }>,
  input: Pick<PostCommentInput<never>, 'table' | 'tableId' | 'recordId'>
): boolean =>
  new Set([input.tableId, String(input.table.id), input.table.name]).has(String(parent.tableId)) &&
  String(parent.recordId) === input.recordId

/**
 * Refuse a reply whose parent is not a top-level comment of this thread.
 *
 * A parent that names no comment, or a comment on ANOTHER record, fails as a
 * missing one — the same failure either way, so the answer never tells which
 * comment ids exist elsewhere. A lookup that fails is logged and refused the
 * same way: the reply is refused either way, and the refusal must not differ.
 */
const checkReplyParent = <R>(
  input: PostCommentInput<R>,
  session: Readonly<UserSession>
): Effect.Effect<void, NotFoundError | NestedCommentReplyError, CommentRepository> =>
  Effect.gen(function* () {
    const { parentCommentId } = input
    if (parentCommentId === undefined) return
    const repo = yield* CommentRepository
    const lookup = yield* Effect.result(repo.getWithUser({ session, commentId: parentCommentId }))
    if (lookup._tag === 'Failure') {
      logError('[comments] reply-parent lookup failed', lookup.failure)
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }
    const parent = lookup.success
    if (parent === undefined || !isInThread(parent, input)) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }
    if (parent.parentId !== null) {
      return yield* new NestedCommentReplyError({
        message:
          'Cannot reply to a reply — parentCommentId must reference a top-level comment (single-level threading)',
      })
    }
  })

/** The verdict a comment is stored with: the caller's, or the table's moderation policy alone. */
const verdictOf = <R>(input: PostCommentInput<R>, session: Readonly<UserSession>): CommentVerdict =>
  input.status ??
  resolveCommentModerationStatus((input.table.comments ?? {}) as CommentModerationConfig, {
    isAuthenticated: input.author.kind === 'session' && isAuthenticatedSession(session.userId),
    priorApprovedCommentExists: false,
  })

/**
 * The people the new comment mentions who can read the record. The comment is
 * already stored when this runs, so a failed lookup must not turn the post into
 * a failure: it fails CLOSED — nobody is mentioned — and says so in the log.
 */
const mentionedReadersOf = <R>(input: PostCommentInput<R>, session: Readonly<UserSession>) =>
  resolveCreatedCommentMentions(
    { app: input.app, table: input.table, recordId: input.recordId, session },
    input.content,
    input.mentions
  ).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[comments] mention audience lookup failed; the comment mentions nobody', cause)
      )
    ),
    // effect-swallow: the comment is stored; failing closed mentions nobody rather than failing the post.
    Effect.orElseSucceed(() => ({ ids: [] as readonly string[], mentions: [] }))
  )

/**
 * The trigger event of a published comment, or `undefined` when nothing is
 * announced: a comment awaiting moderation (or rejected) is not yet part of the
 * thread, and a visitor's comment has no account the trigger could name.
 */
const eventOf = <R>(
  input: PostCommentInput<R>,
  session: Readonly<UserSession>,
  posted: Omit<PostedComment, 'mentioned'> & { readonly mentionIds: readonly string[] }
): PostedCommentEvent | undefined => {
  const { comment, author } = posted
  if (comment.status !== 'approved') return undefined
  if (input.author.kind === 'session' && author === undefined) return undefined
  return {
    tableName: input.table.name,
    tableId: input.tableId,
    recordId: input.recordId,
    session,
    userRole: input.author.kind === 'system' ? SYSTEM_USER_ID : input.author.userRole,
    comment: {
      id: comment.id,
      body: comment.content,
      parentCommentId: comment.parentCommentId,
      createdAt: new Date(comment.createdAt),
      status: comment.status,
    },
    author:
      input.author.kind === 'system' || author === undefined
        ? null
        : { id: author.id, email: author.email, name: author.name },
    mentions: posted.mentionIds,
  }
}

/** Post one comment on a record's thread: see the module doc for the sequence. */
export const postCommentProgram = <R>(
  input: PostCommentInput<R>
): Effect.Effect<
  PostedComment,
  DatabaseError | NotFoundError | NestedCommentReplyError,
  CommentRepository | Effect.Services<ReturnType<typeof resolveCreatedCommentMentions>> | R
> =>
  Effect.gen(function* () {
    const session = sessionOf(input.author)
    yield* checkReplyParent(input, session)
    const created = yield* createCommentProgram({
      session,
      tableId: input.tableId,
      recordId: input.recordId,
      tableName: input.table.name,
      content: input.content,
      parentCommentId: input.parentCommentId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      status: verdictOf(input, session),
      ...(input.author.kind === 'system' ? { actor: 'system' as const } : {}),
    })
    yield* announceCommentChange({
      ...{ appId: input.app.name, table: input.table.name, recordId: input.recordId },
      ...{ commentId: created.comment.id, event: 'created', status: created.comment.status },
      authorId: created.comment.userId,
    })
    const mentioned = yield* mentionedReadersOf(input, session)
    const event = eventOf(input, session, { ...created, mentionIds: mentioned.ids })
    if (event !== undefined) yield* input.announce(event)
    return { ...created, mentioned }
  }).pipe(
    Effect.withSpan('tables.post-comment-program', {
      attributes: { 'table.name': input.table.name, 'comment.author': input.author.kind },
    })
  )
