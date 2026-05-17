/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { UserSession } from '@/application/ports/models/user-session'

/**
 * Build a guest session for automation-driven record creation when the app
 * has no auth configured. Structurally compatible with `UserSession`.
 *
 * `ipAddress`, `userAgent`, `impersonatedBy`, and `activeOrganizationId` use
 * explicit `null` rather than `undefined` because the `UserSession` interface
 * declares them as `string | null` (matches Better Auth's session shape).
 *
 * Centralised here so every action handler that needs to create records on
 * behalf of an automation uses the same session shape (and so the
 * `unicorn/no-null` exemption is justified in exactly one place).
 */
export const buildGuestSession = (): UserSession => ({
  id: 'automation',
  userId: 'guest',
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
