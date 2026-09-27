/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminTier, type AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'

/**
 * Who may resolve an automation approval request: the literal `all-admins`, or
 * the email addresses and role names the request names.
 */
export type ApproverList = 'all-admins' | readonly string[]

/** The signed-in person asking to resolve (or list) an approval request. */
export interface ApprovalCaller {
  /** The caller's account email; `undefined` when the account has none on record. */
  readonly email: string | undefined
  /** The caller's global role (`member` when the account carries none). */
  readonly role: string
}

/**
 * Read a persisted `approvers` value back into an {@link ApproverList}.
 *
 * Anything that is not an array of strings reads as `all-admins`: the value is
 * absent on requests recorded before the column existed and on agent rows, and
 * an omitted `approvers` means `all-admins` by definition. Non-string members of
 * an array are dropped rather than failing the whole list, and an array that
 * holds no string at all also falls back to `all-admins` — a request can never
 * end up resolvable by nobody.
 */
export const toApproverList = (raw: unknown): ApproverList => {
  if (!Array.isArray(raw)) return 'all-admins'
  const entries = raw.filter((entry): entry is string => typeof entry === 'string')
  return entries.length === 0 ? 'all-admins' : entries
}

/**
 * `true` when `caller` is an approver the request names.
 *
 * - `all-admins`: the caller's role is admin-tier for the app, so a custom top
 *   role counts as `admin` does.
 * - a list: an entry equals the caller's email ignoring case (and surrounding
 *   whitespace), or equals the caller's role exactly.
 *
 * `undefined` / `null` approvers mean `all-admins`.
 */
export const isNamedApprover = (
  approvers: ApproverList | null | undefined,
  caller: ApprovalCaller,
  app: AdminRoleResolvable
): boolean => {
  if (approvers === undefined || approvers === null || approvers === 'all-admins') {
    return isAdminTier(caller.role, app)
  }
  const email = caller.email?.trim().toLowerCase()
  return approvers.some((entry) => {
    const candidate = entry.trim()
    if (candidate === caller.role) return true
    return email !== undefined && email !== '' && candidate.toLowerCase() === email
  })
}
