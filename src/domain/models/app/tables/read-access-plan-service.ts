/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * THE composed read plan. Every surface that exposes table ROWS runs here.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Reading a table safely is not one control, it is four, and they must all
 * apply together:
 *
 *   1. the table-level role gate  (`permissions.read`, inheritance- and
 *      group-aware),
 *   2. the row-level predicate    (`rowLevelPermissions.read.when`),
 *   3. the soft-delete filter     (`deleted_at IS NULL` unless trash is asked
 *      for, and asking for it is itself a privilege),
 *   4. the field-level whitelist  (`permissions.fields[].read`, plus the
 *      built-in default rules).
 *
 * `GET /api/tables/:t/records` composed all four. SSR page rendering, the SSE
 * and WebSocket subscription transports, the AI chat table tool, RAG search and
 * the command palette each re-derived a SUBSET — and, having re-derived it,
 * drifted. Field-level read alone existed in four mutually incompatible
 * implementations, only ONE of which carried the built-in default rules; the
 * SSE branch computed a whitelist and then threw it away in favour of the
 * client's own `?fields=` parameter.
 *
 * Duplication was the visible symptom. The real defect is the same one
 * `permission-evaluation.ts` names one layer down: a surface cannot compose
 * four controls without ANSWERING FOUR QUESTIONS, and every re-derivation
 * answered a different subset by accident. So the fix is not "call the REST
 * helper from everywhere" — the transports genuinely differ, and forcing them
 * into the REST shape breaks correct behaviour. It is to make each choice a
 * NAMED, REQUIRED argument, exactly as `evaluatePermission` made the
 * undeclared-permission default a required argument.
 *
 * WHY THE POLICY IS EXPLICIT RATHER THAN INFERRED
 * ----------------------------------------------
 * Two of the deviations found in the audit are DELIBERATE and must survive:
 *
 *   - the realtime transports match a field grant against ANY of the caller's
 *     effective roles, not just the primary one, because a change event is
 *     fanned out to a connection rather than derived per-request
 *     (`subscribe-handlers.ts`);
 *   - a surface that has no session at all (an anonymous public-read page)
 *     still has to answer "which columns", and the answer is not the same as
 *     for a signed-in `viewer`.
 *
 * A plan that silently normalised those away would be a regression dressed as
 * a consolidation. Both are therefore options with names.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not perform I/O. The row-level layer needs a database round-trip to
 * resolve assignment scopes, so the CALLER resolves a {@link CurrentUserContext}
 * (via `row-level-enforcement.ts`) and hands it in. A surface that cannot
 * afford that round-trip passes `undefined` and gets a plan whose
 * `rowPredicate` is `'unresolved'` — a value it must not silently ignore.
 */

import { type PermissionCaller } from '@/domain/models/app/auth/permission-evaluation'
import { hasReadPermissionForRoles } from '../auth/permission-evaluator-service'
import { isFieldReadableByCaller } from './field-read-filter-service'
import {
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
  type CurrentUserContext,
  type RowLevelFilterNode,
} from './row-level-evaluator-service'
import type { App } from '@/domain/models/app'
import type { RowLevelPermissions } from '@/domain/models/app/tables/permissions'
import type { Table } from '@/domain/models/app/tables/table'

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

/**
 * The acting caller, in the shape every read surface can actually produce.
 *
 * `role` is the PRIMARY role — the one the field-level default rules key off
 * (`viewer` sees name/title only; `member` cannot see `salary`). `effectiveRoles`
 * is that role plus every `group:<name>` reference and every `user_access`
 * overlay role, and is what the TABLE-level gate iterates most-permissive-wins.
 *
 * They are separate because they answer different questions and conflating them
 * is a live bug in both directions: gating the table on the primary role alone
 * ignores group grants (SSR did exactly that), while applying the field-level
 * default rules across every effective role would let a group membership lift a
 * default restriction that names no group at all.
 */
