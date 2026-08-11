/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { PermissionValue } from '@/domain/models/shared/permissions'

/**
 * THE permission evaluator. Every authorization ladder in Sovrium runs here.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The permission ladder — `'all'` / `'authenticated'` / role array, plus the
 * admin override — used to be re-implemented independently at seventeen call
 * sites. Duplication was the visible symptom; the real defect was that the
 * seventeen copies had drifted into FIVE mutually incompatible answers to the
 * one question the ladder does not itself answer: *what does an UNDECLARED
 * permission mean here?* Three of those answers were live bugs and a fourth
 * was a fail-open contradicting the published JSON Schema.
 *
 * Several of the five are nonetheless deliberate — a bucket's `sign` defaults
 * to admin-only while the same bucket's `upload` defaults to the write grant,
 * and inverting either one breaks a pinned spec. So the fix is NOT to pick a
 * winner. It is to make the choice IMPOSSIBLE TO MAKE BY ACCIDENT: the
 * undeclared default is a required, named argument. A call site cannot evaluate
 * a permission without saying, in the code, which default it wants.
 *
 * That is the structural part. `sovrium/no-inline-permission-ladder` then keeps
 * it structural by making a hand-rolled ladder a lint error everywhere else.
 *
 * WHY IT RETURNS A DECISION, NOT A BOOLEAN
 * -----------------------------------------
 * A boolean cannot carry the 401-vs-404 split, and that split is a security
 * property, not a formatting choice (S1 anti-enumeration): "log in and try
 * again" is a legitimate answer to an anonymous caller at the `'authenticated'`
 * rung, but a ROLE denial must not confirm that the resource exists. Callers
 * that genuinely only need a yes/no wrap the result in {@link permits}.
 *
 * WHY THE CALLER IS OPTIONAL
 * --------------------------
 * The predecessor, `hasPermission(permission, userRole: string)`, could not
 * evaluate `'authenticated'` correctly BY CONSTRUCTION: its signature had no
 * way to express "no session", so it returned `true` unconditionally and
 * trusted every call site to have checked first. An optional caller makes the
 * anonymous case representable, which is the only way the rung can be decided
 * here rather than by convention out there.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * The `'all'` rung: everyone, session or not.
 *
 * Declared as a constant so that the ONE module allowed to compare against the
 * ladder literals is the one that also documents what they mean.
 */
const RUNG_EVERYONE = 'all'

/** The `'authenticated'` rung: any signed-in caller, regardless of role. */
const RUNG_ANY_SESSION = 'authenticated'

/** The built-in superuser role. */
const ROLE_ADMIN = 'admin'

/** The built-in lowest-privilege role — default-denied by the bare-table default. */
const ROLE_VIEWER = 'viewer'

/** The built-in ordinary-user role. */
const ROLE_MEMBER = 'member'

/** Prefix marking a `group:<name>` reference inside a role array. */
const GROUP_REFERENCE_PREFIX = 'group:'

// ---------------------------------------------------------------------------
// Caller
// ---------------------------------------------------------------------------

/**
 * The acting caller. `undefined` (wherever a `PermissionCaller | undefined`
 * appears) means ANONYMOUS — no session at all, which is a different state from
 * "a session whose role matches nothing".
 */
export interface PermissionCaller {
  /**
   * The caller's global role.
   *
   * `undefined` means "there IS a session, but its role has not been resolved"
   * — a state that exists because resolving a role can cost a database
   * round-trip on hot paths where the ladder provably never reads it (a bucket
   * `GET` backs every image on every page; [internal ref]). Use it only after
   * {@link classifyPermissionRung} has shown the permission is not a role
   * array. It fails CLOSED: an unresolved role matches no role list and
   * satisfies no role-shaped undeclared policy.
   */
  readonly role?: string
  /** Group names the caller belongs to, matched by `group:<name>` entries. */
  readonly groups?: readonly string[]
}

/** A session whose role has not been resolved. See {@link PermissionCaller.role}. */
export const SESSION_WITH_UNRESOLVED_ROLE: PermissionCaller = {}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * The outcome of an evaluation.
 *
 * - `allow`        — permitted.
 * - `unauthorized` — the caller is anonymous and the permission asks only for a
 *   session. Actionable ("sign in"), and it leaks nothing, so callers map it to
 *   **401**.
 * - `denied`       — refused on identity/role grounds. Callers map it to
 *   **404** on any surface where confirming existence would enable enumeration
 *   (S1), which in this codebase is most of them.
 */
