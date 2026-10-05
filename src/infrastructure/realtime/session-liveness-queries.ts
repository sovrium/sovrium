/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which sessions are still alive, for the realtime re-check sweep.
 *
 * A live connection belongs to the session it opened with. A session that
 * ends inside the engine closes its connections at once (the Better Auth
 * session-delete hook); one that expires, or is deleted outside the engine,
 * is caught here, by the periodic sweep, in ONE indexed read per batch rather
 * than one per connection.
 */

import { and, gt, inArray } from 'drizzle-orm'
import { db } from '@/infrastructure/database/drizzle'
import { authSessionsTable } from '@/infrastructure/database/drizzle/dialect-schema'

/**
 * The ids among `sessionIds` whose session row still exists and has not
 * expired. Rejects when the read fails: the caller decides what an unanswered
 * liveness question means.
 */
export const readLiveSessionIds = async (
  sessionIds: readonly string[]
): Promise<ReadonlySet<string>> => {
  if (sessionIds.length === 0) return new Set()
  const sessions = authSessionsTable()
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(inArray(sessions.id, [...sessionIds]), gt(sessions.expiresAt, new Date())))
  return new Set(rows.map((row) => row.id))
}
