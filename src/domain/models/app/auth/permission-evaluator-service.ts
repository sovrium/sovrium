/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  anonymousGrant,
  isNoAuthVisitor,
  type TableOperation,
} from '@/domain/models/app/auth/anonymous-grant-service'
import { splitGroupReferences } from '@/domain/models/app/auth/groups/group-reference'
import {
  classifyPermissionRung,
  holdsDefaultGrant,
  isSignedOutVisitorRole,
  matchesRoleList,
  toPermissionValue,
} from '@/domain/models/app/auth/permission-evaluation'
import {
  getEffectivePermissions,
  inheritanceFailed,
  tablesOf,
  type TableGateScope,
} from '@/domain/models/app/auth/permission-inheritance-service'
import { checkPermissionWithAdminOverride, isAdminRole } from '@/domain/models/app/auth/permissions'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles/role'
import type {
  TableFieldPermissions,
  TablePermissions,
} from '@/domain/models/app/tables/permissions'

/** Re-exported for the gates that judge a table on its resolved grants. */
export { resolveInheritedPermissions } from '@/domain/models/app/auth/permission-inheritance-service'
export type { TableGateScope } from '@/domain/models/app/auth/permission-inheritance-service'

/**
 * The admin override: does this role outrank every declared grant?
 *
 * The built-in `admin` always does; the app's top role does too when the scope
 * is the app ({@link TableGateScope}).
 */
const outranksEveryGrant = (userRole: string, scope: TableGateScope | undefined): boolean =>
  isAdminRole(userRole) ||
  (scope !== undefined &&
    !Array.isArray(scope) &&
    isAdminEquivalent(userRole, scope as AdminRoleResolvable))

/**
 * Evaluate field-level permissions for a user
 */
export function evaluateFieldPermissions(
  fieldPerms: TableFieldPermissions | undefined,
  userRole: string,
  isAdmin: boolean
): Readonly<Record<string, { read: boolean; write: boolean }>> {
  const fields = fieldPerms ?? []
  return Object.fromEntries(
    fields.map((fieldPerm) => [
      fieldPerm.field,
      {
        read: checkPermissionWithAdminOverride(isAdmin, fieldPerm.read, userRole),
        write: checkPermissionWithAdminOverride(isAdmin, fieldPerm.write, userRole),
      },
    ])
  )
}

/**
 * The two most permissive rungs of the permission ladder: `'all'` (everyone)
 * and `'authenticated'` (any signed-in caller). Neither names a role, so both
 * admit every role — viewer included. `hasReadPermission` has always honoured
 * them; the write evaluators below honour them through this predicate.
 *
 * The one caller `'authenticated'` does NOT admit is a signed-out visitor's
 * synthetic principal: she carries a placeholder session, never a sign-in.
 */
function isOpenPermissionLiteral(permission: unknown, userRole: string): boolean {
  const rung = classifyPermissionRung(toPermissionValue(permission))
  return rung === 'everyone' || (rung === 'any-session' && !isSignedOutVisitorRole(userRole))
}

/**
 * The five keys that make a `permissions` block GATING.
 *
 * `fields`, `inherit` and `override` are deliberately absent: they configure
 * how a grant is scoped or resolved, they are not grants themselves.
 */
const PERMISSION_OPERATION_KEYS = ['read', 'create', 'update', 'delete', 'comment'] as const

/**
 * Whether a resolved `permissions` block leaves an omitted operation OPEN.
 *
 * A block that declares at least one operation is the author saying "gate this
 * table", so every operation it does NOT name is denied to non-admins — the
 * contract the published schema has always advertised. A block that names no
 * operation at all grants nothing and gates nothing, so it behaves exactly as
 * an absent block and the documented allow-non-viewer default stands.
 *
 * That distinction is why the test is per-OPERATION-KEY rather than "does a
 * block exist": `permissions: { fields: [{ field: 'salary', read: ['admin'] }] }`
 * restricts one column's visibility. Reading it as a table-wide gate would
 * revoke the author's own access to the other columns — a worse surprise than
 * the one this default exists to remove.
 */
