/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export interface UserSession {
  readonly id: string
  readonly userId: string
  readonly token: string
  readonly expiresAt: Date
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly impersonatedBy: string | null
  readonly activeOrganizationId: string | null
}

export type Session = UserSession
