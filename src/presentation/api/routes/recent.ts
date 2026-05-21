/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { userRecentItems } from '@/infrastructure/database/drizzle/schema/favorites'
import {
  filterLiveEntities,
  parseEntityMutationBody,
} from '@/presentation/api/routes/user-entity-lists'
import { unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Context, Hono } from 'hono'


const MAX_RECENT_ITEMS = 20

const resolveLimit = (c: Context): number => {
  const raw = c.req.query('limit')
  const parsed = raw === undefined ? MAX_RECENT_ITEMS : Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1) return MAX_RECENT_ITEMS
  return Math.min(parsed, MAX_RECENT_ITEMS)
}

const handleList = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const limit = resolveLimit(c)

  const rows = await db
    .select({
      id: userRecentItems.id,
      entityType: userRecentItems.entityType,
      entityId: userRecentItems.entityId,
      tableId: userRecentItems.tableId,
      viewedAt: userRecentItems.viewedAt,
    })
    .from(userRecentItems)
    .where(eq(userRecentItems.userId, session.userId))
    .orderBy(desc(userRecentItems.viewedAt))
    .limit(MAX_RECENT_ITEMS)

  const visible = (await filterLiveEntities(rows)).slice(0, limit).map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    tableId: row.tableId,
    viewedAt: row.viewedAt instanceof Date ? row.viewedAt.toISOString() : row.viewedAt,
  }))

  return c.json(visible, 200)
}

const handleAdd = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) {
    return c.json({ success: false, message: 'Invalid recent payload', code: 'BAD_REQUEST' }, 400)
  }

  const existing = await db
    .select({ id: userRecentItems.id })
    .from(userRecentItems)
    .where(
      and(
        eq(userRecentItems.userId, session.userId),
        eq(userRecentItems.entityType, input.entityType),
        eq(userRecentItems.entityId, input.entityId)
      )
    )
    .limit(1)

  const current = existing[0]
  if (current) {
    await db
      .update(userRecentItems)
      .set({ viewedAt: new Date(), tableId: input.tableName })
      .where(eq(userRecentItems.id, current.id))
    return c.json({ success: true }, 201)
  }

  await db.insert(userRecentItems).values({
    userId: session.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    tableId: input.tableName,
  })

  await db.execute(
    sql`DELETE FROM ${userRecentItems} WHERE id IN (
      SELECT id FROM ${userRecentItems}
      WHERE user_id = ${session.userId}
      ORDER BY viewed_at DESC
      OFFSET ${MAX_RECENT_ITEMS}
    )`
  )

  return c.json({ success: true }, 201)
}

export function chainRecentRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/recent', handleList).post('/api/recent', handleAdd) as T
}
