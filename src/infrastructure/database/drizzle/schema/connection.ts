/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

export const connections = systemSchema.table(
  'connections',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    type: text('type').notNull(),
    credentials: jsonb('credentials').notNull(),
    metadata: jsonb('metadata'),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('connections_provider_idx').on(table.provider),
    uniqueIndex('connections_name_unique').on(table.name),
  ]
)

export const connectionTokens = systemSchema.table(
  'connection_tokens',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
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