function omittedOperationIsOpen(effectivePermissions: unknown): boolean {
  if (effectivePermissions === undefined || effectivePermissions === null) return true
  const block = effectivePermissions as Readonly<Record<string, unknown>>
  return !PERMISSION_OPERATION_KEYS.some((operation) => block[operation] !== undefined)
}

/**
 * What an evaluator answers before it reads a table's grants: `true` for a
 * caller who outranks every grant, the no-auth rule ({@link anonymousGrant})
 * for the visitor of an app without sign-in, `undefined` for anyone else.
 */
function answerBeforeGrants(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  operation: TableOperation,
  userRole: string,
  scope: TableGateScope | undefined
): boolean | undefined {
  if (outranksEveryGrant(userRole, scope)) return true
  return isNoAuthVisitor(userRole, scope) ? anonymousGrant(table, operation, scope) : undefined
}

/**
 * Does a declared role allowlist admit this caller?
 *
 * The ONE membership test for every allowlist branch below, and deliberately
 * {@link matchesRoleList} rather than a bare `Array.includes(userRole)`: an
 * entry of the form `group:<name>` names a MEMBERSHIP, so it must be matched
 * against the caller's groups and never against the role string. A plain
 * `.includes` answers such an entry only when the caller literally holds the
 * string `'group:<name>'` as a role — which is what a `*ForRoles` fold over the
 * raw list would hand it, honouring a grant on some operations and leaving it
 * inert on others. Splitting role from membership once, here, keeps every
 * operation on the same answer.
 */
function grantAdmits(
  grant: readonly string[],
  userRole: string,
  groups: readonly string[]
): boolean {
  return matchesRoleList(grant, { role: userRole, groups })
}

/**
 * Fold a `*ForRoles` evaluator over the callers an effective-roles list denotes.
 *
 * `effectiveRoles` (see `buildEffectiveRoles`) is a flat list mixing real role
 * names with `group:<name>` pseudo-entries. Only the real names belong in the
 * role slot; the memberships ride alongside on every evaluation, so a grant may
 * be satisfied by the role half or by the group half — most-permissive-wins.
 *
 * The two degenerate inputs differ on purpose. An EMPTY list evaluates nothing
 * and denies, unchanged. A list of memberships ONLY still gets one evaluation,
 * under the empty role name: it matches no allowlist entry and is not `admin`,
 * so only the group half can grant.
 */
function anyEffectiveCallerAdmits(
  effectiveRoles: readonly string[],
  admits: (userRole: string, groups: readonly string[]) => boolean
): boolean {
  const { roles, groups } = splitGroupReferences(effectiveRoles)
  const roleSlots = roles.length > 0 ? roles : groups.length > 0 ? [''] : []
  return roleSlots.some((role) => admits(role, groups))
}

/**
 * The effective roles a WRITE (create, update, delete) is judged on.
 *
 * THE VIEWER ACCOUNT ROLE NEVER WRITES THROUGH A GRANT IT DOES NOT HOLD ITSELF.
 * A caller whose account role is `viewer` — the first entry of every
 * effective-roles list (`buildEffectiveRoles` puts the account role first) —
 * is judged on that role alone: a group she belongs to or a role an
 * assignment gives her still opens a table to her READ, but never lets her
 * create, update or delete. A grant that names `viewer` itself, or an open
 * `'all'` / `'authenticated'` grant, still admits her, exactly as before.
 *
 * This is the ONE place the rule lives: every write gate — the records API,
 * its batch and form routes, restore, record buttons, upsert, the MCP tools,
 * automations and AI chat — asks a `*PermissionForRoles` evaluator below, and
 * the inline-edit affordance follows it so a grid never offers an edit the
 * write would refuse.
 */
function writingRoles(effectiveRoles: readonly string[]): readonly string[] {
  return effectiveRoles[0] === 'viewer' ? ['viewer'] : effectiveRoles
}

/** The five operations a table's `permissions` block grants. */
export type PermissionOperation = TableOperation

