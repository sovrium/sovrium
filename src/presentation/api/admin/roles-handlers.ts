/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `GET /api/admin/roles` — the role names this app may assign, as rows.
 *
 * ─── WHY IT EXISTS ─────────────────────────────────────────────────────────
 *
 * The set is `assignableRoleNames(app)`: the built-ins, the admin-tier names,
 * and every name declared in `app.auth.roles[]`. It is COMPUTED from the auth
 * config and stored in no table, so a config `select` cannot reach it through
 * the table-backed option source — which is exactly why the Users and
 * Invitations consoles still synthesise their role pickers in TypeScript, each
 * calling `assignableRoleNames` directly.
 *
 * Hardcoding the list into a config was measured and rejected: narrowing a role
 * picker to the built-in names, on a partner-shaped app, left it sharing ZERO
 * members with the roles that app declares. That is not a degradation — it is a
 * control offering nothing the operator can pick.
 *
 * ─── SHAPE ─────────────────────────────────────────────────────────────────
 *
 * A rows envelope (`{ roles, total }`) rather than a bare array, so the shared
 * `rowsKey` / `totalKey` contract every other system source reads applies here
 * unchanged. Each row is `{ name }` — a role name is its own identity, and
 * inventing a numeric id would give a picker something to submit that no write
 * endpoint accepts.
 *
 * Ordered, because an option list whose order depends on declaration accidents
 * is neither stable across configs nor reproducible in a test.
 *
 * ─── WHAT IT IS NOT ────────────────────────────────────────────────────────
 *
 * Read-only, and a projection of configuration rather than of data: it reads no
 * table and reveals nothing about who holds which role. Whether a given caller
 * may ASSIGN a given role is a separate decision, enforced where the write
 * happens (`admin-role-guards.ts`); offering a name here never grants one.
 *
 * Auth gating is handled upstream by `requireAdminTier()` in
 * `admin-route-guards.ts`.
 */

import { assignableRoleNames } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Build the handler bound to an App, mirroring the other admin read routes. */
export function createHandleGetAdminRoles(app: App) {
  return function handleGetAdminRoles(c: Context): Response {
    const names = [...assignableRoleNames(app)].toSorted((a, b) => a.localeCompare(b))
    return c.json({ roles: names.map((name) => ({ name })), total: names.length })
  }
}