export interface ReadPrincipal {
  /** Primary role. The empty string means "anonymous / no resolved role". */
  readonly role: string
  /** Primary role + `group:<name>` entries + `user_access` overlay roles. */
  readonly effectiveRoles: readonly string[]
  /** Whether a session exists at all. */
  readonly isAuthenticated: boolean
}

/**
 * Build a {@link ReadPrincipal} from a resolved SSR session.
 *
 * `SessionInfo` already carries the two overlays the records API resolves
 * separately — `effectiveRoles` (the `user_access` overlay) and `groups` — but
 * page rendering consulted only `session.role`, so a table granted to
 * `group:finance` was invisible to a member of that group even though
 * `GET /api/tables/:t/records` served it. Folding them in HERE, once, is what
 * stops the next render surface re-deriving a third answer.
 */
export const readPrincipalFromSession = (
  session:
    | Readonly<{
        readonly role: string
        readonly effectiveRoles?: readonly string[]
        readonly groups?: readonly string[]
      }>
    | undefined
): ReadPrincipal => {
  const role = session?.role ?? ''
  return {
    role,
    effectiveRoles: [
      ...new Set([
        role,
        ...(session?.effectiveRoles ?? []),
        ...(session?.groups ?? []).map((group) => `${GROUP_PREFIX}${group}`),
      ]),
    ],
    isAuthenticated: session !== undefined,
  }
}

/** The `group:` prefix a role-array entry uses to reference a group. */
const GROUP_PREFIX = 'group:'

/**
 * The caller's group names, un-prefixed, recovered from `effectiveRoles`.
 *
 * `effectiveRoles` is the repo-wide convention (`buildEffectiveRoles`): a flat
 * list mixing real roles with `group:<name>` entries. `evaluatePermission`
 * wants them SEPARATED — it matches a `group:` grant entry against
 * `caller.groups`, never against the role string — so the split happens here,
 * once, rather than at every call site.
 */
const groupsOf = (principal: ReadPrincipal): readonly string[] =>
  principal.effectiveRoles
    .filter((entry) => entry.startsWith(GROUP_PREFIX))
    .map((entry) => entry.slice(GROUP_PREFIX.length))

/** The caller's non-group roles — the primary role plus any overlay roles. */
const plainRolesOf = (principal: ReadPrincipal): readonly string[] =>
  principal.effectiveRoles.filter((entry) => !entry.startsWith(GROUP_PREFIX))

// ---------------------------------------------------------------------------
// Policy — the choices a surface must make by name
// ---------------------------------------------------------------------------

/**
 * How a field grant is matched against a caller holding several roles.
 *
 * - `primary-role`      — only {@link ReadPrincipal.role} decides. What the
 *   REST record read does: a request carries one acting role and the response
 *   is shaped for it.
 * - `any-effective-role` — a column survives if ANY effective role may read it.
 *   What the realtime transports do, DELIBERATELY (`subscribe-handlers.ts`):
 *   the whitelist is resolved once per CONNECTION and then applied to every
 *   fanned-out change event, so narrowing it to the primary role would hide
 *   columns a group grant legitimately opens.
 */
export type FieldRoleMatch = 'primary-role' | 'any-effective-role'

/**
 * Whether the built-in default field rules apply.
 *
 * The default rules (`viewer` sees only name/title and no sensitive types;
 * `member` cannot read a `salary` currency column) are a RESTRICTION that
 * applies only when the table declares no `permissions.fields` at all — see
 * `field-read-filter.ts`. Three of the four pre-consolidation implementations
 * skipped them, which is why a `viewer` could read a column over SSE, SSR or
 * the AI chat tool that the records API stripped.
 *
 * `skip` exists for surfaces that are NOT record projections — a column-name
 * enumeration used to build a query plan, say — where applying a value-level
 * restriction would produce a nonsensical schema. Nothing currently sets it;
 * it is here so that a future site says so out loud rather than by omission.
 */
export type FieldDefaultRules = 'apply' | 'skip'

/**
 * Whether the caller may see soft-deleted rows.
 *
 * `'live-only'` is the answer for every ordinary read. `'deleted-only'` is the
 * trash view, and it is a PRIVILEGE, not a query parameter: `deletedBy`
 * discloses who removed a row, so an anonymous caller must never reach it even
 * on a `read: 'all'` table.
 */