/** The table shape every operation is judged on: its grants, and a `comments` block. */
type GatedTable = Readonly<{ name: string; comments?: unknown; permissions?: unknown }>

/** What an operation's grant is judged against, once its effective permissions are resolved. */
interface GrantJudgement {
  readonly table: GatedTable | undefined
  readonly userRole: string
  readonly groups: readonly string[]
  readonly scope: TableGateScope | undefined
  /** The table's permissions, inheritance and override resolved. */
  readonly effectivePerms: unknown
}

/** How ONE operation departs from the shared algorithm of {@link hasOperationPermission}. */
export interface OperationRule {
  /**
   * The answer given before the grants are read — `undefined` hands on to the
   * grant. For every operation but `comment` that is the admin override, then
   * the no-auth visitor's rule ({@link answerBeforeGrants}).
   */
  readonly before: (
    table: GatedTable | undefined,
    userRole: string,
    scope: TableGateScope | undefined
  ) => boolean | undefined
  /** Judge the operation's declared grant (`undefined` when it declares none). */
  readonly judge: (grant: unknown, judgement: GrantJudgement) => boolean
  /**
   * Whether the effective roles are folded as a WRITE ({@link writingRoles}):
   * a `viewer` account is then judged on her own role alone.
   */
  readonly writes: boolean
}

/**
 * The permission ladder every operation but `comment` judges a grant on:
 *
 *  1. an open literal (`'all'`, or `'authenticated'` for a signed-in caller)
 *     admits every role, viewer included — the literals are honoured on writes
 *     exactly as on reads;
 *  2. a declared allowlist is authoritative, and is consulted BEFORE the
 *     default below: naming a role is the plainest statement of intent the
 *     permission format allows, so `create: ['viewer']` grants;
 *  3. nothing declared for this role: closed to every role that does not hold
 *     the default grant — `viewer`, a caller whose stored role grants nothing, a
 *     signed-out visitor. Without this a table with no `permissions` key would
 *     fall through to step 4, which is `true`, and open the operation to each of
 *     them product-wide;
 *  4. else open, unless the block gates the table ({@link omittedOperationIsOpen}).
 *
 * An allowlist and an open literal never overlap, so steps 1 and 2 may be read
 * in either order.
 */
function judgeOnLadder(grant: unknown, judgement: GrantJudgement): boolean {
  const { userRole, groups, effectivePerms } = judgement
  if (isOpenPermissionLiteral(grant, userRole)) return true
  if (Array.isArray(grant)) return grantAdmits(grant, userRole, groups)
  if (!holdsDefaultGrant(userRole)) return false
  return omittedOperationIsOpen(effectivePerms)
}

/** The rule of `read`, `create` and `update`: the shared start, then the ladder. */
const laddered = (operation: TableOperation, writes: boolean): OperationRule => ({
  before: (table, userRole, scope) => answerBeforeGrants(table, operation, userRole, scope),
  judge: judgeOnLadder,
  writes,
})

/**
 * Every operation's rule — the ONE place an operation departs from the shared
 * algorithm, so the five cannot drift apart in order again:
 *
 *  - `delete` refuses every non-admin on a table that declares an admin-scoped
 *    delete override (`permissions.override.admin.delete`), whatever its base
 *    `delete` grant — admins having been admitted just before;
 *  - `comment` follows `permissions.comment`, NOT read. It has no admin
 *    early return (the admin override applies inside a declared grant), refuses
 *    a table it is not given, and when no grant is declared a `comments` block
 *    still marks the table commentable (configs written before the `comment`
 *    grant existed) — else it is open unless the block gates the table: a
 *    "post-it" table, such as an anonymized feedback table, declares a gating
 *    block and neither a grant nor a `comments` block. A false answer is a 404
 *    at every caller (S1: a non-commentable surface is not discoverable).
 */
