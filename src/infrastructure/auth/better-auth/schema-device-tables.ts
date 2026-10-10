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
//
// The last four columns are the loopback return, all nullable: where the
// browser goes back to (`redirect_uri`), the machine that asked
// (`device_name`), when it asked (`requested_at`), and — once the claimant
// approves in one click — the sha256 of the single-use code the browser
// carries back (`return_code_hash`, never the code itself).

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
    redirectUri: text('redirect_uri'),
    deviceName: text('device_name'),
    returnCodeHash: text('return_code_hash'),
    requestedAt: timestamp('requested_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('deviceCode_deviceCode_uidx').on(table.deviceCode),
    uniqueIndex('deviceCode_userCode_uidx').on(table.userCode),
    index('deviceCode_userId_idx').on(table.userId),
  ]
)