export type DeletionScope = 'live-only' | 'deleted-only'

/** The policy triple every read plan must declare. */
export interface ReadAccessPolicy {
  readonly fieldRoleMatch: FieldRoleMatch
  readonly fieldDefaultRules: FieldDefaultRules
  readonly deletionScope: DeletionScope
}

/**
 * The canonical policy — what `GET /api/tables/:t/records` does, and the right
 * starting point for any new read surface.
 */
export const CANONICAL_READ_POLICY: ReadAccessPolicy = {
  fieldRoleMatch: 'primary-role',
  fieldDefaultRules: 'apply',
  deletionScope: 'live-only',
}

/**
 * The realtime policy. Differs from canonical in ONE named way, documented on
 * {@link FieldRoleMatch}: the whitelist is per-connection, so it is resolved
 * across every effective role.
 */
export const REALTIME_READ_POLICY: ReadAccessPolicy = {
  fieldRoleMatch: 'any-effective-role',
  fieldDefaultRules: 'apply',
  deletionScope: 'live-only',
}

/** The trash policy: canonical, but scoped to soft-deleted rows. */
export const TRASH_READ_POLICY: ReadAccessPolicy = {
  fieldRoleMatch: 'primary-role',
  fieldDefaultRules: 'apply',
  deletionScope: 'deleted-only',
}

// ---------------------------------------------------------------------------
// The row-level predicate result
// ---------------------------------------------------------------------------

/** A single flat filter clause emitted by `projectPredicateToFilter`. */
export interface ProjectedClause {
  readonly field: string
  readonly operator: 'equals' | 'notEquals' | 'in'
  readonly value: unknown
}

/**
 * The row-level read predicate, projected.
 *
 * - `'none'`        — the table declares no row-level read predicate.
 * - `'bypass'`      — the caller is unrestricted (admin-equivalent).
 * - `'empty'`       — the predicate admits NOTHING (an `in []`). The caller
 *   must return zero rows WITHOUT querying; some drivers reject `IN ()`.
 * - `'unresolved'`  — a predicate exists but no {@link CurrentUserContext} was
 *   supplied, so it could not be projected. **Fail closed**: treat exactly as
 *   `'empty'`. Named separately so a caller that lacks the round-trip is
 *   visible in a plan rather than silently unfiltered.
 * - a clause / node — AND this onto the query.
 */
export type RowPredicate =
  'none' | 'bypass' | 'empty' | 'unresolved' | ProjectedClause | RowLevelFilterNode

/** True when the predicate admits no row at all and no query should be issued. */
export const admitsNothing = (predicate: RowPredicate): boolean =>
  predicate === 'empty' || predicate === 'unresolved'

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/** The composed answer to "what may this principal read from this table?" */
export interface ReadAccessPlan {
  /**
   * The table-level gate. `false` means the caller may read NOTHING from this
   * table; every caller maps this to its own anti-enumeration answer (404 for
   * an API, an empty component for SSR, an omitted table for a search scan).
   */
  readonly allowed: boolean
  /**
   * The columns the caller may read, or `undefined` when every column is
   * readable. `undefined` — rather than the full list — so the common case
   * costs no filtering, which is also the contract the realtime transports
   * already relied on.
   *
   * Never includes a column the caller may not read, so it is safe to use as a
   * SELECT list as well as a response filter.
   */
  readonly columnWhitelist: readonly string[] | undefined
  /**
   * The declared table columns the caller may NOT read — the complement of
   * {@link columnWhitelist} within `table.fields`.
   *
   * Carried alongside the whitelist rather than derived from it because the two
   * are applied to DIFFERENT things and inverting one to get the other is a
   * live bug: a whitelist is a SELECT list over declared fields, while a
   * response record also carries system columns (`id`, `created_at`,
   * `created_by`, …) that no field grant governs and that
   * {@link isFieldReadableByCaller} always admits. Filtering a record BY the
   * whitelist therefore strips its `id`; filtering it by this set does not.
   */
  readonly restrictedColumns: ReadonlySet<string>
  /** The projected row-level read predicate. See {@link RowPredicate}. */
  readonly rowPredicate: RowPredicate
  /**
   * `true` only under {@link DeletionScope} `'deleted-only'`. A caller that
   * ignores this reads soft-deleted rows; a caller that inverts it reads
   * nothing.
   */
  readonly includeDeleted: boolean
}

