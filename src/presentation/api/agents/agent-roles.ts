/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Role-level resolution for the agent approval RBAC gate.
 *
 * The `admin > member > viewer` level TABLE is owned by the domain
 * ({@link BUILT_IN_ROLE_LEVELS}) and imported here — it is one fact, not two.
 *
 * The UNKNOWN-ROLE FALLBACK, however, is deliberately different from the
 * domain's, and the two must NOT be merged:
 *
 * - The domain's private `resolveRoleLevel` falls back to the `member` level
 *   (40). Its input is a role DECLARED in `app.auth.roles[]` that simply omits
 *   `level`, and its callers (`resolveAdminRole`, `isAdminEquivalent`) rank
 *   declared roles against each other. A 0 fallback there would sort an
 *   undeclared-level custom role below `viewer`, silently changing which role
 *   an app considers admin-equivalent.
 *
 * - This module falls back to 0. Its input is the role string carried by a
 *   session — an arbitrary value — compared with `>=` against the approver role
 *   an agent requires. 0 is the fail-closed choice: an unrecognised role can
 *   never satisfy the gate. A 40 fallback here would silently promote every
 *   unknown role to member level and let it approve member-gated actions.
 *
 * Same table, opposite risk. Naming them apart and stating why is the fix.
 */

import { BUILT_IN_ROLE_LEVELS } from '@/domain/models/app/auth/roles'
import type { App } from '@/domain/models/app'

/**
 * Resolve a role's hierarchy level from `auth.roles` (falling back to the
 * built-in table). Unknown roles resolve to 0 — see the module docstring for
 * why this fallback differs from the domain resolver's.
 */
export const resolveRoleLevel = (app: App | undefined, roleName: string): number => {
  const declared = app?.auth?.roles?.find((role) => role.name === roleName)
  if (declared?.level !== undefined) return declared.level
  return BUILT_IN_ROLE_LEVELS[roleName] ?? 0
}
