/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { assignableRoleNames, isAssignableRole, resolveAdminRole } from './role'
import type { AdminRoleResolvable } from './role'

/**
 * The rules every door that writes a user's role applies, in one place.
 *
 * A role reaches `user.role` through the Better Auth admin endpoints (guarded
 * by a `before` hook), through Sovrium's own `PATCH /api/auth/admin/users/:id`
 * route, and through the `auth/assignRole` automation action. Each door reads
 * the values it needs its own way; the DECISIONS — which names are assignable,
 * what counts as removing an admin, and the words of each refusal — live here,
 * so the doors cannot drift apart.
 */

/**
 * Normalise a role value into individual role names, leniently.
 *
 * Better Auth's own `parseRoles` joins an array with `,` and its
 * `hasPermission` splits on `,`, so `'member,admin'`, `['member', 'admin']` and
 * `['member,admin']` are the same thing to it. This reads a value the way the
 * most permissive reader would — used to decide whether a STORED role (or an
 * already-validated payload) grants a role. It is NOT the write vocabulary:
 * {@link findUnassignableRoleSegment} refuses anything but one exact name.
 */
export const roleSegments = (raw: unknown): readonly string[] =>
  (Array.isArray(raw) ? raw : [raw])
    .filter((value): value is string => typeof value === 'string')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '')

/**
 * The value a role payload would be stored as, mirroring Better Auth's own
 * `parseRoles`: an array is joined with `,`, a string is kept verbatim —
 * neither trimmed nor de-duplicated. `undefined` when the payload carries no
 * role at all (an `update-user` that does not touch it).
 */
const storedRoleValue = (raw: unknown): string | undefined => {
  if (raw === undefined || raw === null) return undefined
  return Array.isArray(raw) ? raw.map(String).join(',') : String(raw)
}

/**
 * The part of a role payload that the app cannot assign, or `undefined` when
 * the payload names exactly one assignable role (or carries no role at all).
 *
 * A write must name ONE assignable role, byte for byte, because that exact
 * string is what gets stored and every Sovrium reader compares the stored value
 * whole (`isAdminRole`, `isAdminEquivalent`, the permission ladder). A value
 * that merely CONTAINS valid names — `' admin'`, `'admin,'`, `'member,admin'`,
 * `['admin', 'member']`, `''` — is stored verbatim, matches no role on read, and
 * would strip the user of access while passing a per-segment check. On the last
 * admin that is a lockout the last-admin rail cannot see, since the payload
 * still "names" an admin.
 *
 * The first undeclared segment is reported when there is one (so
 * `'member,superadmin'` names `'superadmin'`); otherwise the whole value is.
 */
export const findUnassignableRoleSegment = (
  raw: unknown,
  app: AdminRoleResolvable
): string | undefined => {
  const value = storedRoleValue(raw)
  if (value === undefined || isAssignableRole(value, app)) return undefined
  return (
    value.split(',').find((segment) => segment !== '' && !isAssignableRole(segment, app)) ?? value
  )
}

/**
 * The refusal for an unassignable role. It lists the valid roles: every caller
 * that can reach it is already an admin (or the config author), so this
 * discloses nothing they cannot read elsewhere, and it makes the rejection
 * self-explanatory.
 */
export const unassignableRoleMessage = (invalid: string, app: AdminRoleResolvable): string => {
  const valid = [...assignableRoleNames(app)].toSorted().join(', ')
  return `Role '${invalid}' is not assignable. Valid roles: ${valid}.`
}

/**
 * The role names that can actually reach the admin endpoints for this app: the
 * app's resolved admin-equivalent role plus the literal `'admin'` when they
 * differ (mirroring `isAdminEquivalent`'s dual clause).
 *
 * Deliberately NOT the whole admin tier: an `admin-viewer` / `operator` cannot
 * manage roles, so counting it as an admin would leave the door locked while
 * the rail reported it open.
 */
export const adminRoleNamesFor = (app: AdminRoleResolvable): readonly string[] => {
  const resolved = resolveAdminRole(app)
  return resolved === 'admin' ? [resolved] : [resolved, 'admin']
}

/**
 * `true` when a raw stored role value grants at least one of `names`. An absent
 * role is `false`, so "could not read the role" is never mistaken for "holds
 * the role".
 */
export const grantsAnyOf = (role: string | undefined, names: readonly string[]): boolean =>
  role !== undefined && roleSegments(role).some((segment) => names.includes(segment))

