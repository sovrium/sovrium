/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  ConnectionDatabaseError,
  ConnectionRepository,
} from '@/application/ports/repositories/connection-repository'
import { db } from '@/infrastructure/database'
import { connections } from '@/infrastructure/database/drizzle/schema/connection'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const wrap = makeDbWrap((cause) => new ConnectionDatabaseError({ cause }))

export const ConnectionRepositoryLive = Layer.succeed(ConnectionRepository, {
  findById: (id) =>
    wrap(async () => {
      const rows = await db.select().from(connections).where(eq(connections.id, id)).limit(1)
      return rows[0] as Record<string, unknown> | undefined
    }),

  findByName: (name) =>
    wrap(async () => {
      const rows = await db.select().from(connections).where(eq(connections.name, name)).limit(1)
      return rows[0] as Record<string, unknown> | undefined
    }),

  list: () =>
    wrap(async () => {
      const rows = await db.select().from(connections)
      return rows as readonly Record<string, unknown>[]
    }),

  create: ({ name, provider, type, credentials, metadata, createdById }) =>
    wrap(async () => {
      const [row] = await db
        .insert(connections)
        .values({
          name,
          provider,
          type,
          credentials,
          ...(metadata !== undefined ? { metadata } : {}),
          ...(createdById !== undefined ? { createdById } : {}),
        })
        .returning()
      return (row ?? {}) as Record<string, unknown>
    }),

  upsertByName: ({ name, provider, type, credentials, metadata, createdById }) =>
    wrap(async () => {
      const [row] = await db
        .insert(connections)
        .values({
          name,
          provider,
          type,
          credentials,
          ...(metadata !== undefined ? { metadata } : {}),
          ...(createdById !== undefined ? { createdById } : {}),
        })
        .onConflictDoUpdate({
          target: connections.name,
          set: { name: connections.name },
        })
        .returning()
      return (row ?? {}) as Record<string, unknown>
    }),

  update: (id, data) =>
    wrap(async () => {
      const [row] = await db.update(connections).set(data).where(eq(connections.id, id)).returning()
      return (row ?? {}) as Record<string, unknown>
    }),

  delete: (id) =>
    wrap(async () => {
      await db.delete(connections).where(eq(connections.id, id))
    }),
})
