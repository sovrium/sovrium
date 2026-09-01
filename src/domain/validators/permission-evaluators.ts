/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { splitGroupReferences } from '@/domain/models/app/auth/groups/group-reference'
import {
  classifyPermissionRung,
  matchesRoleList,
  toPermissionValue,
} from '@/domain/models/shared/permission-evaluation'
import { checkPermissionWithAdminOverride, isAdminRole } from '@/domain/models/shared/permissions'
import type {
  TableFieldPermissions,
  TablePermissions,
} from '@/domain/models/app/tables/permissions'

/**
 * Evaluate table-level permissions for a user
 */
export function evaluateTablePermissions(
  tablePermissions: TablePermissions | undefined,
  userRole: string,
  isAdmin: boolean
): Readonly<{ read: boolean; create: boolean; update: boolean; delete: boolean }> {
  return {
    read: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.read, userRole),
    create: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.create, userRole),
    update: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.update, userRole),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is accessing a property, not a Drizzle delete operation
    delete: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.delete, userRole),
  }
}

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
 * Resolve effective permissions considering inheritance
 */
function getEffectivePermissions(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: unknown }>[] | undefined
): unknown {
  if (!allTables || !table) return table?.permissions

  const tableWithInheritance = table as Readonly<{
    name: string
    permissions?: Readonly<{ inherit?: string }>
  }>

  if (!tableWithInheritance.permissions?.inherit) {
    return table.permissions
  }

  try {
    return resolveInheritedPermissions(
      table as Readonly<{ name: string; permissions?: TablePermissions }>,
      allTables as readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
    )
  } catch {
    return undefined
  }
}

/**
 * Check if inheritance resolution failed
 */
function inheritanceFailed(
  table: Readonly<{ permissions?: Readonly<{ inherit?: string }> }> | undefined,
  allTables: readonly unknown[] | undefined,
  effectivePermissions: unknown
): boolean {
  return Boolean(allTables && table?.permissions?.inherit && !effectivePermissions)
}

/**
 * Check if circular inheritance exists
 */
function hasCircularInheritance(tableName: string, visited: ReadonlySet<string>): boolean {
  return visited.has(tableName)
}

/**
 * Find parent table by name
 */
function findParentTable(
  parentName: string | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): Readonly<{ name: string; permissions?: TablePermissions }> | undefined {
  if (!parentName) return undefined
  return allTables.find((t) => t.name === parentName)
}

/**
 * Merge a single permission property with override support
 */
function mergePermission<T>(
  overrideValue: T | undefined,
  currentValue: T | undefined,
  parentValue: T | undefined
): T | undefined {
  return overrideValue ?? currentValue ?? parentValue
}

/**
 * Merge parent and current permissions with override support
 */
function mergePermissions(
  permissions: TablePermissions,
  parentPermissions: TablePermissions
): TablePermissions {
  const { override, read, comment, create, update, delete: deletePerms, fields } = permissions

  return {
    read: mergePermission(override?.read, read, parentPermissions.read),
    comment: mergePermission(override?.comment, comment, parentPermissions.comment),
    create: mergePermission(override?.create, create, parentPermissions.create),
    update: mergePermission(override?.update, update, parentPermissions.update),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is accessing a property, not a Drizzle delete operation
    delete: mergePermission(override?.delete, deletePerms, parentPermissions.delete),
    fields: fields ?? parentPermissions.fields,
  }
}

/**
 * The two most permissive rungs of the permission ladder: `'all'` (everyone)
 * and `'authenticated'` (any signed-in caller). Neither names a role, so both
 * admit every role — viewer included. `hasReadPermission` has always honoured
 * them; the write evaluators below honour them through this predicate.
 */
function isOpenPermissionLiteral(permission: unknown): boolean {
  const rung = classifyPermissionRung(toPermissionValue(permission))
  return rung === 'everyone' || rung === 'any-session'
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
 * Does a declared role allowlist admit this caller?
 *
 * The ONE membership test for every allowlist branch below, and deliberately
 * {@link matchesRoleList} rather than a bare `Array.includes(userRole)`: an
 * entry of the form `group:<name>` names a MEMBERSHIP, so it must be matched
 * against the caller's groups and never against the role string. A plain
 * `.includes` answers such an entry only when the caller literally holds the
 * string `'group:<name>'` as a role — which is what a `*ForRoles` fold used to
 * hand it, and why the same grant was honoured on four operations and inert on
 * the fifth. Splitting role from membership once, here, removes the divergence
 * rather than replicating the accident.
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
 * Check if user has role-based create permission for a table
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  groups: readonly string[] = []
): boolean {
  // Admin override: admins always have create access
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ create?: unknown }> | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const createPermission = effectivePerms?.create

  // A table declaring `create: 'all'` opens create to every role, viewer
  // included — the literals are honoured on writes exactly as on reads.
  if (isOpenPermissionLiteral(createPermission)) return true

  // A declared allowlist is authoritative, and it is consulted BEFORE the
  // viewer default — the order `update` has always had. Naming a role in an
  // allowlist is the plainest statement of intent the permission format
  // allows, so `create: ['viewer']` grants, exactly as `update: ['viewer']`
  // and `delete: ['viewer']` already do.
  if (Array.isArray(createPermission)) {
    return grantAdmits(createPermission, userRole, groups)
  }

  // Nothing declared for this role: the viewer default still denies. This
  // branch MOVED rather than disappeared — removing it would drop a table with
  // no `permissions` key through to `omittedOperationIsOpen`, which is `true`,
  // silently granting every viewer create access product-wide.
  if (userRole === 'viewer') return false

  return omittedOperationIsOpen(effectivePerms)
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
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- `delete` is a property on the override config object, not a Drizzle query.
  return adminOverride?.delete !== undefined
}

