/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for reads against the OAuth provider's own tables. */
export class OAuthServerDatabaseError extends Data.TaggedError('OAuthServerDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * A registered OAuth client, as the surfaces above this port see it.
 *
 * `clientSecret` is deliberately ABSENT. Two readers exist — token
 * introspection, which needs only the `public` flag, and the consent screen,
 * which needs the display identity — and neither has any business holding the
 * stored digest. A field absent from the record cannot be rendered into a
 * consent page or an introspection response by accident.
 *
 * `redirectUris` is normalised to a string array HERE rather than by each
 * caller: the column is a JSON blob whose element types the database does not
 * constrain, and the consent screen's whole security property is that it shows
 * a real registered address. One normaliser at the boundary is one place that
 * can be wrong, instead of one per reader.
 */
export interface OAuthClientRecord {
  readonly clientId: string
  readonly name: string | undefined
  readonly disabled: boolean
  readonly public: boolean
  readonly redirectUris: ReadonlyArray<string>
  /**
   * RFC 7591 `software_statement` — a JWT signed by a trusted issuer asserting
   * this client's metadata. Present means a third party vouched for the name.
   *
   * `undefined` rather than `null` for an absent attestation, here and below.
   * The columns are nullable and the driver hands back `null`; the boundary
   * normalises, so callers above this line write one absence check instead of
   * two, and the codebase's `unicorn/no-null` convention holds. An EMPTY string
   * is also an absent attestation as far as every reader is concerned, which is
   * why no caller compares against a sentinel.
   */
  readonly softwareStatement: string | undefined
  /**
   * Client ID Metadata Document id — upstream's domain-verified answer for the
   * MCP case (`@better-auth/cimd`). The other half of "did anyone attest this?"
   */
  readonly clientDiscoveryId: string | undefined
}

/**
 * One issued, non-revoked OAuth access token.
 *
 * Revoked tokens are DELETED from the backing table rather than flagged, so a
 * miss and a revocation are the same answer here — which is what lets the
 * introspection handler report `active: false` for both without a second read
 * and without branching on a status column.
 */
export interface OAuthAccessTokenRecord {
  readonly clientId: string
  readonly userId: string | null
  readonly scopes: ReadonlyArray<string> | null
  readonly expiresAt: Date
  readonly createdAt: Date
}

/**
 * Read port over the OAuth provider's client and access-token tables.
 *
 * READ-ONLY by construction, and that is the point of its shape. Better Auth's
 * `@better-auth/oauth-provider` owns every WRITE to these tables — registration,
 * issuance, revocation, the consent grant — and a second writer would be a
 * second implementation of a protocol this project deliberately does not
 * re-implement ("Framework
 * bypass detection"). What Sovrium adds on top is narrower than the plugin
 * covers and reads only: an RFC 7662 introspection path for PUBLIC clients,
 * which upstream answers for confidential clients alone, and a branded consent
 * screen that has to show who is asking.
 *
 * Introduced in W5b of the layout programme to retire the live `db` handle from
 * `auth-routes.ts` and `oauth-consent-routes.ts`, the two files that held one.
 */
export class OAuthServerRepository extends Context.Service<
  OAuthServerRepository,
  {
    /**
     * The registered client bearing this `client_id`, or `undefined` for a miss.
     *
     * A DISABLED client is still returned — `disabled` is on the record and the
     * caller decides. The consent screen refuses it; introspection never reaches
     * the flag because a disabled client cannot have a live token.
     */
    readonly findClientByClientId: (
      clientId: string
    ) => Effect.Effect<OAuthClientRecord | undefined, OAuthServerDatabaseError>

    /**
     * The access-token row for this opaque token value, or `undefined`.
     *
     * Expiry is NOT applied here. The introspection response distinguishes
     * "expired" from "wrong client" in neither its body nor its status, but the
     * caller still needs `expiresAt` to build the `exp` claim of an active
     * answer, so filtering in the repository would have forced a second read for
     * the live case to save a branch on the dead one.
     */
    readonly findAccessToken: (
      token: string
    ) => Effect.Effect<OAuthAccessTokenRecord | undefined, OAuthServerDatabaseError>
  }
>()('OAuthServerRepository') {}
