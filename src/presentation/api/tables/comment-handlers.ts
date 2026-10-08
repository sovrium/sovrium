/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  attachCommentMentions,
  attachSingleCommentMentions,
} from '@/application/use-cases/tables/comment-mention-programs'
import {
  deleteCommentProgram,
  getCommentProgram,
  listCommentsProgram,
  updateCommentProgram,
  updateCommentStatusProgram,
} from '@/application/use-cases/tables/comment-programs'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import {
  notFoundResponse,
  resolveGatedComment,
  resolveTableForListing,
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
export async function handleDeleteComment(c: Context, app: App) {
  const { session } = getTableContext(c)
  const target = await resolveGatedComment(c, app)
  if (target instanceof Response) return target

  // Delete comment
  const program = deleteCommentProgram({
    app,
    session,
    commentId: target.commentId,
    tableName: target.table.name,
    address: target.address,
  })

  const result = await runOnRequest(c, program)

  if (result._tag === 'Failure') {
    return handleDeleteCommentError(c, result.failure)
  }

  // Return 204 No Content on success
  return c.body(null, 204)
}

/**
 * Handle get comment by ID
 */
export async function handleGetComment(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const target = await resolveGatedComment(c, app)
  if (target instanceof Response) return target
  const { table, address } = target

  // The comment carries the people its markup names, resolved among the
  // record's readers exactly as the thread resolves them.
  const result = await runOnRequest(
    c,
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

  return c.json(result.success, 200)
}

/**
 * The update a PATCH resolves to: a `content` edit by the author, or a
 * `status` change by a moderator.
 */
type ValidatedUpdateBody =
  | { readonly kind: 'content'; readonly content: string }
  | { readonly kind: 'status'; readonly status: 'approved' | 'rejected' | 'pending' }

/**
 * `true` when `content` is a non-empty string within the 10,000-char bound.
 */
function isValidEditContent(content: unknown): content is string {
  return typeof content === 'string' && content.length > 0 && content.length <= 10_000
}

/**
 * Resolve which update the decoded body asks for.
 *
 * `updateCommentRequestSchema` has already guaranteed that `status`, when
 * present, is one of the three moderation states, and that a body without one
 * carries a non-empty `content`. A status wins when both are sent. The
 * 10,000-character cap on an edited body is the one rule the schema does not
 * carry, so it is checked here.
 */
function validateUpdateCommentBody(body: UpdateCommentRequest): ValidatedUpdateBody | undefined {
  if (body.status !== undefined) return { kind: 'status', status: body.status }
  return isValidEditContent(body.content) ? { kind: 'content', content: body.content } : undefined
}

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
async function handleModerationStatusUpdate(input: {
  readonly c: Context
  readonly table: NonNullable<App['tables']>[number]
  readonly commentId: string
  readonly status: 'approved' | 'rejected' | 'pending'
  readonly userRole: string
  readonly session: ReturnType<typeof getTableContext>['session']
  readonly app: App
}): Promise<Response> {
  const { c, table, commentId, status, userRole } = input

  // RBAC: only admin-equivalent callers (the built-in `admin` and the app's
  // top role) can moderate. Everyone else gets a 404 (anti-enumeration).
  if (!isAdminEquivalent(userRole, input.app)) {
    return notFound(c)
  }

  const result = await runOnRequest(
    c,
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

  // Comment exists → echo the persisted envelope; missing → genuine 404.
  if (result.success !== undefined) {
    return c.json(result.success, 200)
  }
  return notFound(c)
}

/**
 * Handle update comment
 */
export async function handleUpdateComment(
  c: ValidatedContext<'json', UpdateCommentRequest>,
  app: App
) {
  const { session, userRole } = getTableContext(c)
  const target = await resolveGatedComment(c, app)
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
    return handleModerationStatusUpdate({
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
  const result = await runOnRequest(
    c,
    updateCommentProgram({
      session,
      commentId,
      tableName: table.name,
      content: validated.content,
      address,
    }).pipe(
      Effect.flatMap((envelope) =>
        attachSingleCommentMentions({ app, table, recordId: address.recordId, session }, envelope)
      )
    )
  )

  if (result._tag === 'Failure') {
    return handleUpdateCommentError(c, result.failure)
  }

  return c.json(result.success, 200)
}

/**
 * Handle list comments for a record
 */
export async function handleListComments(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  const tableOrResponse = await resolveTableForListing(c, app, tableId)
  if (tableOrResponse instanceof Response) return tableOrResponse
  const table = tableOrResponse
  const gateError = await checkRecordReadGate(c, app, table, recordId)
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
  // `comments.readTracking`. Thread the raw `:tableId` so the read-state
  // watermark is scoped to the same (user, table, record) identity comments
  // are stored under.
  const readTracking = table.comments?.readTracking === true

  // Each comment carries the people its `@[<user id>]` markup names, resolved
  // to their current names among the record's readers — the thread renders
  // every other token as a neutral placeholder, never the markup.
  const result = await runOnRequest(
    c,
    listCommentsProgram({
      session,
      recordId,
      tableName: table.name,
      tableId,
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

  return c.json(result.success, 200)
}
