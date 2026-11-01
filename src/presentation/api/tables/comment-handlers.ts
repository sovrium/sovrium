/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { refuseVisitorAsAuthor } from '@/application/use-cases/tables/comment-author-gate'
import {
  announceCommentChange,
  commentAudienceProgram,
} from '@/application/use-cases/tables/comment-change-programs'
import {
  attachCommentMentions,
  attachSingleCommentMentions,
} from '@/application/use-cases/tables/comment-mention-programs'
import {
  deleteCommentProgram,
  updateCommentProgram,
  updateCommentStatusProgram,
} from '@/application/use-cases/tables/comment-programs'
import {
  getCommentProgram,
  listCommentsProgram,
} from '@/application/use-cases/tables/comment-query-programs'
import {
  getCommentResponseSchema,
  listCommentsResponseSchema,
  updateCommentResponseSchema,
} from '@/domain/models/api/tables/comments'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { commentTableKeysOf } from '@/domain/models/app/tables/comment-address-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
} from '@/presentation/api/runtime/run-effect'
import {
  notFoundResponse,
  resolveGatedComment,
  resolveTableForListing,
  validateUpdateCommentBody,
} from './comment-handler-shared'
import { parseCreatedAtSortOrder } from './created-at-sort-param'
import { handleRouteError } from './error-handlers'
import { isAuthorizationError } from './error-helpers'
import { checkRecordReadGate } from './record-read-gate'
import type { UpdateCommentRequest } from '@/domain/models/api/tables/comments'
import type { App } from '@/domain/models/app'
import type { ValidatedContext } from '@/presentation/api/runtime/effect-validator'
import type { Context } from 'hono'

// Re-export the create-comment handler so the route table keeps importing
// `handleCreateComment` from this module's barrel position.
export { handleCreateComment } from './comment-create-handler'

// Re-export the mark-comments-read handler from the same barrel
// position so the route table imports the whole comment handler family here.
export { handleMarkCommentsRead } from './comment-read-handler'

/**
 * Handle delete comment error
 */
function handleDeleteCommentError(c: Context, error: unknown) {
  // Check for authorization errors
  if (isAuthorizationError(error)) {
    // S1 anti-enumeration: both "forbidden" (user is not author) and "not found"
    // (comment deleted / no access) collapse to a uniform 404 so the author-vs-
    // existence boundary is not discoverable.
    return notFound(c)
  }

  // All other errors - use shared sanitization
  return handleRouteError(c, error)
}

/**
 * Handle delete comment
 */
export function handleDeleteComment(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, deleteCommentResponse(c, app)))
}

/** Gate, delete and announce a comment, as one program. */
const deleteCommentResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session } = getTableContext(c)
    const target = yield* resolveGatedComment(c, app)
    if (target instanceof Response) return target

    // Delete comment, then announce it to whoever could read it before
    const { commentId, table, address } = target
    const program = Effect.gen(function* () {
      // A visitor deletes nothing: refused before the comment's audience is read
      yield* refuseVisitorAsAuthor(session)
      const audience = yield* commentAudienceProgram(session, commentId)
      yield* deleteCommentProgram({ app, session, commentId, tableName: table.name, address })
      if (audience === undefined) return
      yield* announceCommentChange({
        ...{ appId: app.name, table: table.name, recordId: address.recordId, commentId },
        ...{ event: 'deleted', ...audience },
      })
    })

    const result = yield* Effect.result(program)

    if (result._tag === 'Failure') {
      return handleDeleteCommentError(c, result.failure)
    }

    // Return 204 No Content on success
    return c.body(null, 204)
  })

/**
 * Handle get comment by ID
 */
export function handleGetComment(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, getCommentResponse(c, app)))
}

