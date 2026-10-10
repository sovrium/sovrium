/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sqlite-core mirror of the pg device-authorization table
// (`schema-device-tables.ts`). Split out of `auth-tables.ts` for the same size
// reason as its pg counterpart.

import { index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'
import { authTable } from './table-helpers'

export const deviceCodes = authTable(
  'device_code',
  {
    id: text('id').primaryKey(),
    deviceCode: text('device_code').notNull(),
    userCode: text('user_code').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status').notNull(),
    lastPolledAt: integer('last_polled_at', { mode: 'timestamp_ms' }),
    pollingInterval: integer('polling_interval'),
    clientId: text('client_id'),
    scope: text('scope'),
    redirectUri: text('redirect_uri'),
    deviceName: text('device_name'),
    returnCodeHash: text('return_code_hash'),
    requestedAt: integer('requested_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('deviceCode_deviceCode_uidx').on(table.deviceCode),
    uniqueIndex('deviceCode_userCode_uidx').on(table.userCode),
    index('deviceCode_userId_idx').on(table.userId),
  ]
)
