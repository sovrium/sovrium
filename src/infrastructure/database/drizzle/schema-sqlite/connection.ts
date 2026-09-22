/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * Connection tables — sqlite-core mirror of `schema/connection.ts`.
 */

/**
 * Connections Table
 *
 * Stores OAuth2/API key credentials for external service integrations.
 * Used by automations to connect to third-party APIs.
 */
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
    // Audit H3: name must be unique so resolveConnectionId can collapse
    // its read-then-write pattern into ON CONFLICT DO UPDATE without
    // racing against concurrent first-authorize requests for the same
    // connection name.
    uniqueIndex('connections_name_unique').on(table.name),
  ]
)

/**
 * Connection Tokens Table
 *
 * Per-user OAuth tokens for connected services.
 */
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
    // Audit H3: each (connection, user) pair must hold exactly one token
    // row so upsertForUser can use INSERT ... ON CONFLICT DO UPDATE
    // instead of read-then-write (which raced when two callbacks for the
    // same user landed concurrently).
    uniqueIndex('connection_tokens_connection_user_unique').on(table.connectionId, table.userId),
  ]
)

/**
 * Connection App Tokens Table — sqlite-core mirror of
 * `schema/connection.ts`'s `connectionAppTokens`. See that file for why the
 * shared credential lives in its own table rather than as a nullable
 * `user_id` on `connection_tokens` (a change that would require recreating
 * the one SQLite table holding every stored credential).
 */
export const connectionAppTokens = systemTable(
  'connection_app_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
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
    // Exactly one shared token row per connection, so the upsert stays a
    // single atomic INSERT ... ON CONFLICT DO UPDATE.
    uniqueIndex('connection_app_tokens_connection_unique').on(table.connectionId),
  ]
)

// Type inference
