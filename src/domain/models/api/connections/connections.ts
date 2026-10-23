/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'

// ─── Connection User Status ──────────────────────────────────────────────────

/**
 * Per-user connection authorization status. Mirrors the `derive` logic
 * in `connections/users-handler.ts`:
 *   - `connected`     — token row exists, expiresAt is in the future (or null)
 *   - `expired`       — token row exists, expiresAt < now()
 *   - `disconnected`  — explicitly cleared by the route, OR no token row
 *
 * The route currently emits `connected` and `expired` from `deriveAdminStatus`;
 * `disconnected` is reserved for the contract because it is the documented
 * status for users without a token row (consumers iterating over a user list
 * may render this status for users they expect to see).
 */
export const connectionUserStatusSchema = Schema.Literals([
  'connected',
  'disconnected',
  'expired',
]).annotate({
  description:
    'Per-user connection status. `connected` = active token; `expired` = token past its expiry; `disconnected` = no token or explicitly cleared.',
})

export type ConnectionUserStatus = typeof connectionUserStatusSchema.Type

// ─── Connection Status (caller's own) ────────────────────────────────────────

/**
 * The caller's own authorization state for one connection, as
 * `GET /api/connections/{name}/status` reports it.
 *
 *   - `connected`        — a usable token: valid, or expired but renewable
 *     with its refresh token on the next call.
 *   - `expired`          — the token is past its expiry and the runtime will
 *     try its refresh token on the next call.
 *   - `reconnect-needed` — the provider issued no refresh token (LinkedIn,
 *     Meta) and the token expires within 7 days or already has: nothing will
 *     renew it, so the caller has to authorize again.
 *   - `disconnected`     — no token at all.
 * @public
 */
export const connectionCallerStatusSchema = Schema.Literals([
  'connected',
  'expired',
  'reconnect-needed',
  'disconnected',
]).annotate({
  description:
    "The caller's authorization state. `connected` = a usable token; `expired` = past its expiry, renewed from its refresh token on the next call; `reconnect-needed` = no refresh token and the token expires within 7 days or has expired, so authorize again; `disconnected` = no token.",
})

/** @public */
export type ConnectionCallerStatus = typeof connectionCallerStatusSchema.Type

/**
 * Response of `GET /api/connections/{name}/status`. Carries no token material:
 * the state, the connection's name and type, and when the token expires.
 * @public
 */
export const connectionStatusResponseSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'The connection name, as declared in the config.' }),
  type: Schema.String.annotate({
    description: 'The connection type: `oauth2`, `apiKey`, `basic` or `bearer`.',
  }),
  status: connectionCallerStatusSchema,
  connected: Schema.Boolean.annotate({
    description: 'Whether a token is stored for the caller, whatever its state.',
  }),
  expiresAt: Schema.NullOr(
    looseIsoDateTime({
      description:
        'ISO 8601 timestamp when the stored access token expires. `null` when no token is stored or the provider recorded no expiry.',
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ConnectionStatusResponse',
})

/** @public */
export type ConnectionStatusResponse = typeof connectionStatusResponseSchema.Type

// ─── Connection User Entry ───────────────────────────────────────────────────

/**
 * Single entry in the per-connection user roster.
 *
 * SECURITY INVARIANT ([internal ref], an automation connection spec):
 * This schema's structural definition INTENTIONALLY excludes the following
 * sensitive fields. Their absence is the documented contract — if any future
 * route handler emits them, the schema will fail validation:
 *   - `accessToken` / `access_token` — encrypted plaintext at rest, never on the wire
 *   - `refreshToken` / `refresh_token` — same rationale
 *   - `tokenType`, `scope`, raw provider response payloads
 *
 * Use Zod's `.strict()` semantics if/when this schema becomes runtime-validated
 * against the route's response: any extra key (especially a token field) will
 * trigger a clear failure rather than leak silently.
 */
export const connectionUserEntrySchema = Schema.Struct({
  userId: Schema.String.annotate({
    description:
      'Subject identifier of the user who authorized this connection. Matches `auth.users.id`.',
  }),
  status: connectionUserStatusSchema,
  expiresAt: Schema.NullOr(
    looseIsoDateTime({
      description:
        'ISO 8601 timestamp when the access token expires. `null` when no expiry was recorded by the provider (long-lived tokens).',
    })
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })

export type ConnectionUserEntry = typeof connectionUserEntrySchema.Type

// ─── List Connection Users Response ──────────────────────────────────────────

/**
 * Response body for `GET /api/connections/:name/users`.
 *
 * Returned when an authenticated admin lists the members who have completed
 * a real OAuth round-trip for the named connection. Token fields are
 * deliberately excluded (see `connectionUserEntrySchema` SECURITY INVARIANT).
 *
 * Response semantics (mirrors `users-handler.ts`):
 *   - 401 (unauthenticated): no body
 *   - 404 (connection missing OR caller is non-admin — Z-3 enumeration prevention)
 *   - 200 (admin success): `{ users: ConnectionUserEntry[] }`
 *
 * Filtering: admins are excluded from the returned list because their
 * token rows are auth-only artifacts (the test seeder runs before role
 * promotion). See `dropAdminUsers` in `users-handler.ts`.
 *
 * Currently a documentation contract
 * only — the route does not validate against this schema. When OpenAPI
 * wiring lands for connection routes, switch the route to
 * `Effect.try(() => decodeOrThrow(connectionUsersResponseSchema)(payload))` so
 * accidental token-field emission is caught at the boundary.
 */
export const connectionUsersResponseSchema = Schema.Struct({
  users: Schema.Array(connectionUserEntrySchema).annotate({
    description:
      'Members who have completed OAuth authorization for this connection. Admin users are excluded — their token rows are auth-only artifacts (see `dropAdminUsers` in users-handler).',
  }),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })

export type ConnectionUsersResponse = typeof connectionUsersResponseSchema.Type

// ─── GIF Search ──────────────────────────────────────────────────────────────

/**
 * Wire contracts of a composer's GIF search and of the GIFs it serves.
 *
 * `GET /api/connections/{name}/gif-search?q=<words>` sends the search through the
 * named connection, with the operator's key, and answers the results in ONE
 * shape whatever the provider: the adapter named by the composer's
 * `gif.provider` reads the provider's answer into it. The route answers only a
 * signed-in caller, and only for a connection a composer on a page names as its
 * `gif.connection`; any other name answers 404, so the route is not a way to
 * call an arbitrary connection. The key never appears in the answer, and the
 * answer is decoded with excess keys refused, so a provider field passed through
 * by mistake fails at the boundary instead of reaching the browser.
 *
 * A result names no provider address. Its `url` and `previewUrl` are the app's
 * own media routes, `GET /api/connections/{name}/gifs/{id}` (the GIF) and
 * `GET /api/connections/{name}/gifs/{id}/preview` (its small rendition), under
 * the same signed-in, composer-named rule. The server resolves the id to the
 * provider's media address itself (from a search it answered, or through the
 * connection's `get` operation), fetches the bytes through the guarded outbound
 * fetch, accepts only an `image/*` answer within a size cap, caches it, and
 * serves it. A media route never takes an address from the caller, and a
 * reader's browser never contacts the provider.
 */

/** A provider's id of one GIF: letters, digits, `_` and `-`, at most 64. */
const gifIdSchema = Schema.String.annotate({
  description: "The provider's id of the GIF.",
  examples: ['xT9IgG50Fb7Mi0prBC'],
}).pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,64}$/)))

