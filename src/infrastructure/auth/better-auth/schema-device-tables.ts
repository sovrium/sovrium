/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Device-authorization plugin table (`better-auth/plugins/device-authorization`,
// model name `deviceCode`). Split out of `schema-tables.ts` for its size
// ceiling and re-exported through `schema.ts`. Mounted only when
// `auth.deviceAuthorization` is on, but the TABLE always exists: migrations are
// not conditional on an app's config. The columns mirror the plugin's own
// schema field for field.
//
// A row is a pending sign-in: the code the command line polls with, the short
// code the person types, and — once that person claims it in the browser — their
// user id. `user_id` cascades, so an erased account takes its codes with it (S5).
// `polling_interval` is milliseconds (the plugin stores `ms('5s')`).

import { index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { authSchema, users } from './schema-tables'

export const deviceCodes = authSchema.table(
  'device_code',
  {
    id: text('id').primaryKey(),
    deviceCode: text('device_code').notNull(),
    userCode: text('user_code').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    status: text('status').notNull(),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    pollingInterval: integer('polling_interval'),
    clientId: text('client_id'),
    scope: text('scope'),
  },
  (table) => [
    uniqueIndex('deviceCode_deviceCode_uidx').on(table.deviceCode),
    uniqueIndex('deviceCode_userCode_uidx').on(table.userCode),
    index('deviceCode_userId_idx').on(table.userId),
  ]
)
