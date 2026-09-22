/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  authOauthClientResourcesTable,
  authOauthClientsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import {
  hashOAuthClientSecret,
  mcpResourceIdentifier,
  mcpResourceServerCredentials,
} from './mcp-resource-identity'

/**
 * Seeding for the MCP protected resource — the half of this concern that holds
 * a live `db` handle.
 *
 * The PURE half (origin, resource identifier, issuer, the derived client
 * credentials, the secret hasher) moved to `./mcp-resource-identity` in W5b of
 * the layout programme. Read that file for why the two halves exist at all;
 * what belongs here is only the statement that this one writes rows, which is
 * what keeps it out of every request-path module's import graph.
 */

/**
 * Idempotently seed the resource server's confidential client and link it to
 * the MCP protected resource.
 *
 * The link row is not decoration: `isIntrospectionAuthorized` lets a client
 * introspect a token it did not issue **only** when that client is linked to
 * one of the token's audience resources. Without the link every introspection
 * answers `active: false` and MCP rejects every valid bearer.
 *
 * Best-effort by construction — it is called from the startup seeders, and a
 * failure here must not stop a server whose MCP endpoint may never be used.
 */
export const seedMcpResourceServerClient = async (options: {
  readonly hasAuth: boolean
  readonly mcpEnabled: boolean
}): Promise<void> => {
  if (!options.hasAuth || !options.mcpEnabled) return

  const { clientId, clientSecret } = mcpResourceServerCredentials()
  const resource = mcpResourceIdentifier()
  const hashedSecret = await hashOAuthClientSecret(clientSecret)
  const clients = authOauthClientsTable()
  const links = authOauthClientResourcesTable()

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.clientId, clientId))
    .limit(1)

  if (existing[0] === undefined) {
    // eslint-disable-next-line functional/no-expression-statements -- seeding a row IS the side effect this function exists for
    await db.insert(clients).values({
      id: clientId,
      clientId,
      clientSecret: hashedSecret,
      name: 'Sovrium MCP resource server',
      redirectUris: [],
      type: 'web',
      disabled: false,
      public: false,
      // The resource server presents its credentials in the request body, which
      // is what upstream's `remoteVerify` sends. Left unset the provider assumes
      // `client_secret_basic` and refuses the pair with `invalid_client`.
      tokenEndpointAuthMethod: 'client_secret_post',
    } as typeof clients.$inferInsert)
  } else {
    // The secret is derived from the root secret, so it changes if the root
    // secret is regenerated. Re-stamping keeps the seeded row usable instead of
    // silently 401-ing every introspection after a key rotation.
    // eslint-disable-next-line functional/no-expression-statements -- re-stamping the row IS the side effect
    await db
      .update(clients)
      .set({ clientSecret: hashedSecret, disabled: false })
      .where(eq(clients.clientId, clientId))
  }

  const linked = await db
    .select({ id: links.id })
    .from(links)
    .where(and(eq(links.clientId, clientId), eq(links.resourceId, resource)))
    .limit(1)

  if (linked[0] === undefined) {
    // eslint-disable-next-line functional/no-expression-statements -- linking the client to the resource IS the side effect
    await db.insert(links).values({
      id: `${clientId}::${resource}`,
      clientId,
      resourceId: resource,
      createdAt: new Date(),
    } as typeof links.$inferInsert)
  }
}