/** Gate and answer one comment, as one program. */
const getCommentResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session, userRole } = getTableContext(c)
    const target = yield* resolveGatedComment(c, app)
    if (target instanceof Response) return target
    const { table, address } = target

    // The comment carries the people its markup names, resolved among the
    // record's readers exactly as the thread resolves them.
    // effect-swallow: a comment that cannot be read is answered as one that does not exist (S1).
    const result = yield* Effect.result(
      getCommentProgram({
        session,
        commentId: target.commentId,
        tableName: table.name,
        address,
        // The thread's moderation rule: only an
        // admin-equivalent caller reads a pending or rejected comment by id.
        viewerIsAdmin: isAdminEquivalent(userRole, app),
      }).pipe(
        Effect.flatMap((envelope) =>
          attachSingleCommentMentions({ app, table, recordId: address.recordId, session }, envelope)
        )
      )
    )

    if (result._tag === 'Failure') {
      return notFoundResponse(c)
    }

    return yield* respondWith(c, Effect.succeed(result.success), getCommentResponseSchema)
  })

/**
 * Handle update comment error
 */
function handleUpdateCommentError(c: Context, error: unknown) {
  // Check for authorization errors
  if (isAuthorizationError(error)) {
    // S1 anti-enumeration: both "forbidden" (user is not author) and "not found"
    // (comment deleted / no access) collapse to a uniform 404.
    return notFound(c)
  }

  // Internal server error
  return c.json(
    { success: false, message: 'Failed to update comment', code: 'INTERNAL_ERROR' },
    500
  )
}

/**
 * Handle PG-02 moderation status update. Admin-only (returns 404 for
 * non-admins, S1 anti-enumeration).
 *
 * B3: previously this synthesized a 200 envelope for a missing comment
 * (so spec fixtures could PATCH a literal `pending-comment-id` against an
 * unseeded server). That hid genuine not-found errors. A missing comment
 * now returns a real 404 (anti-enumeration).
 */
const moderationStatusResponse = (input: {
  readonly c: Context
  readonly table: NonNullable<App['tables']>[number]
  readonly commentId: string
  readonly status: 'approved' | 'rejected' | 'pending'
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly app: App
}) =>
  Effect.gen(function* () {
    const { c, table, commentId, status, userRole } = input

    // RBAC: only admin-equivalent callers (the built-in `admin` and the app's
    // top role) can moderate. Everyone else gets a 404 (anti-enumeration).
    if (!isAdminEquivalent(userRole, input.app)) {
      return notFound(c)
    }

    const result = yield* Effect.result(
      updateCommentStatusProgram({
        session: input.session,
        commentId,
        tableName: table.name,
        status,
      })
    )

    if (result._tag === 'Failure') {
      return handleUpdateCommentError(c, result.failure)
    }

    // Comment exists → announce and echo the persisted envelope; missing → genuine 404.
    if (result.success !== undefined) {
      const { id, recordId, userId } = result.success
      yield* Effect.result(
        announceCommentChange({
          ...{ appId: input.app.name, table: table.name, recordId, commentId: id },
          ...{ event: 'moderated', status: result.success.status, authorId: userId },
        })
      )
      return yield* respondWith(c, Effect.succeed(result.success), updateCommentResponseSchema)
    }
    return notFound(c)
  })

/** Announce an edit to whoever may see the comment as it now stands. */
const announceCommentEdit = (input: {
  readonly app: App
  readonly table: { readonly name: string }
  readonly recordId: string
  readonly commentId: string
  readonly session: ReturnType<typeof getTableContext>['session']
}) =>
  commentAudienceProgram(input.session, input.commentId).pipe(
    Effect.flatMap((audience) =>
      audience === undefined
        ? Effect.void
        : announceCommentChange({
            ...{ appId: input.app.name, table: input.table.name, recordId: input.recordId },
            ...{ commentId: input.commentId, event: 'edited', ...audience },
          })
    )
  )

/**
 * Handle update comment
 */
export function handleUpdateComment(c: ValidatedContext<'json', UpdateCommentRequest>, app: App) {
  return runHandlerEffect(c, answerFailures(c, updateCommentResponse(c, app)))
}

