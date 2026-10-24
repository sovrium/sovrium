/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { integer, text } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { systemTable } from './table-helpers'

/**
 * sqlite-core mirror of `schema/account-baselines.ts` — physical table
 * `system_account_baselines`. See the pg module for what a baseline holds and
 * why nothing serves it.
 */
export const accountBaselines = systemTable('account_baselines', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  snapshot: text('snapshot').notNull(),
  recordedAt: integer('recorded_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})
