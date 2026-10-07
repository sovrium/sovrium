/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Passkey plugin table (WebAuthn credentials). Split out of `schema-tables.ts`
// to keep that module under the project-wide ESLint max-lines limit;
// re-exported through `schema.ts`, so importers see one surface. The table
// always exists: migrations are not conditional on an app's config.

import { boolean, index, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { authSchema, users } from './schema-tables'

export const passkeys = authSchema.table(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    createdAt: timestamp('created_at', { withTimezone: true }),
    aaguid: text('aaguid'),
  },
  (table) => [
    index('passkey_userId_idx').on(table.userId),
    index('passkey_credentialID_idx').on(table.credentialID),
  ]
)
