/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { UserSession } from '@/application/ports/models/user-session'

export const buildGuestSession = (): UserSession => ({
  id: 'automation',
  userId: 'guest',
  token: '',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  ipAddress: null,
  userAgent: null,
  impersonatedBy: null,
  activeOrganizationId: null,
})
