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
}

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
  }
}

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
  }
}