/** The query of a GIF search. @public */
export const gifSearchQuerySchema = Schema.Struct({
  q: Schema.String.annotate({
    description: 'The words searched for, 1 to 100 characters.',
    examples: ['bravo'],
  }).pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(100))),
}).annotate({ title: 'GifSearchQuery' })

/** @public */
export type GifSearchQuery = typeof gifSearchQuerySchema.Type

/** The path parameters of a GIF media route. @public */
export const gifMediaParamsSchema = Schema.Struct({
  name: Schema.String.annotate({
    description: 'The connection a composer names as its GIF connection.',
    examples: ['giphy'],
  }),
  id: gifIdSchema,
}).annotate({ title: 'GifMediaParams' })

/** @public */
export type GifMediaParams = typeof gifMediaParamsSchema.Type

/** One result a member can pick. @public */
export const gifSearchResultSchema = Schema.Struct({
  id: gifIdSchema,
  title: Schema.String.annotate({
    description: 'What the GIF shows, as the provider titles it; used as its alternative text.',
  }),
  url: Schema.String.annotate({
    description:
      "The app's path of the GIF, served by the app; its absolute form is stored in the message when it is picked.",
    examples: ['/api/connections/giphy/gifs/xT9IgG50Fb7Mi0prBC'],
  }).pipe(Schema.check(Schema.isPattern(/^\/api\/connections\/[^/]+\/gifs\/[A-Za-z0-9_-]{1,64}$/))),
  previewUrl: Schema.String.annotate({
    description:
      "The app's path of the small rendition drawn in the results grid, served by the app.",
    examples: ['/api/connections/giphy/gifs/xT9IgG50Fb7Mi0prBC/preview'],
  }).pipe(
    Schema.check(
      Schema.isPattern(/^\/api\/connections\/[^/]+\/gifs\/[A-Za-z0-9_-]{1,64}\/preview$/)
    )
  ),
  width: Schema.Finite.annotate({ description: 'The width of the GIF, in pixels.' }).pipe(
    Schema.check(Schema.isInt())
  ),
  height: Schema.Finite.annotate({ description: 'The height of the GIF, in pixels.' }).pipe(
    Schema.check(Schema.isInt())
  ),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'GifSearchResult' })

/** @public */
export type GifSearchResult = typeof gifSearchResultSchema.Type

/** The answer of a GIF search: at most 24 results, the provider's order kept. @public */
export const gifSearchResponseSchema = Schema.Struct({
  results: Schema.Array(gifSearchResultSchema)
    .annotate({
      description: "The results, at most 24, in the provider's order. Empty when nothing matched.",
    })
    .pipe(Schema.check(Schema.isMaxLength(24))),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'GifSearchResponse' })

/** @public */
export type GifSearchResponse = typeof gifSearchResponseSchema.Type
