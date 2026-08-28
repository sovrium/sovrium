/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sqlite-core mirror of the pg OAuth-provider resource tables. Split out of
// `auth-tables.ts` for the same max-lines reason as its pg counterpart.

import { index, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { oauthClients } from './auth-tables'
import { authTable } from './table-helpers'

// sqlite-core mirror of the pg `oauth_resource` / `oauth_client_resource` /
// `oauth_client_assertion` tables. Same property names, same column names.
export const oauthResources = authTable('oauth_resource', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull().unique(),
  name: text('name').notNull(),
  accessTokenTtl: integer('access_token_ttl'),
  refreshTokenTtl: integer('refresh_token_ttl'),
  signingAlgorithm: text('signing_algorithm'),
  signingKeyId: text('signing_key_id'),
  allowedScopes: text('allowed_scopes', { mode: 'json' }),
  customClaims: text('custom_claims', { mode: 'json' }),
  dpopBoundAccessTokensRequired: integer('dpop_bound_access_tokens_required', { mode: 'boolean' }),
  disabled: integer('disabled', { mode: 'boolean' }),
  policyVersion: integer('policy_version'),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
})

// Mirrors the pg join table, including its reference contract: both foreign keys point
// at the semantic string columns (`client_id`, `identifier`), never at the row primary
// keys. See the pg counterpart for why. Kept in lockstep — a fix applied to one dialect
// only would leave the other silently broken.
export const oauthClientResources = authTable(
  'oauth_client_resource',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
    resourceId: text('resource_id')
      .notNull()
      .references(() => oauthResources.identifier, { onDelete: 'cascade' }),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }),
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

export const oauthClientAssertions = authTable('oauth_client_assertion', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
})
