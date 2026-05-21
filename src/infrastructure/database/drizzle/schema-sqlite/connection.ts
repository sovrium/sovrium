/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'


export const connections = systemTable(
  'connections',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    type: text('type').notNull(),
    credentials: text('credentials', { mode: 'json' }).notNull(),
    metadata: text('metadata', { mode: 'json' }),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('connections_provider_idx').on(table.provider),
    uniqueIndex('connections_name_unique').on(table.name),
  ]
)

export const connectionTokens = systemTable(
  'connection_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('connection_tokens_connectionId_idx').on(table.connectionId),
    index('connection_tokens_userId_idx').on(table.userId),
    uniqueIndex('connection_tokens_connection_user_unique').on(table.connectionId, table.userId),
  ]
)

export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert
export type ConnectionToken = typeof connectionTokens.$inferSelect
