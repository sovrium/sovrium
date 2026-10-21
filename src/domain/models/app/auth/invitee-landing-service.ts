/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where an invitee who just joined lands, when the operator console cannot be
 * that place.
 *
 * Every console page answers 404 to a role outside the console tier, yet an
 * invitation may carry any role. An invitee who can open the console is sent
 * there by the page they accepted on; anyone else is sent into the operator's
 * app: its `auth.landingPath`, where each role is routed onward, else its root.
 * No member area exists inside the console.
 */

import { isAdminTier, type AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'

/** The app facts the answer reads: its role vocabulary and its landing path. */
export type InviteeLandingApp = AdminRoleResolvable & {
  readonly auth?: { readonly landingPath?: string }
}

/**
 * The app path an invitee holding `role` lands on, or `undefined` when the role
 * opens the console. An account with no stored role is a `member`.
 */
export const inviteeAppLanding = (
  role: string | null | undefined,
  app: InviteeLandingApp
): string | undefined => {
  const held = role === null || role === undefined || role === '' ? 'member' : role
  if (isAdminTier(held, app)) return undefined
  return app.auth?.landingPath ?? '/'
}