export type PermissionDecision =
  { readonly kind: 'allow' } | { readonly kind: 'unauthorized' } | { readonly kind: 'denied' }

const ALLOW: PermissionDecision = { kind: 'allow' }
const UNAUTHORIZED: PermissionDecision = { kind: 'unauthorized' }
const DENIED: PermissionDecision = { kind: 'denied' }

/** Collapse a decision to a yes/no, for call sites that map denials themselves. */
export const permits = (decision: PermissionDecision): boolean => decision.kind === 'allow'

// ---------------------------------------------------------------------------
// Undeclared-permission policy — the named defaults
// ---------------------------------------------------------------------------

/**
 * What an UNDECLARED permission means at a given call site.
 *
 * Every variant below is a real, spec-pinned default somewhere in the codebase.
 * They are named for their MEANING rather than their call site, so that a new
 * site picks a policy on the merits instead of copying its neighbour.
 */
export type UndeclaredPolicy =
  | { readonly kind: 'deny' }
  | { readonly kind: 'open' }
  | { readonly kind: 'admin-only' }
  | { readonly kind: 'member-only' }
  | { readonly kind: 'any-non-viewer' }
  | { readonly kind: 'caller-grant'; readonly allowed: boolean }

/**
 * Secure-by-default: an operation nobody declared is granted to nobody.
 *
 * Pinned by `[internal ref]` (`table-operations.ts`) — the table listing
 * must not expose a table whose `permissions.read` was never written.
 */
export const DENY_WHEN_UNDECLARED: UndeclaredPolicy = { kind: 'deny' }

/**
 * Permissive: an operation nobody declared is granted to everybody.
 *
 * The right default for a RESTRICTION — a `permissions.fields[].read` entry
 * that does not exist restricts nothing, so the field stays readable — and for
 * chat-triggerable automations, where a schema author who wrote no `trigger`
 * grant meant "anyone may run it" (`[internal ref]`/`-014`).
 */
export const OPEN_WHEN_UNDECLARED: UndeclaredPolicy = { kind: 'open' }

/**
 * Operator-only: an operation nobody declared is reserved to `admin`.
 *
 * Deliberately the INVERSE of {@link grantWhenUndeclared} on the very same
 * bucket: minting a signed URL bypasses the API's own gates, so an undeclared
 * `sign` must not inherit the permissive storage default
 *.
 */
export const ADMIN_ONLY_WHEN_UNDECLARED: UndeclaredPolicy = { kind: 'admin-only' }

/**
 * Exactly `member` (plus whatever the admin-override policy admits).
 *
 * NO LIVE CALL SITE. This was the RAG knowledge-ingest default until
 * `[internal ref]`: the rule it implemented was documented as "viewer
 * denied, member allowed" but, as written, denied every CUSTOM role too — so a
 * `supervisor` USER could read a table over the records API that a
 * `supervisor` AGENT could not embed. Ingest now uses
 * {@link ANY_NON_VIEWER_WHEN_UNDECLARED}, matching `hasReadPermission`.
 *
 * Kept because the ladder's whole point is that "what does an undeclared
 * permission mean HERE" is a real question with more than one defensible
 * answer, and a site that genuinely wants the ordinary-user role and nothing
 * else should be able to say so by name rather than by hand.
 */
export const MEMBER_ONLY_WHEN_UNDECLARED: UndeclaredPolicy = { kind: 'member-only' }

/**
 * The bare-table default: every built-in role except `viewer`.
 *
 * Predates the `'all'`/`'authenticated'` vocabulary and survives wherever a
 * table carries no gating `permissions` block at all (see
 * `omittedOperationIsOpen` in `permission-evaluators.ts`, which decides WHEN
 * this default still applies).
 */
export const ANY_NON_VIEWER_WHEN_UNDECLARED: UndeclaredPolicy = { kind: 'any-non-viewer' }