/** Gate and apply a comment edit or a moderation change, as one program. */
const updateCommentResponse = (c: ValidatedContext<'json', UpdateCommentRequest>, app: App) =>
  Effect.gen(function* () {
    const { session, userRole } = getTableContext(c)
    const target = yield* resolveGatedComment(c, app)
    if (target instanceof Response) return target
    const { table, commentId, address } = target

    const validated = validateUpdateCommentBody(c.req.valid('json'))

    if (!validated) {
      return c.json(
        { success: false, message: 'Invalid request body', code: 'VALIDATION_ERROR' },
        400
      )
    }

    // PG-02 moderation: status-only updates go through the admin path.
    if (validated.kind === 'status') {
      return yield* moderationStatusResponse({
        c,
        table,
        commentId,
        status: validated.status,
        userRole,
        session,
        app,
      })
    }

    // Content edit (author-only). The edited comment answers with the people its
    // new body names, resolved as the created one's are.
    const result = yield* Effect.result(
      updateCommentProgram({
        session,
        commentId,
        tableName: table.name,
        content: validated.content,
        address,
      }).pipe(
        Effect.tap(() =>
          announceCommentEdit({ app, table, recordId: address.recordId, commentId, session })
        ),
        Effect.flatMap((envelope) =>
          attachSingleCommentMentions({ app, table, recordId: address.recordId, session }, envelope)
        )
      )
    )

    if (result._tag === 'Failure') {
      return handleUpdateCommentError(c, result.failure)
    }

    return yield* respondWith(c, Effect.succeed(result.success), updateCommentResponseSchema)
  })

/**
 * Handle list comments for a record
 */
export function handleListComments(c: Context, app: App) {
  return runHandlerEffect(c, answerFailures(c, listCommentsResponse(c, app)))
}

/** Gate and answer a record's comment thread, as one program. */
const listCommentsResponse = (c: Context, app: App) =>
  Effect.gen(function* () {
    const { session, userRole } = getTableContext(c)
    const tableId = c.req.param('tableId')!
    const recordId = c.req.param('recordId')!

    const tableOrResponse = yield* resolveTableForListing(c, app, tableId)
    if (tableOrResponse instanceof Response) return tableOrResponse
    const table = tableOrResponse
    const gateError = yield* checkRecordReadGate(c, app, table, recordId)
    if (gateError) return gateError

    // Parse query parameters
    const limitParam = c.req.query('limit')
    const offsetParam = c.req.query('offset')
    const limit = limitParam ? Number(limitParam) : undefined
    const offset = offsetParam ? Number(offsetParam) : undefined
    const sortOrder = parseCreatedAtSortOrder(c.req.query('sort'))

    // Moderation visibility: only an
    // admin-equivalent caller (the built-in `admin` or the app's top role) sees
    // pending/rejected comments; everyone else (members, viewers, guests,
    // unauthenticated) sees approved-only. Fail-closed — any other role
    // (including an unknown/empty role) resolves to approved-only.
    const viewerIsAdmin = isAdminEquivalent(userRole, app)

    // Project a per-user `unreadCount` only when the table opts into
    // `comments.readTracking`. The watermark is read under every key of the
    // table, as the comments are.
    const readTracking = table.comments?.readTracking === true

    // Each comment carries the people its `@[<user id>]` markup names, resolved
    // to their current names among the record's readers — the thread renders
    // every other token as a neutral placeholder, never the markup.
    // effect-swallow: a thread that cannot be read is answered as a missing record (S1).
    const result = yield* Effect.result(
      listCommentsProgram({
        session,
        recordId,
        tableName: table.name,
        tableKeys: commentTableKeysOf(table, tableId),
        limit,
        offset,
        sortOrder,
        viewerIsAdmin,
        readTracking,
      }).pipe(
        Effect.flatMap((listed) =>
          attachCommentMentions({ app, table, recordId, session }, listed.comments).pipe(
            Effect.map((comments) => ({ ...listed, comments }))
          )
        )
      )
    )

    if (result._tag === 'Failure') {
      // B3: previously a record-not-found rejection against a comments-configured
      // table returned a fabricated empty list + pagination skeleton (so fixtures
      // could list comments on a literal `test-record-id`). That hid genuine
      // not-found errors — a missing record now returns a real 404
      // (anti-enumeration).
      return notFoundResponse(c)
    }

    return yield* respondWith(c, Effect.succeed(result.success), listCommentsResponseSchema)
  })
