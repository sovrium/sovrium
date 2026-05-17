/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  ConnectionDatabaseError,
  ConnectionRepository,
} from '@/application/ports/repositories/connection-repository'
import { db } from '@/infrastructure/database'
import { connections } from '@/infrastructure/database/drizzle/schema/connection'

/**
 * Connection Repository Implementation (Drizzle).
 *
 * `system.connections` stores the OAuth/API integration definitions
 * (provider, client_id, scopes, etc.). The `credentials` jsonb column
 * holds the public OAuth client config — NOT user secrets. Per-user
 * access/refresh tokens live in `system.connection_tokens` (separate
 * repository, encrypted at rest).
 */
export const ConnectionRepositoryLive = Layer.succeed(ConnectionRepository, {
  findById: (id) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(connections).where(eq(connections.id, id)).limit(1)
        return rows[0] as Record<string, unknown> | undefined
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),

  findByName: (name) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(connections).where(eq(connections.name, name)).limit(1)
        return rows[0] as Record<string, unknown> | undefined
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),

  list: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.select().from(connections)
        return rows as readonly Record<string, unknown>[]
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),

  create: ({ name, provider, type, credentials, metadata, createdById }) =>
    Effect.tryPromise({
      try: async () => {
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
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),

  upsertByName: ({ name, provider, type, credentials, metadata, createdById }) =>
    Effect.tryPromise({
      try: async () => {
        // Self-update on `name` is the PG idiom that forces RETURNING to
        // fire on the conflicting row without changing meaningful state.
        // Atomic against the connections_name_unique index (audit H3).
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
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),

  update: (id, data) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .update(connections)
          .set(data)
          .where(eq(connections.id, id))
          .returning()
        return (row ?? {}) as Record<string, unknown>
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),

  delete: (id) =>
    Effect.tryPromise({
      try: async () => {
        // eslint-disable-next-line functional/no-expression-statements
        await db.delete(connections).where(eq(connections.id, id))
      },
      catch: (cause) => new ConnectionDatabaseError({ cause }),
    }),
})
