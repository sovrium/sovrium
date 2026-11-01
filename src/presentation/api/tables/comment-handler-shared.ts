/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { tableEffectiveRoles } from '@/application/use-cases/tables/user-groups'
import { hasReadPermissionForRoles } from '@/domain/models/app/auth/permission-evaluator-service'
import { commentTableKeysOf } from '@/domain/models/app/tables/comment-address-service'
import { findTableByIdOrName } from '@/domain/models/app/tables/table-lookup-service'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { getTableContext } from '@/presentation/api/runtime/context-helpers'
import { checkRecordReadGate } from './record-read-gate'
import { resolveAccessRolesFor } from './row-level-guard'
import type { UpdateCommentRequest } from '@/domain/models/api/tables/comments'
import type { App } from '@/domain/models/app'
import type { CommentAddress } from '@/domain/models/app/tables/comment-address-service'
import type { Context } from 'hono'

/**
 * Uniform 404 envelope. Used by the comment handlers for both genuine
 * "not found" and S1 anti-enumeration "access denied" cases so the
 * author-vs-existence boundary is not discoverable.
 */
export function notFoundResponse(c: Context): Response {
  return notFound(c)
}

/**
 * The effective roles the records route asks of the caller on `table`: her
 * account role, her `group:<name>` memberships and — on a table with row-level
 * rules — her assignment roles, all resolved for this request.
 */
export const callerRolesOnTable = (c: Context, table: NonNullable<App['tables']>[number]) => {
  const { session, userRole, userGroups } = getTableContext(c)
  return Effect.map(resolveAccessRolesFor(session, [table]), (accessRoles): readonly string[] =>
    tableEffectiveRoles(table, { role: userRole, groups: userGroups, accessRoles })
  )
}

/**
 * Resolve the bound table for a comment read and enforce the records route's
 * own read gate on it. Returns the table on success, or the uniform 404 (S1
 * anti-enumeration — "not found" and "read denied" collapse to one response).
 *
 * Shared by the comment list and the mention picker's candidate source, so the
 * picker can never be reachable on a table whose thread is not.
 */
export const resolveTableForListing = (c: Context, app: App, tableId: string) => {
  const table = findTableByIdOrName(app.tables, tableId)
  if (!table) return Effect.succeed(notFoundResponse(c))
  return Effect.map(callerRolesOnTable(c, table), (roles) =>
    hasReadPermissionForRoles(table, roles, app) ? table : notFoundResponse(c)
  )
}

/** A single-comment route's target, once its record has passed the read gate. */
interface GatedCommentTarget {
  readonly table: NonNullable<App['tables']>[number]
  readonly commentId: string
  readonly address: CommentAddress
}

/**
 * Resolve the table, record and comment a single-comment route addresses, and
 * gate the caller on that record exactly as a read of it is gated.
 *
 * The comment programs then refuse any comment that was not written on this
 * record, so the gate always judges the record the comment belongs to — never
 * a readable record named in the URL to reach a comment on a hidden one. Every
 * refusal is the missing-record 404.
 */
export const resolveGatedComment = (c: Context, app: App) =>
  Effect.gen(function* () {
    const tableId = c.req.param('tableId')!
    const recordId = c.req.param('recordId')!
    const table = findTableByIdOrName(app.tables, tableId)
    if (!table) return notFoundResponse(c)
    const gateError = yield* checkRecordReadGate(c, app, table, recordId)
    if (gateError) return gateError
    const target: GatedCommentTarget = {
      table,
      commentId: c.req.param('commentId')!,
      address: { recordId, tableKeys: commentTableKeysOf(table) },
    }
    return target
  })

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
export function validateUpdateCommentBody(
  body: UpdateCommentRequest
): ValidatedUpdateBody | undefined {
  if (body.status !== undefined) return { kind: 'status', status: body.status }
  return isValidEditContent(body.content) ? { kind: 'content', content: body.content } : undefined
}