/** Inputs to {@link buildReadAccessPlan}. */
export interface ReadAccessPlanInput {
  readonly app: App
  /** The table being read. `undefined` yields a denied plan. */
  readonly table: TableLike | undefined
  readonly principal: ReadPrincipal
  readonly policy: ReadAccessPolicy
  /**
   * The resolved row-level context. Omit ONLY when the table declares no
   * `rowLevelPermissions` — otherwise the plan reports `'unresolved'`, which
   * fails closed.
   */
  readonly rowContext?: CurrentUserContext | undefined
}

/**
 * The structural shape of a table this plan reads. Declared minimally so a
 * projection (the AI chat tool's `ProjectedTable`, SSR's matched table) can be
 * planned without being widened to a full {@link Table}.
 */
export interface TableLike {
  readonly name: string
  readonly fields: readonly { readonly name: string; readonly type?: string }[]
  readonly permissions?: Table['permissions']
  readonly rowLevelPermissions?: RowLevelPermissions
}

/**
 * Project the row-level READ predicate for a table.
 *
 * Extracted so the plan and the record-CRUD guard share one projection. The
 * admin bypass, the missing-predicate case and the empty-`in` short circuit all
 * live here; a caller re-deriving any of them is the drift this module exists
 * to end.
 */
export const projectRowReadPredicate = (
  rlp: RowLevelPermissions | undefined,
  ctx: CurrentUserContext | undefined
): RowPredicate => {
  const predicate = rlp?.read?.when
  if (!predicate) return 'none'
  if (ctx === undefined) return 'unresolved'
  if (ctx.isUnrestricted) return 'bypass'

  if (isPredicateGroup(predicate)) {
    // A composite group scopes an empty `in` to its own branch (rendered as
    // `IN (NULL)`), so the whole-predicate `'empty'` short circuit does NOT
    // apply here. A projection that fails outright still fails closed.
    return projectWhenToFilter(predicate, ctx) ?? 'empty'
  }

  const projected = projectPredicateToFilter(predicate, ctx)
  if (!projected) return 'empty'
  return admitsNoValue(projected) ? 'empty' : (projected as ProjectedClause)
}

/**
 * True for a projected `in` clause whose list is empty — "match nothing".
 * Surfaced as a sentinel so the caller skips the query entirely; some drivers
 * reject `IN ()` outright.
 */
const admitsNoValue = (clause: { readonly operator: string; readonly value: unknown }): boolean =>
  clause.operator === 'in' && Array.isArray(clause.value) && clause.value.length === 0

/**
 * Resolve the column whitelist for a principal under a policy.
 *
 * Returns `undefined` when every column is readable. Delegates the per-field
 * decision to {@link isFieldReadableByCaller} — the ONE predicate carrying the
 * built-in default rules, the `permissions.fields` precedence and the
 * `isAdminEquivalent` superuser bypass — so this function owns only the
 * multi-role combining rule.
 */
export const resolveColumnWhitelist = (
  app: App,
  table: TableLike,
  principal: ReadPrincipal,
  policy: ReadAccessPolicy
): readonly string[] | undefined => {
  const groups = groupsOf(principal)
  // Group membership rides on EVERY candidate caller, whichever match mode is
  // in force: a `group:` grant is satisfied by membership, not by which role
  // happens to be primary. Only the ROLE set widens under
  // `any-effective-role`.
  const callers: readonly PermissionCaller[] = (
    policy.fieldRoleMatch === 'any-effective-role' ? plainRolesOf(principal) : [principal.role]
  ).map((role) => ({ role, groups }))

  const readable = table.fields
    .map((field) => field.name)
    .filter((fieldName) =>
      callers.some((caller) => isFieldReadableForPolicy({ app, table, caller, fieldName, policy }))
    )

  return readable.length === table.fields.length ? undefined : readable
}