export const OPERATION_RULES: Readonly<Record<PermissionOperation, OperationRule>> = {
  read: laddered('read', false),
  create: laddered('create', true),
  update: laddered('update', true),
  delete: {
    before: (table, userRole, scope) =>
      answerBeforeGrants(table, 'delete', userRole, scope) ??
      (hasAdminScopedDeleteOverride(table as Parameters<typeof hasAdminScopedDeleteOverride>[0])
        ? false
        : undefined),
    judge: judgeOnLadder,
    writes: true,
  },
  comment: {
    before: (table, userRole, scope) => {
      if (!table) return false
      // An app with no `auth` block: the visitor holds only what the table opens with `'all'`.
      return isNoAuthVisitor(userRole, scope) ? anonymousGrant(table, 'comment', scope) : undefined
    },
    judge: (grant, { table, userRole, groups, scope, effectivePerms }) => {
      if (grant !== undefined) return evaluateCommentGrant(grant, userRole, groups, scope)
      if (table?.comments !== undefined && table.comments !== null) return true
      return omittedOperationIsOpen(effectivePerms)
    },
    writes: false,
  },
}

/** Who asks: one role, and the names of the groups she belongs to (un-prefixed). */
export interface OperationCaller {
  readonly role: string
  readonly groups?: readonly string[]
}

/**
 * May a caller holding `role` (and the `groups` memberships) perform
 * `operation` on a table? The ONE algorithm behind every table-level grant:
 *
 *  1. the operation's early answer ({@link OperationRule.before});
 *  2. the table's effective permissions, `inherit` and `override` resolved — an
 *     inheritance that does not resolve denies;
 *  3. the operation's declared grant, judged by its rule
 *     ({@link OperationRule.judge}).
 */
export function hasOperationPermission(
  operation: PermissionOperation,
  table: GatedTable | undefined,
  caller: OperationCaller,
  allTables?: TableGateScope
): boolean {
  const { role: userRole, groups = [] } = caller
  const rule = OPERATION_RULES[operation]
  const early = rule.before(table, userRole, allTables)
  if (early !== undefined) return early

  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<Record<string, unknown>> | undefined
  const inheriting = table as Readonly<{ permissions?: Readonly<{ inherit?: string }> }> | undefined
  if (inheritanceFailed(inheriting, allTables, effectivePerms)) return false

  const grant = effectivePerms?.[operation]
  return rule.judge(grant, { table, userRole, groups, scope: allTables, effectivePerms })
}

/** An operation's group-aware evaluator, over an effective-roles list. */
export type RolesEvaluator = (
  table: GatedTable | undefined,
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
) => boolean

/**
 * The group-aware evaluator of `operation` (most-permissive-wins): true when
 * ANY of the caller's effective roles is granted it. `effectiveRoles` is the
 * account role plus a `group:<name>` entry per group (`buildEffectiveRoles`);
 * each role is judged with every membership alongside
 * ({@link anyEffectiveCallerAdmits}), and a write is judged on the viewer's own
 * role alone ({@link writingRoles}).
 */
export const forRoles =
  (operation: PermissionOperation): RolesEvaluator =>
  (table, effectiveRoles, allTables) =>
    anyEffectiveCallerAdmits(
      OPERATION_RULES[operation].writes ? writingRoles(effectiveRoles) : effectiveRoles,
      (role, groups) => hasOperationPermission(operation, table, { role, groups }, allTables)
    )

/**
 * Check if user has role-based create permission for a table — an alias of
 * {@link hasOperationPermission}`('create', …)`, kept for its callers.
 * Returns true if permission granted, false if denied
 *
 * Permission logic:
 * - Viewers: denied by default (tables must explicitly grant viewer create access)
 * - Other roles: allowed by default (unless table restricts with role-based permissions)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasCreatePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          create?: unknown
          inherit?: string
          override?: { create?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: TableGateScope,
  groups: readonly string[] = []
): boolean {
  return hasOperationPermission('create', table, { role: userRole, groups }, allTables)
}

/**
 * Whether the table declares an admin-scoped delete override
 * (`permissions.override.admin.delete`). When present, delete is restricted
 * to admins only — non-admin roles are denied regardless of the base
 * `delete` permission.
 */
