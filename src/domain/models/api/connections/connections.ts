/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

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
export const connectionUserStatusSchema = z
  .enum(['connected', 'disconnected', 'expired'])
  .describe(
    'Per-user connection status. `connected` = active token; `expired` = token past its expiry; `disconnected` = no token or explicitly cleared.'
  )

export type ConnectionUserStatus = z.infer<typeof connectionUserStatusSchema>

// ─── Connection User Entry ───────────────────────────────────────────────────

/**
 * Single entry in the per-connection user roster.
 *
 * SECURITY INVARIANT (REC-C4-6, APP-AUTOMATION-CONNECTION-074):
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
export const connectionUserEntrySchema = z
  .object({
    userId: z
      .string()
      .describe(
        'Subject identifier of the user who authorized this connection. Matches `auth.users.id`.'
      ),
    status: connectionUserStatusSchema,
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 timestamp when the access token expires. `null` when no expiry was recorded by the provider (long-lived tokens).'
      ),
  })
  .strict()

export type ConnectionUserEntry = z.infer<typeof connectionUserEntrySchema>

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
 * REC-C4-6 (Wave-2 audit, 2026-05-01): currently a documentation contract
 * only — the route does not validate against this schema. When OpenAPI
 * wiring lands for connection routes, switch the route to
 * `Effect.try(() => connectionUsersResponseSchema.parse(payload))` so
 * accidental token-field emission is caught at the boundary.
 */
export const connectionUsersResponseSchema = z
  .object({
    users: z
      .array(connectionUserEntrySchema)
      .describe(
        'Members who have completed OAuth authorization for this connection. Admin users are excluded — their token rows are auth-only artifacts (see `dropAdminUsers` in users-handler).'
      ),
  })
  .strict()

export type ConnectionUsersResponse = z.infer<typeof connectionUsersResponseSchema>
