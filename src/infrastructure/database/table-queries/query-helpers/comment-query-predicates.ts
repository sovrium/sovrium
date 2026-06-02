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

export function activeCommentById(commentId: string) {
  return and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt))
}

export function activeCommentsByRecordId(recordId: string) {
  return and(eq(recordComments.recordId, recordId), isNull(recordComments.deletedAt))
}

export function visibleCommentsByRecordId(recordId: string, includeAllStatuses: boolean) {
  return includeAllStatuses
    ? activeCommentsByRecordId(recordId)
    : and(
        eq(recordComments.recordId, recordId),
        isNull(recordComments.deletedAt),
        eq(recordComments.status, 'approved')
      )
}
