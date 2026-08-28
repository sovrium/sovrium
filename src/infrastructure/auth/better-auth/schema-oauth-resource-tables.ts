/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// OAuth-provider resource tables (RFC 8707 resource indicators + client
// assertions). Split out of `schema-tables.ts` to keep that module under the
// project-wide ESLint max-lines limit; re-exported through `schema.ts`, so
// importers see one surface.

import { boolean, index, integer, jsonb, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { authSchema, oauthClients } from './schema-tables'

// Protected resources an access token may be issued for (RFC 8707 resource
// indicators). Populated by the OAuth-provider plugin; the table always exists
// because migrations are not conditional on an app's config.
export const oauthResources = authSchema.table('oauth_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes').array(),
  customClaims: jsonb('custom_claims'),
  dpopBoundAccessTokensRequired: boolean('dpop_bound_access_tokens_required'),
  disabled: boolean('disabled'),
  policyVersion: integer('policy_version'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

// Join table: which clients may request which resources.
//
// Both foreign keys point at the SEMANTIC STRING columns — `oauth_client`.`client_id`
// and `oauth_resource`.`identifier` — never at the row primary keys. That is what the
// plugin writes and reads: it declares `references: { model: "oauthClient", field:
// "clientId" }` / `{ model: "oauthResource", field: "identifier" }`, inserts the client
// id string and the resource identifier into these columns, and looks links up by the
// same strings. Pointing either key at `id` makes every write fail the constraint.
//
// `oauthClients.clientId` therefore carries `.unique()`: a column cannot be a foreign-key
// target without it, and upstream independently declares `unique: true` there and relies
// on the database to enforce it (registration inserts and catches the violation rather
// than looking up first).
export const oauthClientResources = authSchema.table(
  'oauth_client_resource',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => oauthResources.identifier, { onDelete: 'cascade' }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }),
  },
  (table) => [
    index('oauthClientResource_clientId_idx').on(table.clientId),
    index('oauthClientResource_resourceId_idx').on(table.resourceId),
    uniqueIndex('oauthClientResource_clientId_resourceId_uidx').on(
      table.clientId,
      table.resourceId
    ),
  ]
)

// Replay guard for `private_key_jwt` client assertions: the assertion's `jti`
// is the primary key, held until the assertion expires.
export const oauthClientAssertions = authSchema.table('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
