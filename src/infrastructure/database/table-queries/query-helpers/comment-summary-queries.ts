/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { desc, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/drizzle'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { visibleCommentsByRecordId } from './comment-query-predicates'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/** The reply summary of one record: how many, who replied last, when. @public */
export interface CommentSummary {
  readonly count: number
  /** The names of the last people who replied, most recent first, each once, at most three. */
  readonly lastRepliers: readonly string[]
  /** When the last reply was posted, as an ISO instant. */
  readonly lastAt: string
}

/** How many of the most recent replies are read to name the last three repliers. */
const RECENT_REPLIES = 50

/**
 * The reply summary of each record: its APPROVED, live comments only — what
 * every reader of the record sees in its thread, so the summary needs no
 * reader of its own beyond the read gate the record was drawn under. A record
 * with no reply has no summary.
 *
 * @public
 */
export async function readCommentSummaries(
  tableKeys: readonly string[],
  recordIds: readonly string[]
): Promise<ReadonlyMap<string, CommentSummary>> {
  const users = authUsersTable()
  const summaries = await Promise.all(
    recordIds.map(async (recordId) => {
      const replies = await db
        .select({
          userId: recordComments.userId,
          guestName: recordComments.guestName,
          createdAt: recordComments.createdAt,
          userName: users.name,
        })
        .from(recordComments)
        .leftJoin(users, eq(recordComments.userId, users.id))
        .where(visibleCommentsByRecordId(tableKeys, recordId, false))
        .orderBy(desc(recordComments.createdAt), desc(recordComments.id))
        .limit(RECENT_REPLIES)
      const count = await db.$count(
        recordComments,
        visibleCommentsByRecordId(tableKeys, recordId, false)
      )
      const latest = replies[0]
      if (count === 0 || latest === undefined) return undefined
      const names = replies
        .map((reply) => reply.userName ?? reply.guestName ?? '')
        .filter((name) => name !== '')
      const summary: CommentSummary = {
        count,
        lastRepliers: [...new Set(names)].slice(0, 3),
        lastAt: new Date(latest.createdAt).toISOString(),
      }
      return [recordId, summary] as const
    })
  )
  return new Map(summaries.filter((entry) => entry !== undefined))
}