function hasAdminScopedDeleteOverride(
  table:
    | Readonly<{ permissions?: Readonly<{ override?: { admin?: { delete?: unknown } } }> }>
    | undefined
): boolean {
  const adminOverride = table?.permissions?.override?.admin
  return adminOverride?.delete !== undefined
}

/**
 * Check if user has delete permission for the table — an alias of
 * {@link hasOperationPermission}`('delete', …)`, kept for its callers.
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasDeletePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          delete?: unknown
          inherit?: string
          override?: { delete?: unknown; admin?: { delete?: unknown } }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: TableGateScope,
  groups: readonly string[] = []
): boolean {
  return hasOperationPermission('delete', table, { role: userRole, groups }, allTables)
}

/**
 * Check if user has update permission for a table — an alias of
 * {@link hasOperationPermission}`('update', …)`, kept for its callers.
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer update access)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasUpdatePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          update?: unknown
          inherit?: string
          override?: { update?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: TableGateScope,
  groups: readonly string[] = []
): boolean {
  return hasOperationPermission('update', table, { role: userRole, groups }, allTables)
}

/**
 * Whether a grid should OFFER inline editing by default on this table.
 *
 * This is the permission-derived default behind a data-table column's
 * `editable`, whose schema annotation has always read "default: from table
 * permissions". It is a UI-affordance question, deliberately narrower than
 * "may this caller update?", and it is a strict SUBSET of
 * {@link hasUpdatePermission} — it can only ever withhold an affordance the
 * write path would have allowed, never manufacture one it would refuse.
 * Server-side enforcement is untouched and remains the only security boundary:
 * a refused update still fails at the records API.
 *
 * The extra condition is that the table must actually DECLARE an `update`
 * grant. `hasUpdatePermission` treats an undeclared operation as open to every
 * non-viewer (`omittedOperationIsOpen`), which is right for a write a caller
 * explicitly asked to perform and wrong as a default affordance: it would turn
 * double-click editing on across every grid bound to a table carrying no
 * `permissions` block at all. Measured on `apps/partner`, that is the
 * difference between 11 tables and 52. An absent grant is not a permission to
 * follow, so there is nothing to derive from and the grid stays read-only,
 * exactly as it is today.
 *
 * Inheritance is honoured — the declaration test runs against the EFFECTIVE
 * permissions, so an `inherit`ing table follows the grant it resolves to.
 *
 * Admin still outranks a role list: an admin editing a table whose `update`
 * names only `['engineer']` is the `hasUpdatePermission` early-return doing its
 * job. An admin gets no affordance on a table that declares no `update`
 * either, because such a table opted out of role-based update gating entirely.
 */
export function hasInlineEditDefault(
  table: Parameters<typeof hasUpdatePermission>[0],
  userRole: string,
  allTables?: TableGateScope,
  groups: readonly string[] = []
): boolean {
  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ update?: unknown }> | undefined
  if (effectivePerms?.update === undefined) return false
  return hasUpdatePermission(table, userRole, allTables, groups)
}

/**
 * Check if user has read permission for a table — an alias of
 * {@link hasOperationPermission}`('read', …)`, kept for its callers.
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer access)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasReadPermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{ read?: unknown; inherit?: string; override?: { read?: unknown } }>
      }>
    | undefined,
  userRole: string,
  allTables?: TableGateScope,
  groups: readonly string[] = []
): boolean {
  return hasOperationPermission('read', table, { role: userRole, groups }, allTables)
}

/**
 * True when the table's EFFECTIVE read grant (inheritance resolved) is the
 * `'all'` literal — the one rung that opens a table to a visitor with no
 * session, in an app with an `auth` block. It is the records API's own rule
 * for a signed-out request (`tableOpensToEveryone`, the auth middleware): a
 * role list, `'authenticated'`, an undeclared grant and an inheritance chain
 * that does not resolve all keep that visitor out, so a server render — the
 * one reader she reaches without that middleware — asks the same question.
 */
