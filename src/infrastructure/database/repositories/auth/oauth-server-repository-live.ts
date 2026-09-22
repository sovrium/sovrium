/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  OAuthServerDatabaseError,
  OAuthServerRepository,
  type OAuthAccessTokenRecord,
  type OAuthClientRecord,
} from '@/application/ports/repositories/auth/oauth-server-repository'
import { db } from '@/infrastructure/database'
import {
  authOauthAccessTokensTable,
  authOauthClientsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to `OAuthServerDatabaseError`. */
const wrap = makeDbWrap((cause) => new OAuthServerDatabaseError({ cause }))

/**
 * Normalise the `redirect_uris` JSON column to a string array.
 *
 * The column is a JSON blob and the database constrains neither its shape nor
 * its element types, so anything could be in there. Every non-string element is
 * DROPPED rather than coerced: the consent screen's entire security property is
 * that the address it shows is one the client really registered, and
 * `String(someObject)` produces `"[object Object]"`, which is an address-shaped
 * lie.
 */
const toRedirectUris = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/** Project a raw client row onto the port's record shape, dropping the secret. */
const decodeClient = (row: Readonly<Record<string, unknown>>): OAuthClientRecord => ({
  clientId: String(row['clientId']),
  name: typeof row['name'] === 'string' ? row['name'] : undefined,
  disabled: row['disabled'] === true,
  public: row['public'] === true,
  redirectUris: toRedirectUris(row['redirectUris']),
  softwareStatement:
    typeof row['softwareStatement'] === 'string' ? row['softwareStatement'] : undefined,
  clientDiscoveryId:
    typeof row['clientDiscoveryId'] === 'string' ? row['clientDiscoveryId'] : undefined,
})

/**
 * Drizzle implementation of the OAuth provider read port.
 *
 * Both tables are resolved per dialect (`authOauthClientsTable()` /
 * `authOauthAccessTokensTable()`), so a query targets `auth.oauth_client` on
 * PostgreSQL and the flat `auth_oauth_client` on SQLite. SQLite is Sovrium's
 * zero-config default; a repository pinned to either dialect fails on the
 * other, which is a failure this project has already shipped once.
 */
export const OAuthServerRepositoryLive = Layer.succeed(OAuthServerRepository, {
  findClientByClientId: (clientId: string) =>
    wrap(async () => {
      const clients = authOauthClientsTable()
      const rows = await db.select().from(clients).where(eq(clients.clientId, clientId)).limit(1)
      const row = rows[0]
      return row === undefined ? undefined : decodeClient(row)
    }),

  findAccessToken: (token: string) =>
    wrap(async () => {
      const accessTokens = authOauthAccessTokensTable()
      const rows = await db
        .select()
        .from(accessTokens)
        .where(eq(accessTokens.token, token))
        .limit(1)
      const row = rows[0]
      if (row === undefined) return undefined
      // Passed through rather than normalised: `userId` and `scopes` are
      // nullable columns and the introspection handler already maps both to
      // `undefined` when it builds the RFC 7662 body, so a second conversion
      // here would be a shape change with no reader.
      const record: OAuthAccessTokenRecord = {
        clientId: row.clientId,
        userId: row.userId,
        scopes: row.scopes,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      }
      return record
    }),
})