/**
 * Defer to a grant the call site computed itself.
 *
 * Used where the fallback is not a property of the ladder but of surrounding
 * context — bucket writes fall back to `defaultWriteGrant(app, bucket, session)`,
 * which weighs `bucket.public` against whether the app configures auth at all
 * (`[internal ref]`/`-014`).
 */
export const grantWhenUndeclared = (allowed: boolean): UndeclaredPolicy => ({
  kind: 'caller-grant',
  allowed,
})

// ---------------------------------------------------------------------------
// Admin-override policy
// ---------------------------------------------------------------------------

/**
 * Whether — and how far — the built-in `admin` role outranks a declared grant.
 *
 * This too varies deliberately across the codebase, so it too is named rather
 * than assumed:
 *
 * - `no-admin-override` — the grant is the whole truth. A form's
 *   `access.require: ['editor']` hides the form from an admin as well.
 * - `admin-outranks-role-list` — admin satisfies any declared role array, but
 *   an UNDECLARED permission still goes through the policy above.
 * - `admin-outranks-everything` — admin passes before anything else is
 *   consulted, the undeclared policy included.
 */
export type AdminOverride =
  'no-admin-override' | 'admin-outranks-role-list' | 'admin-outranks-everything'

/** The policy pair every evaluation must declare. */
export interface PermissionPolicy {
  readonly whenUndeclared: UndeclaredPolicy
  readonly adminOverride: AdminOverride
}

// ---------------------------------------------------------------------------
// Named one-rung predicates
// ---------------------------------------------------------------------------

/**
 * True for the built-in superuser role.
 *
 * Accepts `undefined` (an unresolved or absent role) and answers `false`, so no
 * call site has to guard before asking — a guard that, forgotten, silently
 * reintroduces the literal.
 */
export const isAdminRole = (role: string | undefined): boolean => role === ROLE_ADMIN

/**
 * True only for the `'all'` rung — anonymously readable.
 *
 * A deliberately NARROW question, distinct from "is this permitted": a page or
 * table at the `'authenticated'` rung is not public, must not be statically
 * pre-rendered, and must not be indexed. Callers wanting the full ladder want
 * {@link evaluatePermission} instead.
 */
export const isOpenToEveryone = (
  permission: PermissionValue | undefined
): permission is typeof RUNG_EVERYONE => permission === RUNG_EVERYONE

/** True only for the `'authenticated'` rung — any session, no role required. */
export const requiresOnlyASession = (
  permission: PermissionValue | undefined
): permission is typeof RUNG_ANY_SESSION => permission === RUNG_ANY_SESSION

/**
 * Narrow an untyped config value to a {@link PermissionValue}, or `undefined`.
 *
 * Several call sites read `permissions` off a loosely-typed projection and hold
 * an `unknown`. Rather than let each one re-derive "is this a permission",
 * anything that is not one of the two literals or a string array is normalised
 * to UNDECLARED — so a malformed grant takes the site's declared undeclared
 * policy (which is secure-by-default wherever it matters) instead of throwing.
 */
export const toPermissionValue = (permission: unknown): PermissionValue | undefined => {
  if (permission === RUNG_EVERYONE || permission === RUNG_ANY_SESSION) return permission
  if (Array.isArray(permission) && permission.every((entry) => typeof entry === 'string')) {
    return permission as readonly string[]
  }
  return undefined
}

/** The four shapes a permission value can take, as a label. */
export type PermissionRung = 'undeclared' | 'everyone' | 'any-session' | 'roles'

/**
 * Classify a permission value without evaluating it against a caller.
 *
 * For surfaces that report or route on the SHAPE of a grant rather than on a
 * caller's access to it — an admin console's `accessLevel` column, a page's
 * cacheability, a static-export skip list.
 */
export const classifyPermissionRung = (permission: PermissionValue | undefined): PermissionRung => {
  if (permission === undefined) return 'undeclared'
  if (permission === RUNG_EVERYONE) return 'everyone'
  if (permission === RUNG_ANY_SESSION) return 'any-session'
  return 'roles'
}

// ---------------------------------------------------------------------------
// The evaluator
// ---------------------------------------------------------------------------

/** Does any entry of a declared role array admit this caller? */
const matchesRoleList = (roles: readonly string[], caller: PermissionCaller): boolean => {
  const groups = caller.groups ?? []
  return roles.some((entry) =>
    entry.startsWith(GROUP_REFERENCE_PREFIX)
      ? groups.includes(entry.slice(GROUP_REFERENCE_PREFIX.length))
      : caller.role !== undefined && entry === caller.role
  )
}

