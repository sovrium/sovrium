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
 * `system.account_baselines` — what an `app/seed` reset returns each account
 * it keeps to: a copy of the account's profile and of its standing sign-in rows
 * (second factor, passkeys, API keys, calendar-feed tokens, every linked
 * sign-in account, its password credential included), of the OAuth clients it
 * registered with their resource links, of the third-party accounts it
 * connected, and of the app's own connections, recorded at the end of every
 * reset and by `sovrium seed --baseline`.
 *
 * One row per kept account. `email` is the address recorded with it: a kept
 * account is recognised by its id while the host variable or `seed/users.yaml`
 * still names that address, so a visitor who changes the shared account's
 * email does not turn it into a stranger the next reset erases.
 *
 * `snapshot` holds key hashes, second-factor secrets, client secrets and
 * sealed tokens: no API, MCP tool or
 * console page reads this table. `user_id` cascades, and erasure names it, so
 * erasing an account erases its baseline.
 */
export const accountBaselines = systemSchema.table('account_baselines', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  /** JSON: `{ profile, rows: { <table>: [row, …] } }`, each row as the database stores it. */
  snapshot: text('snapshot').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
})
