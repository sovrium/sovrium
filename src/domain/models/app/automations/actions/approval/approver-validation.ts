/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent, type AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'

/**
 * Who may resolve an automation approval request: the literal `all-admins`, or
 * the email addresses and role names the request names.
 */
export type ApproverList = 'all-admins' | readonly string[]

/** The signed-in person asking to resolve (or list) an approval request. */
export interface ApprovalCaller {
  /** The caller's account id; matched against the accounts a request pinned. */
  readonly userId?: string
  /** The caller's global role (`member` when the account carries none). */
  readonly role: string
}

/**
 * What a request persists when it names approvers: the list as written, and —
 * for every address in it — the account that held the address when the
 * request was made, keyed by the address lowercased. An address no account
 * held then is absent, and names nobody.
 */
export interface PinnedApprovers {
  readonly list: readonly string[]
  readonly accounts: Readonly<Record<string, string>>
}

/**
 * Whether `role` is an admin for approvals: the built-in `admin` role or the
 * app's top role. A read-only operator role (`admin-viewer`, `admin-editor`,
 * `operator`) reaches the console but is not one — releasing a paused run
 * is a write, and those roles are granted reads.
 */
export const isApprovalAdmin = (role: string, app: AdminRoleResolvable): boolean =>
  isAdminEquivalent(role, app)

/** Whether a list entry is an email address rather than a role name. */
const isAddress = (entry: string): boolean => entry.includes('@')

/** The email addresses a list names, lowercased — the ones to pin to accounts. */
export const approverAddresses = (list: ApproverList): readonly string[] =>
  list === 'all-admins' ? [] : list.filter(isAddress).map((entry) => entry.trim().toLowerCase())

/** Pin each address in `list` to the account that holds it now. */
export const pinApprovers = (
  list: readonly string[],
  holders: ReadonlyMap<string, string>
): PinnedApprovers => ({
  list,
  accounts: Object.fromEntries(
    approverAddresses(list).flatMap((address) => {
      const holder = holders.get(address)
      return holder === undefined ? [] : [[address, holder] as const]
    })
  ),
})

const isPinned = (raw: unknown): raw is PinnedApprovers =>
  typeof raw === 'object' &&
  raw !== null &&
  Array.isArray((raw as { readonly list?: unknown }).list) &&
  typeof (raw as { readonly accounts?: unknown }).accounts === 'object'

/**
 * The accounts a persisted request pinned its addresses to, or `undefined` for
 * a request recorded before pinning existed (its addresses then name nobody).
 */
export const toApproverAccounts = (raw: unknown): Readonly<Record<string, string>> | undefined =>
  isPinned(raw) ? raw.accounts : undefined

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
  if (isPinned(raw)) return toApproverList(raw.list)
  if (!Array.isArray(raw)) return 'all-admins'
  const entries = raw.filter((entry): entry is string => typeof entry === 'string')
  return entries.length === 0 ? 'all-admins' : entries
}

/**
 * `true` when `caller` is an approver the request names.
 *
 * - `all-admins`: the caller is an admin — the built-in `admin` role or the
 *   app's top role; a read-only operator role is not one.
 * - a list: an entry equals the caller's role exactly, or is an address that
 *   names the caller. An address names the account that held it when the
 *   request was made (`accounts`) — an account registered later with that
 *   address is not an approver. A request recorded before addresses were
 *   pinned has no such account, so its addresses name nobody: the roles it
 *   names, or its timeout, resolve it. Matching them against the caller's email
 *   instead would let whoever registers the address while it waits claim it.
 *
 * `undefined` / `null` approvers mean `all-admins`.
 */
export const isNamedApprover = (
  approvers: ApproverList | null | undefined,
  caller: ApprovalCaller,
  app: AdminRoleResolvable,
  accounts?: Readonly<Record<string, string>>
): boolean => {
  if (approvers === undefined || approvers === null || approvers === 'all-admins') {
    return isApprovalAdmin(caller.role, app)
  }
  return approvers.some((entry) => {
    const candidate = entry.trim()
    if (candidate === caller.role) return true
    if (accounts === undefined || !isAddress(candidate)) return false
    const holder = accounts[candidate.toLowerCase()]
    return holder !== undefined && holder === caller.userId
  })
}

/**
 * Whether `caller` may resolve a request as persisted: an approver it names
 * ({@link isNamedApprover} over its list and the accounts it pinned), or any
 * admin (the built-in `admin` role or the app's top role). The admin clause is the operator's way out of a request
 * nobody named can still answer — one recorded before addresses were pinned,
 * naming addresses only and carrying no timeout, would otherwise wait forever.
 */
export const isPersistedApprover = (
  persisted: unknown,
  caller: ApprovalCaller,
  app: AdminRoleResolvable
): boolean =>
  isApprovalAdmin(caller.role, app) ||
  isNamedApprover(toApproverList(persisted), caller, app, toApproverAccounts(persisted))
