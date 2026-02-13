/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, and, isNull, desc, asc } from 'drizzle-orm'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database/drizzle'
import { recordComments } from '@/infrastructure/database/drizzle/schema/record-comments'

/**
 * Comment query result type
 */
export type CommentQueryRow = {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly userName: string | null
  readonly userEmail: string | null
  readonly userImage: string | null
}

/**
 * Comment select fields with user join
 */
export const commentSelectFields = {
  id: recordComments.id,
  tableId: recordComments.tableId,
  recordId: recordComments.recordId,
  userId: recordComments.userId,
  content: recordComments.content,
  createdAt: recordComments.createdAt,
  updatedAt: recordComments.updatedAt,
  userName: users.name,
  userEmail: users.email,
  userImage: users.image,
}

/**
 * Transform comment query result to domain model
 */
export function transformCommentRow(row: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly userName: string | undefined
  readonly userEmail: string | undefined
  readonly userImage: string | undefined
}): {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
} {
  return {
    id: row.id,
    tableId: row.tableId,
    recordId: row.recordId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user:
      row.userName && row.userEmail
        ? { id: row.userId, name: row.userName, email: row.userEmail, image: row.userImage }
        : undefined,
  }
}

/**
 * Execute comment query with user join
 */
export function executeCommentQuery(commentId: string) {
  return db
    .select(commentSelectFields)
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt)))
    .limit(1)
}

/**
 * Build base comments query with user join
 */
export function buildCommentsQuery(recordId: string) {
  return db
    .select(commentSelectFields)
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(and(eq(recordComments.recordId, recordId), isNull(recordComments.deletedAt)))
}

/**
 * Execute list comments query with sorting and pagination
 */
export function executeListCommentsQuery(
  recordId: string,
  options?: {
    readonly limit?: number
    readonly offset?: number
    readonly sortOrder?: 'asc' | 'desc'
  }
) {
  const query = buildCommentsQuery(recordId)

  // Apply sorting (default: DESC for newest first)
  const sortedQuery =
    options?.sortOrder === 'asc'
      ? query.orderBy(asc(recordComments.createdAt), asc(recordComments.id))
      : query.orderBy(desc(recordComments.createdAt), desc(recordComments.id))

  // Apply pagination
  if (options?.limit !== undefined) {
    const paginatedQuery = sortedQuery.limit(options.limit)
    return options.offset !== undefined ? paginatedQuery.offset(options.offset) : paginatedQuery
  }

  return sortedQuery
}

/**
 * Build SQL query to check record existence with optional deleted_at filter and owner_id check
 */
export function buildRecordCheckQuery(params: {
  readonly tableName: string
  readonly recordId: string
  readonly userId: string
  readonly hasDeletedAt: boolean
  readonly hasOwnerId: boolean
}) {
  const { tableName, recordId, userId, hasDeletedAt, hasOwnerId } = params
  if (hasDeletedAt && hasOwnerId) {
    // Allow access to records with NULL owner_id (shared records) OR owned records
    return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL AND (owner_id = ${userId} OR owner_id IS NULL)`
  }
  if (hasDeletedAt) {
    return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL`
  }
  if (hasOwnerId) {
    // Allow access to records with NULL owner_id (shared records) OR owned records
    return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND (owner_id = ${userId} OR owner_id IS NULL)`
  }
  return sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId}`
}

/**
 * Execute comment update in database
 */
export function executeCommentUpdate(commentId: string, content: string) {
  const now = new Date()
  return db
    .update(recordComments)
    .set({ content, updatedAt: now })
    .where(and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt)))
    .returning()
}