export function readOpensToEveryone(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  const effective = getEffectivePermissions(table, allTables) as
    Readonly<{ read?: unknown }> | undefined
  return classifyPermissionRung(toPermissionValue(effective?.read)) === 'everyone'
}

/**
 * Check if a user may comment on records in a table — an alias of
 * {@link hasOperationPermission}`('comment', …)`, kept for its callers.
 *
 * Comment-ability follows `permissions.comment`, NOT read. The rule:
 *
 * - When a `permissions.comment` grant is declared it is authoritative — the
 *   user's role must be in it (admin override applies). Read access alone does
 *   NOT confer comment access.
 * - When no `comment` grant is declared, a `comments` block still marks the
 *   table as a commentable surface (backward compatible — configs written before the `comment` grant
 *   existed use a `comments` block and stay read-gated).
 * - A table that declares an explicit `permissions` block but neither a
 *   `comment` grant nor a `comments` block is NON-commentable — a "post-it"
 *   such as an anonymized feedback table. A table
 *   with no `permissions` block at all stays commentable (the documented
 *   fully-open default), so the original bare-table comment specs keep passing.
 *
 * Returns true when commenting is permitted; callers translate false to a 404
 * (S1 anti-enumeration — a non-commentable surface must not be discoverable via
 * the comment endpoint).
 */
export function hasCommentPermission(
  table: Readonly<{ name: string; comments?: unknown; permissions?: TablePermissions }> | undefined,
  userRole: string,
  allTables?: TableGateScope,
  groups: readonly string[] = []
): boolean {
  return hasOperationPermission('comment', table, { role: userRole, groups }, allTables)
}

/**
 * Evaluate a declared `permissions.comment` grant for a caller (admin override
 * applies; `'all'`/`'authenticated'`/role-array are the 3 permission formats).
 *
 * Unlike its four siblings this branch runs the FULL evaluator rather than an
 * array-membership test, which is why the caller's `groups` must reach it: the
 * evaluator matches a `group:<name>` entry against memberships only, so a grant
 * of `comment: ['group:ops']` is unsatisfiable without them.
 */
function evaluateCommentGrant(
  commentGrant: unknown,
  userRole: string,
  groups: readonly string[],
  scope: TableGateScope | undefined
): boolean {
  return checkPermissionWithAdminOverride(
    outranksEveryGrant(userRole, scope),
    commentGrant,
    userRole,
    groups
  )
}

/**
 * Group-aware read permission check (most-permissive-wins): {@link forRoles}`('read')`.
 *
 * Returns true when ANY of the user's effective roles is granted read
 * access. `effectiveRoles` is the user's global role plus a `group:<name>`
 * entry for every group they belong to (see `buildEffectiveRoles`).
 *
 * Used so a table permission of `read: ['admin', 'group:finance']` is
 * satisfied either by the `admin` role or by membership in the `finance`
 * group — the combining rule for multi-group RBAC.
 */
export function hasReadPermissionForRoles(
  table: Parameters<typeof hasReadPermission>[0],
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
): boolean {
  return forRoles('read')(table, effectiveRoles, allTables)
}

/**
 * Who asks a table read gate: the effective roles the evaluator matches, and
 * whether the caller is a visitor who is not signed in.
 *
 * `signedOut` comes from the session's IDENTITY — its user id is the guest
 * sentinel (`isGuestSession`) — never from a role name. An app may call one of
 * its own roles `guest`, and a member signed in under it is a signed-in member.
 */
export interface ReadGateCaller {
  readonly effectiveRoles: readonly string[]
  readonly signedOut: boolean
}

/**
 * Is this caller a visitor who is not signed in, in an app that has sign-in?
 *
 * An app without an `auth` block has no signed-out visitor to tell apart: every
 * caller is the placeholder there, and the evaluator alone decides. A bare
 * table list says nothing about sign-in, so it never marks a caller signed out.
 */
const isSignedOutCaller = (caller: ReadGateCaller, scope: TableGateScope | undefined): boolean =>
  caller.signedOut &&
  scope !== undefined &&
  !Array.isArray(scope) &&
  (scope as AdminRoleResolvable).auth !== undefined

