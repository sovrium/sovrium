/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import { userFavorites } from '@/infrastructure/database/drizzle/schema/favorites'
import {
  filterLiveEntities,
  parseEntityMutationBody,
} from '@/presentation/api/routes/user-entity-lists'
import { unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Context, Hono } from 'hono'


const badRequest = (c: Context) =>
  c.json({ success: false, message: 'Invalid favorite payload', code: 'BAD_REQUEST' }, 400)

const handleList = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const rows = await db
    .select({
      id: userFavorites.id,
      entityType: userFavorites.entityType,
      entityId: userFavorites.entityId,
      tableId: userFavorites.tableId,
      createdAt: userFavorites.createdAt,
    })
    .from(userFavorites)
    .where(and(eq(userFavorites.userId, session.userId), isNull(userFavorites.deletedAt)))
    .orderBy(desc(userFavorites.createdAt))

  const visible = (await filterLiveEntities(rows)).map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    tableId: row.tableId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }))

  return c.json(visible, 200)
}

const handleAdd = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c)

  const existing = await db
    .select({ id: userFavorites.id })
    .from(userFavorites)
    .where(
      and(
        eq(userFavorites.userId, session.userId),
        eq(userFavorites.entityType, input.entityType),
        eq(userFavorites.entityId, input.entityId)
      )
    )
    .limit(1)

  const current = existing[0]
  if (current) {
    await db
      .update(userFavorites)
      .set({
        deletedAt: null,
        tableId: input.tableName,
        createdAt: new Date(),
      })
      .where(eq(userFavorites.id, current.id))
    return c.json({ success: true }, 201)
  }

  await db.insert(userFavorites).values({
    userId: session.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    tableId: input.tableName,
  })
  return c.json({ success: true }, 201)
}

const handleRemove = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c)

  await db
    .update(userFavorites)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(userFavorites.userId, session.userId),
        eq(userFavorites.entityType, input.entityType),
        eq(userFavorites.entityId, input.entityId),
        isNull(userFavorites.deletedAt)
      )
    )

  return c.json({ success: true }, 200)
}

export function chainFavoriteRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/favorites', handleList)
    .post('/api/favorites', handleAdd)
    .delete('/api/favorites', handleRemove) as T
}