/**
 * Check if user has delete permission for the table
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  groups: readonly string[] = []
): boolean {
  // Admin override: admins always have delete access
  if (isAdminRole(userRole)) return true

  // Admin-scoped override restricts delete to admins (already granted above).
  if (hasAdminScopedDeleteOverride(table)) return false

  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ delete?: unknown }> | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is not a Drizzle delete operation, it's accessing a property
  const deletePermission = effectivePerms?.delete

  // `delete: 'all'` / `'authenticated'` admits a viewer. The viewer rule below
  // is deliberately NOT the create/update one: a viewer named in an explicit
  // delete allowlist keeps its grant.
  if (isOpenPermissionLiteral(deletePermission)) return true

  if (userRole === 'viewer') {
    return Array.isArray(deletePermission) && grantAdmits(deletePermission, userRole, groups)
  }

  // `Array.isArray` already answers false for `undefined`, `null` and the two
  // rung literals, so the `!deletePermission` half this used to carry could
  // never decide anything on its own.
  if (!Array.isArray(deletePermission)) {
    return omittedOperationIsOpen(effectivePerms)
  }
  return grantAdmits(deletePermission, userRole, groups)
}

/**
 * Check if user has update permission for a table
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  groups: readonly string[] = []
): boolean {
  // Admin override: admins always have update access
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ update?: unknown }> | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const updatePermission = effectivePerms?.update

  // `update: 'all'` / `'authenticated'` admits a viewer.
  if (isOpenPermissionLiteral(updatePermission)) return true

  if (Array.isArray(updatePermission)) {
    return grantAdmits(updatePermission, userRole, groups)
  }

  if (userRole === 'viewer') return false

  return omittedOperationIsOpen(effectivePerms)
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  groups: readonly string[] = []
): boolean {
  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ update?: unknown }> | undefined
  if (effectivePerms?.update === undefined) return false
  return hasUpdatePermission(table, userRole, allTables, groups)
}

/**
 * Check if user has read permission for a table
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  groups: readonly string[] = []
): boolean {
  // Admin override: admins always have read access
  if (isAdminRole(userRole)) return true

  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ read?: unknown }> | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const readPermission = effectivePerms?.read

  if (Array.isArray(readPermission)) {
    return grantAdmits(readPermission, userRole, groups)
  }

  if (isOpenPermissionLiteral(readPermission)) return true

  if (userRole === 'viewer') return false

  return omittedOperationIsOpen(effectivePerms)
}

/**
 * Check if a user may comment on records in a table.
 *
 * Comment-ability follows `permissions.comment`, NOT read. The rule:
 *
 * - When a `permissions.comment` grant is declared it is authoritative — the
 *   user's role must be in it (admin override applies). Read access alone does
 * NOT confer comment access ([internal ref] decision 2).
 * - When no `comment` grant is declared, a `comments` block still marks the
 * table as a commentable surface (backward compatible — pre-[internal ref] comment
 *   specs use a `comments` block and stay read-gated).
 * - A table that declares an explicit `permissions` block but neither a
 *   `comment` grant nor a `comments` block is NON-commentable — a "post-it"
 * such as Sovrium Partner's anonymized `pains` ([internal ref] decision 1). A table
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  groups: readonly string[] = []
): boolean {
  if (!table) return false

  const effectivePerms = getEffectivePermissions(table, allTables) as
    Readonly<{ comment?: unknown }> | undefined

  // Inheritance declared but unresolved → deny (mirrors the read/create paths).
  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  // A declared comment grant is authoritative — enforce it (admin override).
  const commentGrant = effectivePerms?.comment
  if (commentGrant !== undefined) return evaluateCommentGrant(commentGrant, userRole, groups)

  // No comment grant, but a `comments` block still marks a commentable surface.
  if (table.comments !== undefined && table.comments !== null) return true

  // No comment grant and no `comments` block: non-commentable ONLY when the
  // table declares a GATING `permissions` block (a "post-it"). A block that
  // names no operation — absent, `{}`, or `fields`-only — leaves the table
  // commentable, the same omitted-operation default the four evaluators above
  // apply. One default across all five is the point.
  return omittedOperationIsOpen(effectivePerms)
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
  groups: readonly string[]
): boolean {
  return checkPermissionWithAdminOverride(isAdminRole(userRole), commentGrant, userRole, groups)
}

/**
 * Group-aware read permission check (most-permissive-wins).
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return anyEffectiveCallerAdmits(effectiveRoles, (role, groups) =>
    hasReadPermission(table, role, allTables, groups)
  )
}

/**
 * Group-aware create permission check (most-permissive-wins).
 *
 * Returns true when ANY of the user's effective roles is granted create
 * access. See `hasReadPermissionForRoles` for the effective-roles contract.
 */