/**
 * `true` when `nextRole` names a role but no admin-capable one — the payload
 * half of a demotion, decidable before the target's current role is read. A
 * payload naming no role is not a demotion (there is nothing to write).
 */
export const namesNoAdminRole = (nextRole: unknown, app: AdminRoleResolvable): boolean => {
  const adminRoles = adminRoleNamesFor(app)
  const next = roleSegments(nextRole)
  return next.length > 0 && !next.some((segment) => adminRoles.includes(segment))
}

/**
 * `true` when writing `nextRole` over `currentRole` takes an admin away: the new
 * value names no admin-capable role, and the user holds one today.
 */
export const demotesAnAdmin = (
  nextRole: unknown,
  currentRole: string | undefined,
  app: AdminRoleResolvable
): boolean => namesNoAdminRole(nextRole, app) && grantsAnyOf(currentRole, adminRoleNamesFor(app))

/**
 * `true` when the admin being demoted is the last one who can still sign in.
 * `remainingAdmins` counts non-banned admins INCLUDING the one being demoted.
 * An unknown count (`undefined`) lets the write through: the rail is a
 * foot-gun guard between trusted operators, not a security boundary, and a
 * transient read failure must not make role management unusable.
 */
export const isLastAdmin = (remainingAdmins: number | undefined): boolean =>
  remainingAdmins !== undefined && remainingAdmins <= 1

/** The refusal for removing the last admin, shared word for word by every door. */
export const lastAdminRemovalMessage = (app: AdminRoleResolvable): string =>
  `Cannot remove the last remaining admin. Promote another user to '${resolveAdminRole(app)}' first.`

/**
 * `true` when a count taken AFTER a demoting write finds no admin left who can
 * still sign in — the write must be undone.
 *
 * The before-write check ({@link isLastAdmin}) reads the count before anything
 * changed, so two demotions of the last two admins sent together can both pass
 * it. Each write commits before its own recount, so at least one of the two
 * recounts runs after both writes and finds zero: that request puts its target
 * back and is refused. An unknown count (`undefined`) is not zero, for the same
 * reason {@link isLastAdmin} lets an unknown count through.
 */
export const leavesNoAdmin = (remainingAdmins: number | undefined): boolean => remainingAdmins === 0

/**
 * `true` when banning a user takes an admin away: the user holds an
 * admin-capable role today and is not already banned. A banned admin cannot
 * sign in and is not counted, so banning one again removes nobody.
 */
export const bansAnAdmin = (
  currentRole: string | undefined,
  alreadyBanned: boolean,
  app: AdminRoleResolvable
): boolean => !alreadyBanned && grantsAnyOf(currentRole, adminRoleNamesFor(app))

/** An account as the erasure reads it when it counts who can still administer the app. */
export interface AdminCandidate {
  readonly id: string
  readonly role: string | null | undefined
  readonly banned: boolean | null | undefined
}

/**
 * How many of `candidates` can still administer the app once `erasedUserId` is
 * gone: an admin-capable role, not banned, and not the account being erased.
 *
 * The erasure counts under a lock rather than before it, so it cannot use the
 * database's own count; it reads the admin rows it holds and applies this. The
 * rule is {@link bansAnAdmin}'s — the accounts whose loss would take an admin
 * away — so the rail at scheduling and the rail at erasure agree on who counts.
 */
export const otherActiveAdmins = (
  candidates: readonly AdminCandidate[],
  erasedUserId: string,
  app: AdminRoleResolvable
): number =>
  candidates.filter(
    (candidate) =>
      candidate.id !== erasedUserId &&
      bansAnAdmin(candidate.role ?? undefined, candidate.banned === true, app)
  ).length

/**
 * The role change a write makes, or `undefined` when it makes none.
 *
 * `nextRole` is the payload as it will be stored (see `storedRoleValue`); a
 * payload carrying no role, or the role the user already holds, changes
 * nothing and is not a role change. `previousRole` is `null` for an account
 * whose role column is empty.
 */
export const roleChangeOf = (
  previousRole: string | undefined,
  nextRole: unknown
): { readonly previousRole: string | null; readonly role: string } | undefined => {
  const role = storedRoleValue(nextRole)
  if (role === undefined || role === previousRole) return undefined
  // eslint-disable-next-line unicorn/no-null -- the audit entry carries `null` for an empty role column, never an absent key
  return { previousRole: previousRole ?? null, role }
}
