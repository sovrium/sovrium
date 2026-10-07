/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The role a stored `role` column grants, judged against the app's vocabulary.
 *
 * Better Auth stores the column verbatim, and the write boundaries that refuse
 * an unknown name cannot reach every row: a role removed from the config after
 * it was assigned, a hand-edited row, a NULL left by an import, an empty
 * string. None of those names a role the app declares, so none of them may be
 * read as one — and above all not as `member`, whose bare-table default opens
 * every table carrying no `permissions` block. Each resolves to
 * {@link NO_GRANT_ROLE}, which matches no role list and takes no default.
 */

import { NO_GRANT_ROLE } from '@/domain/models/app/auth/permission-evaluation'
import { isAssignableRole } from './role'
import type { AdminRoleResolvable } from './role'

/**
 * The role a caller is judged on, given what the `role` column holds.
 *
 * - absent (`undefined`/`null`) or empty → {@link NO_GRANT_ROLE}
 * - with an app: a name outside its assignable vocabulary (built-in roles, the
 *   operator-plane tier names, the roles the config declares) →
 *   {@link NO_GRANT_ROLE}
 * - otherwise the stored name, unchanged
 *
 * Without an app only absence is judged: a site that does not hold the app
 * still closes the NULL/empty hole, and the vocabulary is applied wherever the
 * app is known.
 */
export const toGrantingRole = (
  stored: string | null | undefined,
  app?: AdminRoleResolvable
): string => {
  if (stored === undefined || stored === null || stored === '') return NO_GRANT_ROLE
  if (app !== undefined && !isAssignableRole(stored, app)) return NO_GRANT_ROLE
  return stored
}
