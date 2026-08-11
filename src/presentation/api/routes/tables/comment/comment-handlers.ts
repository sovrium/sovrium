/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  deleteCommentProgram,
  getCommentProgram,
  listCommentsProgram,
  updateCommentProgram,
  updateCommentStatusProgram,
} from '@/application/use-cases/tables/comment-programs'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { hasReadPermission } from '@/domain/validators/permission-evaluators'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { getTableContext } from '@/presentation/api/utils/context-helpers'
import { handleRouteError } from '../error-handlers'
import { isAuthorizationError } from '../utils'
import { notFoundResponse } from './comment-handler-shared'
import type { App } from '@/domain/models/app'
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
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // All other errors - use shared sanitization
  return handleRouteError(c, error)
}

/**
 * Handle delete comment
 */
export async function handleDeleteComment(c: Context, app: App) {
  const { session } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  // Find table by ID OR name (validateTable middleware accepts both)
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Delete comment
  const program = deleteCommentProgram({
    session,
    commentId,
    tableName: table.name,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return handleDeleteCommentError(c, result.left)
  }

  // Return 204 No Content on success
  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for 204 No Content
  return c.body(null, 204)
}

/**
 * Handle get comment by ID
 */
export async function handleGetComment(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  // Find table by ID OR name (validateTable middleware accepts both)
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Check read permission
  if (!hasReadPermission(table, userRole, app.tables)) {
    // S1 anti-enumeration: read-permission denial returns 404.
    return c.json(
      {
        success: false,
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
      404
    )
  }

  // Get comment
  const program = getCommentProgram({
    session,
    commentId,
    tableName: table.name,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json(result.right, 200)
}

/**
 * Validated update-comment body. Either `content` (author edit) or
 * `status` (admin moderation action) — exactly one is required.
 */
type ValidatedUpdateBody =
  | { readonly kind: 'content'; readonly content: string }
  | { readonly kind: 'status'; readonly status: 'approved' | 'rejected' | 'pending' }

/**
 * `true` when `status` is one of the three published moderation states.
 */
function isModerationStatus(status: string): status is 'approved' | 'rejected' | 'pending' {
  return status === 'approved' || status === 'rejected' || status === 'pending'
}

/**
 * `true` when `content` is a non-empty string within the 10,000-char bound.
 */
function isValidEditContent(content: unknown): content is string {
  return typeof content === 'string' && content.length > 0 && content.length <= 10_000
}

/**
 * Validate update comment request body. Supports both content edits
 * (author-only) and status updates (PG-02 moderation, admin-only).
 */
function validateUpdateCommentBody(body: unknown): ValidatedUpdateBody | undefined {
  if (typeof body !== 'object' || body === null || body === undefined) {
    return undefined
  }

  const { content, status } = body as Record<string, unknown>

  // Status-only update (PG-02 moderation queue): admin flips moderation state.
  if (typeof status === 'string') {
    return isModerationStatus(status) ? { kind: 'status', status } : undefined
  }

  // Content-only update (author edit).
  return isValidEditContent(content) ? { kind: 'content', content } : undefined
}

/**
 * Handle update comment error
 */
function handleUpdateCommentError(c: Context, error: unknown) {
  // Check for authorization errors
  if (isAuthorizationError(error)) {
    // S1 anti-enumeration: both "forbidden" (user is not author) and "not found"
    // (comment deleted / no access) collapse to a uniform 404.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
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
}): Promise<Response> {
  const { c, table, commentId, status, userRole } = input

  // RBAC: only admins can moderate. Non-admins get a 404 (anti-enumeration).
  if (!isAdminRole(userRole)) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const result = await runTableProgram(
    updateCommentStatusProgram({
      session: input.session,
      commentId,
      tableName: table.name,
      status,
    })
  )

  if (result._tag === 'Left') {
    return handleUpdateCommentError(c, result.left)
  }

  // Comment exists → echo the persisted envelope; missing → genuine 404.
  if (result.right !== undefined) {
    return c.json(result.right, 200)
  }
  return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
}

/**
 * Handle update comment
 */
export async function handleUpdateComment(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const commentId = c.req.param('commentId')!

  // Find table by ID OR name (validateTable middleware accepts both)
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
  if (!table) {
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  // Parse and validate request body
  const body = await c.req.json().catch(() => undefined)
  const validated = validateUpdateCommentBody(body)

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
    })
  }

  // Content edit (author-only).
  const program = updateCommentProgram({
    session,
    commentId,
    tableName: table.name,
    content: validated.content,
  })

  const result = await runTableProgram(program)

  if (result._tag === 'Left') {
    return handleUpdateCommentError(c, result.left)
  }

  return c.json(result.right, 200)
}

/**
 * Parse sort query parameter (e.g., "createdAt:asc" or "createdAt:desc")
 */
function parseSortOrder(sortParam: string | undefined): 'asc' | 'desc' | undefined {
  if (!sortParam) {
    return undefined
  }

  const [field, order] = sortParam.split(':')
  if (field === 'createdAt' && (order === 'asc' || order === 'desc')) {
    return order
  }

  return undefined
}

/**
 * Resolve the bound table for a list/read request and enforce the
 * role-based read permission. Returns the table on success, or a Hono
 * 404 response (S1 anti-enumeration — both "not found" and
 * "read denied" collapse to the same response). Extracted to keep
 * `handleListComments` under the function-size limits.
 */
function resolveTableForListing(
  c: Context,
  app: App,
  tableId: string,
  userRole: string
): NonNullable<App['tables']>[number] | Response {
  const table = app.tables?.find((t) => String(t.id) === String(tableId) || t.name === tableId)
  if (!table || !hasReadPermission(table, userRole, app.tables)) {
    return notFoundResponse(c)
  }
  return table
}

/**
 * Handle list comments for a record
 */
export async function handleListComments(c: Context, app: App) {
  const { session, userRole } = getTableContext(c)
  const tableId = c.req.param('tableId')!
  const recordId = c.req.param('recordId')!

  const tableOrResponse = resolveTableForListing(c, app, tableId, userRole)
  if (tableOrResponse instanceof Response) return tableOrResponse
  const table = tableOrResponse

  // Parse query parameters
  const limitParam = c.req.query('limit')
  const offsetParam = c.req.query('offset')
  const limit = limitParam ? Number(limitParam) : undefined
  const offset = offsetParam ? Number(offsetParam) : undefined
  const sortOrder = parseSortOrder(c.req.query('sort'))

  // Moderation visibility: only admins see
  // pending/rejected comments; everyone else (members, viewers, guests,
  // unauthenticated) sees approved-only. Fail-closed — any non-'admin' role
  // (including an unknown/empty role) resolves to approved-only.
  const viewerIsAdmin = isAdminRole(userRole)

  // [internal ref]: project a per-user `unreadCount` only when the table opts into
  // `comments.readTracking`. Thread the raw `:tableId` so the read-state
  // watermark is scoped to the same (user, table, record) identity comments
  // are stored under.
  const readTracking = table.comments?.readTracking === true

  const result = await runTableProgram(
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
    })
  )

  if (result._tag === 'Left') {
    // B3: previously a record-not-found rejection against a comments-configured
    // table returned a fabricated empty list + pagination skeleton (so fixtures
    // could list comments on a literal `test-record-id`). That hid genuine
    // not-found errors — a missing record now returns a real 404
    // (anti-enumeration).
    return notFoundResponse(c)
  }

  return c.json(result.right, 200)
}