/**
 * The three policies that decide without looking at the caller at all.
 * `undefined` means "not one of these" — hand on to {@link decideRoleShaped}.
 */
const decideCallerIndependent = (policy: UndeclaredPolicy): PermissionDecision | undefined => {
  if (policy.kind === 'open') return ALLOW
  if (policy.kind === 'deny') return DENIED
  if (policy.kind === 'caller-grant') return policy.allowed ? ALLOW : DENIED
  return undefined
}

/**
 * The three policies that name a required role.
 *
 * An anonymous caller — and equally a session whose role was never resolved —
 * satisfies none of them, so all three fail closed.
 */
const decideRoleShaped = (
  policy: UndeclaredPolicy,
  role: string | undefined
): PermissionDecision => {
  if (role === undefined) return DENIED
  if (policy.kind === 'admin-only') return isAdminRole(role) ? ALLOW : DENIED
  if (policy.kind === 'member-only') return role === ROLE_MEMBER ? ALLOW : DENIED
  return role === ROLE_VIEWER ? DENIED : ALLOW
}

/** Apply the site's undeclared-permission policy. */
const decideUndeclared = (
  policy: UndeclaredPolicy,
  caller: PermissionCaller | undefined
): PermissionDecision => decideCallerIndependent(policy) ?? decideRoleShaped(policy, caller?.role)

/**
 * Evaluate one permission value against one caller under an explicit policy.
 *
 * Rung order, and why:
 *
 * 1. `admin-outranks-everything` short-circuits — the only way a site can let
 *    an admin through an UNDECLARED permission.
 * 2. Undeclared → the site's named policy.
 * 3. `'all'` → allow, without consulting the caller at all. This is what makes
 *    an anonymous public read work.
 * 4. Anonymous from here on: `'authenticated'` yields `unauthorized` (401 —
 *    "sign in"), a role array yields `denied` (404 — never confirm existence).
 * 5. `'authenticated'` with a session → allow, whatever the role.
 * 6. Role array → admin override if the policy grants one, else role/group match.
 */
export const evaluatePermission = (
  permission: PermissionValue | undefined,
  caller: PermissionCaller | undefined,
  policy: PermissionPolicy
): PermissionDecision => {
  const callerIsAdmin = isAdminRole(caller?.role)
  if (policy.adminOverride === 'admin-outranks-everything' && callerIsAdmin) return ALLOW
  return permission === undefined
    ? decideUndeclared(policy.whenUndeclared, caller)
    : evaluateDeclared(permission, caller, policy.adminOverride, callerIsAdmin)
}

/** Walk the rungs of a permission the config actually declared. Steps 3–6 above. */
const evaluateDeclared = (
  permission: PermissionValue,
  caller: PermissionCaller | undefined,
  adminOverride: AdminOverride,
  callerIsAdmin: boolean
): PermissionDecision => {
  if (permission === RUNG_EVERYONE) return ALLOW
  if (caller === undefined) {
    return permission === RUNG_ANY_SESSION ? UNAUTHORIZED : DENIED
  }
  if (permission === RUNG_ANY_SESSION) return ALLOW
  if (adminOverride !== 'no-admin-override' && callerIsAdmin) return ALLOW
  return matchesRoleList(permission, caller) ? ALLOW : DENIED
}

/**
 * Most-permissive-wins evaluation across a caller's EFFECTIVE roles.
 *
 * A caller can hold more than one role at once — a global Better Auth role plus
 * `system.user_access` overlay roles plus `group:<name>` memberships. The
 * combining rule is union, not intersection: any one of them granting access
 * grants access. Applying the undeclared policy per-role is deliberate and
 * preserves the pre-existing semantics of `passesTableRoleGate`.
 */
export const evaluatePermissionForRoles = (
  permission: PermissionValue | undefined,
  effectiveRoles: readonly string[],
  policy: PermissionPolicy
): PermissionDecision =>
  effectiveRoles.some((role) => permits(evaluatePermission(permission, { role }, policy)))
    ? ALLOW
    : DENIED
