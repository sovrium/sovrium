/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { extractUserFromRow } from '../shared/user-join-helpers'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/**
 * Comment query result type
 */
export type CommentQueryRow = {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly userName: string | null
  readonly userEmail: string | null
  readonly userImage: string | null
  /**
   * Guest identity. Non-null only for
   * unauthenticated guest submissions to a `guestComments: true` table; the
   * read path surfaces `guestName` so the thread can attribute the comment to
   * the guest. `guestEmail` is selected for gravatar resolution but never
   * serialized to the public wire.
   */
  readonly guestName: string | null
  readonly guestEmail: string | null
}

/**
 * Transform comment query result to domain model
 */
export function transformCommentRow(row: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly userName: string | undefined
  readonly userEmail: string | undefined
  readonly userImage: string | undefined
  readonly guestName: string | null
  readonly guestEmail: string | null
}): {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user: UserMetadataWithOptionalImage | undefined
  readonly guestName: string | null
  readonly guestEmail: string | null
} {
  return {
    id: row.id,
    tableId: row.tableId,
    recordId: row.recordId,
    userId: row.userId,
    parentId: row.parentId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: extractUserFromRow(row),
    guestName: row.guestName,
    guestEmail: row.guestEmail,
  }
}

/**
 * Comment select fields with user join.
 *
 * Built lazily because `authUsersTable()` returns the dialect-correct mirror at
 * call time — a module-scope object would freeze the wrong dialect under
 * SQLite ([[project-sqlite-default-database]]).
 */
export const buildCommentSelectFields = () => {
  const users = authUsersTable()
  return {
    id: recordComments.id,
    tableId: recordComments.tableId,
    recordId: recordComments.recordId,
    userId: recordComments.userId,
    parentId: recordComments.parentId,
    content: recordComments.content,
    createdAt: recordComments.createdAt,
    updatedAt: recordComments.updatedAt,
    userName: users.name,
    userEmail: users.email,
    userImage: users.image,
    guestName: recordComments.guestName,
    guestEmail: recordComments.guestEmail,
  }
}
