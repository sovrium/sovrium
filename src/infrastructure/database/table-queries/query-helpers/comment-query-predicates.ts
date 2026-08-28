/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq, and, isNull } from 'drizzle-orm'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/** Active (non-deleted) comment by ID */
export function activeCommentById(commentId: string) {
  return and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt))
}

/**
 * Active (non-deleted) comments on one record OF ONE TABLE.
 *
 * The `table_id` clause is load-bearing, not decoration. Record ids are
 * PER-TABLE sequences, so record `1` exists in every table of an app — keying
 * a comment thread on `record_id` alone resolves the comments of every
 * same-numbered record in the app. That leaked one table's commenter
 * identities (and, through `listCommentAuthorEmailsForRecord`, their EMAIL
 * ADDRESSES) into an unrelated table's thread, and it is why a
 * comment-posted automation on `tickets` record 1 could notify the
 * commenters of `memos` record 1. Matches the granularity
 * {@link approvedGuestCommentByEmail} has always keyed on.
 *
 * `tableId` is the caller's table key as stored on the row — the raw
 * `:tableId` URL segment, which `validateTable` accepts as either the table's
 * numeric id or its name. Writes (`createComment`) and reads go through that
 * same segment, so they agree; the read-state watermark
 * (`comment_read_state`) is keyed identically.
 */
export function activeCommentsByRecordId(tableId: string, recordId: string) {
  return and(
    eq(recordComments.tableId, tableId),
    eq(recordComments.recordId, recordId),
    isNull(recordComments.deletedAt)
  )
}

/**
 * A prior APPROVED, non-deleted comment from the same guest on the same table
 * — the precondition behind `autoApprove.previouslyApproved`
 *.
 *
 * Keyed on `guest_email` + `table_id`. Per-table matches the granularity of the
 * config that gates it (`comments.autoApprove` is declared per table), so an
 * approval earned on a permissive table can never auto-approve the same address
 * on a stricter one. Widening this to app-wide is a one-way door and is
 * deliberately NOT done: it would let one lenient table's approval bypass every
 * other table's queue.
 *
 * Guest identity is the email as submitted — it is never verified — so this is
 * only ever consulted for tables that explicitly opted in (see the caller's
 * guard in `comment-create-handler.ts`).
 *
 * Backed by `record_comments_guest_email_status_idx`
 * (`table_id, guest_email, status`); without it this probe degrades to a
 * sequential scan over every comment in the app.
 */
export function approvedGuestCommentByEmail(tableId: string, guestEmail: string) {
  return and(
    eq(recordComments.tableId, tableId),
    eq(recordComments.guestEmail, guestEmail),
    eq(recordComments.status, 'approved'),
    isNull(recordComments.deletedAt)
  )
}

/**
 * Active comments by record ID, restricted to the moderation statuses the
 * viewer is allowed to see.
 *
 * Non-admin viewers (guests, members, viewers — anyone who is not an admin)
 * may only see `'approved'` comments; `'pending'`/`'rejected'` rows are
 * hidden. Admins (`includeAllStatuses: true`) see every status.
 *
 * Fail-closed: callers that cannot establish admin-ness must pass
 * `includeAllStatuses: false` so the safe default (approved-only) applies.
 * The portable `eq(status, 'approved')` clause works on both Postgres and
 * SQLite.
 *
 * Table-scoped for the same reason as {@link activeCommentsByRecordId} —
 * without it, listing a record's comments returns every same-numbered
 * record's comments across the whole app, bodies and author identities
 * included.
 */
export function visibleCommentsByRecordId(
  tableId: string,
  recordId: string,
  includeAllStatuses: boolean
) {
  return includeAllStatuses
    ? activeCommentsByRecordId(tableId, recordId)
    : and(
        eq(recordComments.tableId, tableId),
        eq(recordComments.recordId, recordId),
        isNull(recordComments.deletedAt),
        eq(recordComments.status, 'approved')
      )
}
