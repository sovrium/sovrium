/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { text, timestamp } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'
import { systemSchema } from './migration-audit'

/**
 * User presence — when each person was last seen, under `auth.presence.lastSeen`.
 *
 * One row per person: `last_seen_at` is written when her last realtime
 * connection closes, never per heartbeat. Whether she is online now is not
 * stored — it is whether one of her connections is open. Personal data: listed
 * in her account export and deleted with her account.
 */
export const userPresence = systemSchema.table('user_presence', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
})
