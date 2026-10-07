/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminTier, type AdminRoleResolvable } from './roles'
import type { PasskeysConfig } from './passkeys'

/** The sign-in method recorded on a session a passkey opened. */
export const PASSKEY_SIGN_IN_METHOD = 'passkey'

/**
 * Whether the admin plane must turn this session away because the app requires
 * a passkey for admins (`auth.passkeys.requireForAdmin`) and the session was
 * opened some other way.
 *
 * Callers ask it AFTER their own admin-tier check: it never admits anyone, it
 * only holds an admin's password session at the door — with the same 404 a
 * non-admin gets — until they sign in again with a passkey. Their password
 * session can still register one, since the passkey routes are not the admin
 * plane.
 */
export const adminPlaneNeedsPasskey = (
  app: { readonly auth?: object },
  signInMethod: string | null | undefined
): boolean => requiresPasskeyForAdmin(app.auth) && signInMethod !== PASSKEY_SIGN_IN_METHOD

/**
 * Whether an auth block sets `passkeys.requireForAdmin`. Typed loosely on
 * purpose: the admin guards hold the app through narrower role-resolution
 * shapes that do not name `passkeys`.
 */
const requiresPasskeyForAdmin = (auth: object | undefined): boolean => {
  const passkeys: PasskeysConfig | undefined =
    auth !== undefined && 'passkeys' in auth ? (auth.passkeys as PasskeysConfig) : undefined
  return typeof passkeys === 'object' && passkeys.requireForAdmin === true
}

/** Whether an admin-plane door admits a caller its role admits, given how the session was opened. */
export const adminPlaneAdmits = (
  roleAdmits: boolean,
  app: { readonly auth?: object },
  signInMethod: string | null | undefined
): boolean => roleAdmits && !adminPlaneNeedsPasskey(app, signInMethod)

/** A Better Auth session envelope, as the admin API door reads it. */
export interface AdminDoorSession {
  readonly user?: { readonly role?: string }
  readonly session?: { readonly signInMethod?: string | null }
}

/** Whether the admin API admits this session: an admin role, and a passkey when required. */
export const admitsToAdminApi = (
  result: AdminDoorSession | null,
  app: { readonly auth?: object },
  isAdminRole: (role: string) => boolean
): boolean => {
  const role = result?.user?.role
  return adminPlaneAdmits(
    role !== undefined && isAdminRole(role),
    app,
    result?.session?.signInMethod
  )
}

/** Whether the operator console admits this session: an admin-tier role, and a passkey when required. */
export const consoleAdmits = (
  session: { readonly role: string; readonly signInMethod?: string },
  app: AdminRoleResolvable & { readonly auth?: object }
): boolean => adminPlaneAdmits(isAdminTier(session.role, app), app, session.signInMethod)