/**
 * One field, one role. `skip` bypasses the built-in default rules by asking the
 * canonical predicate against a table whose declared `permissions.fields` is
 * the only input — which is what "skip the defaults" means operationally.
 */
const isFieldReadableForPolicy = (input: {
  readonly app: App
  readonly table: TableLike
  readonly caller: PermissionCaller
  readonly fieldName: string
  readonly policy: ReadAccessPolicy
}): boolean => {
  const { app, table, caller, fieldName, policy } = input
  // `skip`: consult the DECLARED grants only. When the table declares none,
  // every field is readable — the defaults are precisely what would have
  // restricted it.
  if (policy.fieldDefaultRules === 'skip' && !table.permissions?.fields) return true
  return isFieldReadableByCaller(app, table.name, caller, fieldName)
}

/**
 * Compose the four read controls into one plan.
 *
 * The table gate uses {@link hasReadPermissionForRoles} — inheritance-aware and
 * group-aware — rather than the record-CRUD guard's `passesTableRoleGate`,
 * which resolves neither. Where the two disagree the inheritance-aware answer
 * is the stricter and the correct one: a table declaring
 * `permissions: { inherit: 'parent' }` must not read as ungated.
 */
export const buildReadAccessPlan = (input: ReadAccessPlanInput): ReadAccessPlan => {
  const { app, table, principal, policy, rowContext } = input

  if (!table) {
    return {
      allowed: false,
      columnWhitelist: [],
      restrictedColumns: new Set(),
      rowPredicate: 'empty',
      includeDeleted: false,
    }
  }

  const allowed = hasReadPermissionForRoles(
    table as Parameters<typeof hasReadPermissionForRoles>[0],
    principal.effectiveRoles,
    app.tables as Parameters<typeof hasReadPermissionForRoles>[2]
  )

  if (!allowed) {
    return {
      allowed: false,
      columnWhitelist: [],
      restrictedColumns: new Set(table.fields.map((field) => field.name)),
      rowPredicate: 'empty',
      includeDeleted: false,
    }
  }

  const columnWhitelist = resolveColumnWhitelist(app, table, principal, policy)
  const readable = new Set(columnWhitelist ?? table.fields.map((field) => field.name))

  return {
    allowed: true,
    columnWhitelist,
    restrictedColumns: new Set(
      table.fields.map((field) => field.name).filter((name) => !readable.has(name))
    ),
    rowPredicate: projectRowReadPredicate(table.rowLevelPermissions, rowContext),
    includeDeleted: policy.deletionScope === 'deleted-only',
  }
}

/**
 * Narrow a caller-supplied column list to the plan's whitelist.
 *
 * The SSE transport's defect in one function: it accepted `?fields=` from the
 * client and used it INSTEAD of the server whitelist, so omitting the parameter
 * disclosed every column. A caller request can only ever NARROW.
 */
export const narrowRequestedColumns = (
  plan: ReadAccessPlan,
  requested: readonly string[] | undefined
): readonly string[] | undefined => {
  if (requested === undefined) return plan.columnWhitelist
  if (plan.columnWhitelist === undefined) return requested
  const allowed = new Set(plan.columnWhitelist)
  return requested.filter((field) => allowed.has(field))
}

/**
 * Strip the plan's restricted columns from one record object.
 *
 * Deliberately keyed off {@link ReadAccessPlan.restrictedColumns} and NOT off
 * the whitelist: a record carries system columns no field grant governs, and
 * a whitelist-shaped filter would strip them — starting with `id`.
 */
export const stripRestrictedColumns = <T extends Record<string, unknown>>(
  plan: ReadAccessPlan,
  record: Readonly<T>
): Readonly<Record<string, unknown>> => {
  if (plan.restrictedColumns.size === 0) return record
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !plan.restrictedColumns.has(key))
  )
}
