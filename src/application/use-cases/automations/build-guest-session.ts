/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { GUEST_USER_ID, SYSTEM_USER_ID } from '@/domain/services/guest-session'
import type { UserSession } from '@/application/ports/models/user-session'

/**
 * Build a synthetic server-side session with the given actor id. Structurally
 * compatible with `UserSession`.
 *
 * `ipAddress`, `userAgent`, `impersonatedBy`, and `activeOrganizationId` use
 * explicit `null` rather than `undefined` because the `UserSession` interface
 * declares them as `string | null` (matches Better Auth's session shape).
 *
 * Centralised here so every server-side writer (automation action handlers,
 * form-submission persistence) uses the same session shape (and so the
 * `unicorn/no-null` exemption is justified in exactly one place).
 */
export const buildSyntheticSession = (userId: string): UserSession => ({
  id: 'automation',
  userId,
  token: '',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  // eslint-disable-next-line unicorn/no-null -- UserSession.ipAddress is `string | null`
  ipAddress: null,
  // eslint-disable-next-line unicorn/no-null -- UserSession.userAgent is `string | null`
  userAgent: null,
  // eslint-disable-next-line unicorn/no-null -- UserSession.impersonatedBy is `string | null`
  impersonatedBy: null,
  // eslint-disable-next-line unicorn/no-null -- UserSession.activeOrganizationId is `string | null`
  activeOrganizationId: null,
})

/**
 * Build a guest session (userId = {@link GUEST_USER_ID}) for read-only / no-auth
 * automation paths. Persistence layers translate the guest id to SQL `NULL` for
 * any authorship column.
 */
export const buildGuestSession = (): UserSession => buildSyntheticSession(GUEST_USER_ID)

/**
 * Build a SYSTEM-AUTHORITY session (userId = {@link SYSTEM_USER_ID}) for
 * trusted, automation-driven record writes. Unlike the guest session, the
 * system id is a real, durable actor id that satisfies NOT-NULL authorship
 * columns rather than being normalized to NULL — so a `record/create` into a
 * table with a NOT-NULL `created-by` column succeeds, and a `record/update`
 * stamps `updated_by` with the system actor instead of silently wiping it.
 */
export const buildSystemSession = (): UserSession => buildSyntheticSession(SYSTEM_USER_ID)
