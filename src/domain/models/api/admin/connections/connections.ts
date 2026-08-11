/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the **App Connections** admin read endpoint family — the
 * last data page of the pure operational admin DATA console
 * (`/_admin/data/connections`):
 *
 *   - `GET /api/admin/connections`     — the connection list, one row per
 *     `system.connections` row with its per-connection token/expiry summary
 *     read from `system.connection_tokens`.
 *   - `GET /api/admin/connections/:id` — detail: the same connection fields
 *     plus the per-user token rows (`userId` + `expiresAt` + per-user status).
 *
 * Powers the admin dashboard's `/_admin/data/connections` page. Reads the
 * RUNTIME DB rows in `system.connections` (NOT the `app.connections` config),
 * joined with the per-connection token summary.
 *
 * Source story: [internal ref]
 *
 * **Why a sibling to connections/calls.ts**: `calls.ts` is the per-connection
 * call-history rollup (`{ calls, fields }`) that powers the Connections domain
 * Analytique tab. This is the *content*
 * drill-in: the Data tab where an operator browses the configured connections
 * and their authorization/expiry health. They share the
 * `/api/admin/connections/*` namespace and the admin-tier gate, but the calls
 * endpoint answers "how is this connection performing" while this one answers
 * "what connections exist and are their tokens healthy".
 *
 * ============================================================================
 * ⛔ SECURITY INVARIANT (S4 — ABSOLUTE). THE RESPONSE IS A HARD ALLOW-LIST.
 * ============================================================================
 * These schemas are the single response-shaping choke point. They MUST NEVER
 * serialize secret material: NOT `credentials`, NOT `accessToken`, NOT
 * `refreshToken`, NOT `tokenType`, NOT `scope`, NOT raw provider payloads.
 * Their ABSENCE is the documented contract — every entry schema is `.strict()`
 * so any EXTRA key (especially a token field) fails validation rather than
 * leaking silently. This mirrors the existing precedent in
 * `src/domain/models/api/connections/connections.ts`
 * (`connectionUserEntrySchema` / `connectionUsersResponseSchema`), which
 * already document and enforce the same token-exclusion invariant.
 *
 * The exposed fields are EXACTLY:
 *   - per connection (list + detail): `id`, `name`, `provider`, `type`,
 *     `tokenCount` (int), `expiresAt` (soonest token expiry, ISO 8601 nullable),
 *     a derived `status` (`active | expired | expiring-soon`), `createdAt`.
 *   - per-user token row (detail only): `userId`, `expiresAt` (nullable),
 *     a per-user `status`.
 *
 * **No `_admin` envelope**: a `system.connections` row has no public counterpart
 * (connections are never publicly listed), so there is nothing to be a superset
 * of ([internal ref] D3 rationale, same as the bucket-file item + agent-conversation
 * item). Both shapes are flat admin-only projections.
 *
 * @see ./calls.ts — sibling per-connection call-history endpoint
 * @see ../../connections/connections.ts — the secret-free per-user roster
 *      precedent this allow-list mirrors
 * @see ../audit-log/action-catalog.ts — `connection.list.queried` /
 *      `connection.detail.queried` (resource.type `connection`)
 */

import { z } from '@hono/zod-openapi'

// ─── Status derivation threshold ─────────────────────────────────────────────

/**
 * The "expiring soon" window: a token whose soonest `expiresAt` falls within
 * this many milliseconds of now (but is still in the future) derives the
 * `expiring-soon` status. Chosen as **7 days** — long enough to give an operator
 * a meaningful re-authorization lead time, short enough that a healthy
 * long-lived token reads as `active`. Documented as a single named constant so
 * the handler's `deriveConnectionStatus` and any UI badge logic agree.
 *
 * @public
 */
export const CONNECTION_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

// ─── Connection Status ───────────────────────────────────────────────────────