/**
 * The read gate of every door a caller reaches a table's records through.
 *
 * {@link hasReadPermissionForRoles}, plus the one rule that evaluator cannot
 * express: A VISITOR WHO IS NOT SIGNED IN READS ONLY A TABLE WHOSE RESOLVED
 * `read` IS `'all'`. The evaluator's ladder admits every role on
 * `'authenticated'` and on an omitted grant, the signed-out placeholder
 * included, because the records route's own middleware answers her 401 there
 * first. A door that reaches a table's rows without that middleware in front —
 * a create's read-back, a link target, a related table's label — would hand
 * her those rows. "Resolved" is after `inherit` and `override`
 * ({@link readOpensToEveryone}), so an inherited `'all'` opens the table and an
 * inheritance that does not resolve keeps it shut.
 */
export function hasReadPermissionForCaller(
  table: Parameters<typeof hasReadPermission>[0],
  caller: ReadGateCaller,
  scope?: TableGateScope
): boolean {
  if (isSignedOutCaller(caller, scope)) {
    return readOpensToEveryone(table, tablesOf(scope))
  }
  return hasReadPermissionForRoles(table, caller.effectiveRoles, scope)
}

/**
 * Group-aware create permission check (most-permissive-wins): {@link forRoles}`('create')`.
 *
 * Returns true when ANY of the user's effective roles is granted create
 * access. See `hasReadPermissionForRoles` for the effective-roles contract.
 */
export function hasCreatePermissionForRoles(
  table: Parameters<typeof hasCreatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
): boolean {
  return forRoles('create')(table, effectiveRoles, allTables)
}

/**
 * Group-aware update permission check (most-permissive-wins): {@link forRoles}`('update')`.
 */
export function hasUpdatePermissionForRoles(
  table: Parameters<typeof hasUpdatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
): boolean {
  return forRoles('update')(table, effectiveRoles, allTables)
}

/**
 * Group-aware delete permission check (most-permissive-wins): {@link forRoles}`('delete')`.
 */
export function hasDeletePermissionForRoles(
  table: Parameters<typeof hasDeletePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
): boolean {
  return forRoles('delete')(table, effectiveRoles, allTables)
}

/**
 * Group-aware inline-edit default (most-permissive-wins).
 *
 * The affordance sibling of {@link hasUpdatePermissionForRoles}, so a render
 * gate can answer `update: ['group:editors']` for a caller whose bare role
 * names nothing. Same subset guarantee as {@link hasInlineEditDefault}: it can
 * only ever withhold an affordance the write path would have allowed.
 */
export function hasInlineEditDefaultForRoles(
  table: Parameters<typeof hasUpdatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
): boolean {
  return anyEffectiveCallerAdmits(writingRoles(effectiveRoles), (role, groups) =>
    hasInlineEditDefault(table, role, allTables, groups)
  )
}

/**
 * Group-aware comment permission check (most-permissive-wins): {@link forRoles}`('comment')`.
 *
 * Returns true when ANY of the user's effective roles may comment. The fifth
 * member of the `*ForRoles` family, added because the comment CREATE gate
 * crosses read AND comment: making only the read half group-aware would leave a
 * group-granted caller denied by the comment half, invisibly.
 *
 * NOT A `.some()` FOLD OVER THE RAW LIST. "The declared-grant branch is a pure
 * membership test" is FALSE here: the comment branch runs the full evaluator,
 * which matches a `group:<name>` entry against memberships and never against
 * the role string. A fold would put the pseudo-role `'group:ops'` in the role
 * slot with no memberships attached, and a grant of `comment: ['group:ops']`
 * could not be satisfied by anyone — one config key, two answers. All five
 * split role from membership through {@link anyEffectiveCallerAdmits} and
 * share the one mechanism.
 */
export function hasCommentPermissionForRoles(
  table: Parameters<typeof hasCommentPermission>[0],
  effectiveRoles: readonly string[],
  allTables?: TableGateScope
): boolean {
  return forRoles('comment')(table, effectiveRoles, allTables)
}
