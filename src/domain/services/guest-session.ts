/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const GUEST_USER_ID = 'guest'

export const SYSTEM_USER_ID = 'system'

export function isGuestSession(userId: string | undefined): boolean {
  return userId === GUEST_USER_ID
}

export function isSystemSession(userId: string | undefined): boolean {
  return userId === SYSTEM_USER_ID
}

export function isAuthenticatedSession(userId: string | undefined): boolean {
  return !isGuestSession(userId)
}
