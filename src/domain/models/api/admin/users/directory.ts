/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/users` — the Data-tab **Utilisateurs**
 * account directory.
 *
 * WHY THIS ENDPOINT EXISTS (the bug it fixes)
 * -------------------------------------------
 * The directory island (`admin-users-directory`) originally fetched Better
 * Auth's `GET /api/auth/admin/list-users` to populate the table. That endpoint
 * is gated by the Better Auth admin plugin on the role being **exactly**
 * `admin` (`adminRoles: ['admin']`). An app whose top operator role is a CUSTOM
 * role — e.g. the partner app's `engineer` (level 80) — therefore got a **404**
 * from `list-users`, so the directory rendered NOBODY even though the operator
 * is fully admin-tier in Sovrium's own model.
 *
 * The sibling KPI read `GET /api/admin/users/overview` already proved the
 * decoupled posture: it is gated by Sovrium's `requireAdminTier`
 * (`resolveDashboardTier`, which resolves a custom top role to `admin-editor`)
 * and reads the auth `user` table DIRECTLY, so it returns 200 for the same
 * `engineer` operator. This endpoint mirrors that posture for the row data:
 *
 *   - gated by `requireAdminTier` (custom-role-aware, NOT the Better Auth
 *     literal-`admin` gate), so EVERY admin-tier operator reaches it —
 *     including a custom top role;
 *   - reads the auth `user` table directly via the dialect-aware
 *     `authUsersTable()` selector (PG `auth.user` / SQLite `auth_user`);
 *   - returns the secret-free subset the directory table renders.
 *
 * Source story: [internal ref]
 *
 * @see src/presentation/api/routes/admin/users-overview.ts — the sibling
 *   admin-tier endpoint reading the auth `user` table directly (the pattern).
 * @see src/infrastructure/database/repositories/tables/users-overview-repository-live.ts
 *   — the dialect-aware `authUsersTable()` read pattern the directory repository mirrors.
 * @see src/presentation/islands/admin/users/admin-users-directory-data.ts —
 *   `loadDirectory()`, repointed from `/api/auth/admin/list-users` to this endpoint.
 * @see src/domain/models/api/admin/connections/connections.ts — the flat
 *   `{ <items> }` admin-list-response precedent this mirrors.
 */

import { z } from '@hono/zod-openapi'

// ─── Directory User Row ──────────────────────────────────────────────────────

/**
 * A single account row in the directory — the secret-free subset the
 * `EndUserRow` table renders. Flat projection of one `auth.user` row.
 *
 * `.strict()` is the SECURITY INVARIANT: any extra key — especially anything
 * credential-shaped (`password`, `banReason`) — fails validation rather than
 * leaking. The exposed set is EXACTLY what the table needs:
 *   - `id`     — the subject id the row actions (set-role / ban / unban) target;
 *   - `email`  — the account's address (the table's primary column + search key);
 *   - `role`   — the account's role pill. `auth.user.role` is nullable; the
 *     handler coalesces a null/empty role to the app's default role string
 *     before emitting, so this field is always a non-empty string here;
 *   - `banned` — the account's ban state, driving the Statut pill (actif / banni).
 *
 * Listing EVERY account (operators AND app users alike) is the directory's
 * "Customers"-model contract — the operator has one console for the whole user
 * population — so the signed-in operator's own row is always present.
 */
export const adminDirectoryUserSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe(
        'Subject identifier of the account (`auth.user.id`). The id the row actions (set-role / ban-user / unban-user) target.'
      ),
    email: z
      .string()
      .min(1)
      .describe(
        'Account e-mail address (`auth.user.email`). The directory’s primary column and the client-side search key.'
      ),
    role: z
      .string()
      .min(1)
      .describe(
        'Account role (`auth.user.role`). The column is nullable in storage; the handler coalesces a null/empty role to the app default role, so this is always a non-empty string. The vocabulary is the APP’s configured roles, not the operator tier.'
      ),
    banned: z
      .boolean()
      .describe(
        'Whether the account is banned (`auth.user.banned`). Drives the Statut pill: `false` → actif, `true` → banni.'
      ),
  })
  .strict()
  .openapi('AdminDirectoryUser')

// ─── Directory List Response ─────────────────────────────────────────────────

/**
 * Response schema for `GET /api/admin/users`.
 *
 * A flat `{ users }` list — no pagination. The auth `user` table is small (the
 * whole account population of one self-hosted app, not a multi-tenant SaaS), and
 * the directory filters client-side, so the cursor envelope the high-volume
 * agents/buckets endpoints use is unnecessary here (same rationale as the
 * connections list). `.strict()` so a stray top-level key cannot smuggle a
 * secret past the boundary.
 *
 * An app with no accounts beyond the bootstrap operator still returns that one
 * operator row (the directory lists the whole population); a truly empty
 * `users: []` is what the island's calm empty state renders.
 */
export const adminUsersDirectoryResponseSchema = z
  .object({
    users: z
      .array(adminDirectoryUserSchema)
      .describe(
        'Every account in the auth `user` table — operators and app users alike — as secret-free directory rows.'
      ),
  })
  .strict()
  .openapi('AdminUsersDirectoryResponse')

// ─── Inferred types ──────────────────────────────────────────────────────────

/** @public */
export type AdminDirectoryUser = z.infer<typeof adminDirectoryUserSchema>
/** @public */
export type AdminUsersDirectoryResponse = z.infer<typeof adminUsersDirectoryResponseSchema>