export function hasCreatePermissionForRoles(
  table: Parameters<typeof hasCreatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return anyEffectiveCallerAdmits(effectiveRoles, (role, groups) =>
    hasCreatePermission(table, role, allTables, groups)
  )
}

/**
 * Group-aware update permission check (most-permissive-wins).
 */
export function hasUpdatePermissionForRoles(
  table: Parameters<typeof hasUpdatePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return anyEffectiveCallerAdmits(effectiveRoles, (role, groups) =>
    hasUpdatePermission(table, role, allTables, groups)
  )
}

/**
 * Group-aware delete permission check (most-permissive-wins).
 */
export function hasDeletePermissionForRoles(
  table: Parameters<typeof hasDeletePermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return anyEffectiveCallerAdmits(effectiveRoles, (role, groups) =>
    hasDeletePermission(table, role, allTables, groups)
  )
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
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return anyEffectiveCallerAdmits(effectiveRoles, (role, groups) =>
    hasInlineEditDefault(table, role, allTables, groups)
  )
}

/**
 * Group-aware comment permission check (most-permissive-wins).
 *
 * Returns true when ANY of the user's effective roles may comment. The fifth
 * member of the `*ForRoles` family, added because the comment CREATE gate
 * crosses read AND comment: making only the read half group-aware would leave a
 * group-granted caller denied by the comment half, invisibly.
 *
 * THIS DOC COMMENT USED TO JUSTIFY A `.some()` FOLD OVER THE RAW LIST with the
 * claim that "the declared-grant branch is a pure membership test". That claim
 * was true of the four siblings and FALSE here: the comment branch runs the
 * full evaluator, which matches a `group:<name>` entry against memberships and
 * never against the role string. Folding therefore put the pseudo-role
 * `'group:ops'` in the role slot with no memberships attached, and a grant of
 * `comment: ['group:ops']` could not be satisfied by anyone — while the same
 * entry on `read` was honoured, because `.includes` matched the literal string.
 * One config key, two answers. All five now split role from membership through
 * {@link anyEffectiveCallerAdmits} and share the one mechanism.
 */
export function hasCommentPermissionForRoles(
  table: Parameters<typeof hasCommentPermission>[0],
  effectiveRoles: readonly string[],
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  return anyEffectiveCallerAdmits(effectiveRoles, (role, groups) =>
    hasCommentPermission(table, role, allTables, groups)
  )
}

/**
 * Resolve inherited permissions for a table
 *
 * Recursively resolves permissions by following the inheritance chain.
 * Handles circular inheritance detection and merges override permissions.
 *
 * @param table - The table to resolve permissions for
 * @param allTables - All tables in the app (for parent lookup)
 * @param visited - Set of visited table names (for circular detection)
 * @returns Resolved permissions or undefined if inheritance chain is invalid
 * @throws Error if circular inheritance detected or parent table not found
 */
export function resolveInheritedPermissions(
  table: Readonly<{ name: string; permissions?: TablePermissions }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  visited: ReadonlySet<string> = new Set()
): TablePermissions | undefined {
  if (!table?.permissions) return undefined

  const { permissions } = table

  // If no inheritance, return current permissions
  if (!permissions.inherit) {
    return permissions
  }

  // Circular inheritance detection
  if (hasCircularInheritance(table.name, visited)) {
    // Return undefined to indicate error (caught by callers)
    return undefined
  }

  // Find parent table
  const parentTable = findParentTable(permissions.inherit, allTables)
  if (!parentTable) {
    // Return undefined to indicate error (caught by callers)
    return undefined
  }

  // Recursively resolve parent permissions
  const parentPermissions = resolveInheritedPermissions(
    parentTable,
    allTables,
    new Set([...visited, table.name])
  )

  if (!parentPermissions) return permissions

  // Merge parent permissions with current permissions (current takes precedence)
  return mergePermissions(permissions, parentPermissions)
}