/**
 * Derived per-connection authorization health, computed from the soonest token
 * `expiresAt` across the connection's `system.connection_tokens` rows:
 *
 *   - `active`        — has token(s) all comfortably in the future, OR has NO
 *     token rows at all (apiKey / basic / bearer connections generate zero
 *     `connection_tokens`; they are configured and usable, so they degrade
 *     gracefully to `active`, NEVER `expired`).
 *   - `expiring-soon` — has token(s); the soonest `expiresAt` is in the future
 *     but within `CONNECTION_EXPIRING_SOON_WINDOW_MS` (7 days).
 *   - `expired`       — has token(s); the soonest `expiresAt` is already in the
 *     past.
 *
 * Mirrors + extends `deriveAdminStatus` in
 * `src/presentation/api/routes/connections/users-handler.ts` (which derives
 * `connected | expired` today) by adding the `expiring-soon` band and the
 * no-token → `active` degradation.
 */
export const connectionStatusSchema = z
  .enum(['active', 'expiring-soon', 'expired'])
  .describe(
    'Derived connection health. `active` = tokens all in the future OR no tokens (apiKey/no-expiry case); `expiring-soon` = soonest token expiry within 7 days; `expired` = soonest token expiry in the past.'
  )

/** @public */
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>

// ─── Connection Row Action ───────────────────────────────────────────────────

/**
 * Derived per-row connect/disconnect affordance — a SERVER-COMPUTED display hint
 * so the dashboard's generic config `data-table` can gate its connect / reconnect
 * / disconnect action buttons with a single-field `visibleWhen` predicate (the
 * config predicate vocabulary tests ONE field, but the real affordance is
 * compound: `type` + `tokenCount` + `status`). Computing it here keeps the
 * compound rule in one server-side place rather than smuggling multi-field logic
 * into config.
 *
 *   - `connect`    — an `oauth2` connection nobody has authorized yet
 *     (`tokenCount === 0`): the primary action is to start the OAuth flow.
 *   - `reconnect`  — an `oauth2` connection with token(s) whose health is
 *     `expiring-soon` / `expired`: re-run the OAuth flow before it lapses (a
 *     `reconnect` row ALSO offers disconnect).
 *   - `disconnect` — an `oauth2` connection with healthy (`active`) token(s):
 *     the only action is to revoke + clear them.
 *   - `none`       — a non-oauth2 connection (`apiKey` / `basic` / `bearer`):
 *     a static secret has nothing to connect.
 *
 * Render-only: it never carries secret material, so it rides inside the same
 * `.strict()` allow-list as `status` (it is a derived enum, not a DB column).
 */
export const connectionRowActionSchema = z
  .enum(['connect', 'reconnect', 'disconnect', 'none'])
  .describe(
    'Derived per-row connect affordance: `connect` (oauth2, no tokens) / `reconnect` (oauth2, expiring/expired tokens) / `disconnect` (oauth2, healthy tokens) / `none` (non-oauth2). Server-computed display hint for config-driven action gating.'
  )

/** @public */
export type ConnectionRowAction = z.infer<typeof connectionRowActionSchema>

// ─── Connection List Item ────────────────────────────────────────────────────

/**
 * A single connection row in the list. Flat projection of `system.connections`
 * joined with the per-connection token summary — admin-only, no public
 * counterpart, so no `_admin` envelope (see file-level docstring).
 *
 * `.strict()` is the SECURITY INVARIANT: any extra key — especially a token
 * field (`credentials`, `accessToken`, `refreshToken`) — fails validation
 * rather than leaking. The exposed set is the operator's at-a-glance triage:
 * the connection `id` (the detail-route segment), the human `name`, the
 * `provider` + `type` (icon + behavior hints), the `tokenCount` (how many users
 * authorized — `0` for apiKey/basic/bearer), the soonest `expiresAt`, the
 * derived `status` badge, and the `createdAt` open timestamp.
 */
export const connectionListItemSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Unique connection id (`system.connections.id`, a uuid). The path segment the connection-detail endpoint resolves by.'
      ),
    name: z
      .string()
      .min(1)
      .describe('Connection name (`system.connections.name`), the app-config-declared identifier.'),
    provider: z
      .string()
      .min(1)
      .describe(
        'Connection provider (`system.connections.provider`), e.g. `google`, `slack`, `stripe`. Drives the dashboard icon hint.'
      ),
    type: z
      .string()
      .min(1)
      .describe(
        'Connection auth type (`system.connections.type`): `oauth2` | `apiKey` | `basic` | `bearer`. Only `oauth2` (user-scope) generates per-user token rows.'
      ),
    tokenCount: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Number of per-user token rows for this connection (`COUNT(connection_tokens.id)`). `0` for apiKey/basic/bearer connections (which never generate tokens) and for oauth2 connections nobody has authorized yet.'
      ),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp of the SOONEST token expiry across this connection (`MIN(connection_tokens.expires_at)`). `null` when there are no token rows OR no token recorded an expiry (long-lived tokens).'
      ),
    status: connectionStatusSchema,
    rowAction: connectionRowActionSchema,
    createdAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp the connection row was created (`system.connections.created_at`).'
      ),
  })
  .strict()
  .openapi('ConnectionListItem')

/**
 * Response schema for `GET /api/admin/connections`.
 *
 * A flat `{ connections }` list (no pagination — a Sovrium app declares a small,
 * bounded set of connections in `app.connections`, so the runtime
 * `system.connections` table is small; the cursor envelope the high-volume
 * agents/buckets endpoints use is unnecessary here). `.strict()` so a stray
 * top-level key cannot smuggle a secret past the boundary.
 */
export const connectionsListResponseSchema = z
  .object({
    connections: z
      .array(connectionListItemSchema)
      .describe('Every connection configured for the app, with its token/expiry summary.'),
  })
  .strict()
  .openapi('ConnectionsListResponse')

// ─── Connection User Token Row (detail only) ─────────────────────────────────

/**
 * A single per-user token row in the connection detail. Flat projection of one
 * `system.connection_tokens` row — SECRET-FREE: it exposes ONLY `userId`, the
 * `expiresAt`, and a derived per-user `status`. `.strict()` is the security
 * invariant — `accessToken` / `refreshToken` / any token value would fail
 * validation. Mirrors `connectionUserEntrySchema` in
 * `src/domain/models/api/connections/connections.ts`.
 */
export const connectionUserTokenSchema = z
  .object({
    userId: z
      .string()
      .min(1)
      .describe(
        'Subject identifier of the user who holds this token row (`connection_tokens.user_id`). Matches `auth.users.id`.'
      ),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp this user’s token expires (`connection_tokens.expires_at`). `null` when no expiry was recorded (long-lived token).'
      ),
    status: connectionStatusSchema.describe(
      'Derived per-user token health: `expired` if this row’s `expiresAt` is in the past, `expiring-soon` if within 7 days, `active` otherwise (including no recorded expiry).'
    ),
  })
  .strict()
  .openapi('ConnectionUserToken')

/**
 * Response schema for `GET /api/admin/connections/:id`.
 *
 * The connection header (the same secret-free fields as the list item) plus its
 * per-user token roster (`tokens`). `.strict()` at every level — no secret can
 * ride along. For apiKey/basic/bearer connections (no token rows) `tokens` is an
 * empty array and the connection `status` is `active`.
 */
export const connectionDetailResponseSchema = z
  .object({
    connection: connectionListItemSchema.describe(
      'The connection header — the same secret-free fields as the list item.'
    ),
    tokens: z
      .array(connectionUserTokenSchema)
      .describe(
        'Per-user token rows (secret-free: `userId` + `expiresAt` + per-user `status`). Empty for apiKey/basic/bearer connections and for oauth2 connections nobody has authorized.'
      ),
  })
  .strict()
  .openapi('ConnectionDetailResponse')

// ─── Inferred types ──────────────────────────────────────────────────────────

/** @public */
export type ConnectionListItem = z.infer<typeof connectionListItemSchema>
/** @public */
export type ConnectionsListResponse = z.infer<typeof connectionsListResponseSchema>
/** @public */
export type ConnectionUserToken = z.infer<typeof connectionUserTokenSchema>
/** @public */
export type ConnectionDetailResponse = z.infer<typeof connectionDetailResponseSchema>
