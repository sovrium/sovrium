/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { isAdminRole } from '@/domain/models/app/auth/permission-evaluation'

/**
 * Built-in Role Names
 *
 * These roles are always available without configuration.
 * They cannot be redefined by custom role definitions.
 *
 * Hierarchy (highest to lowest):
 * - admin (80): Can manage members and settings
 * - member (40): Standard access to organization resources
 * - viewer (10): Read-only access
 */
export const BUILT_IN_ROLES = ['admin', 'member', 'viewer'] as const

export const BUILT_IN_ROLE_LEVELS: Readonly<Record<string, number>> = {
  admin: 80,
  member: 40,
  viewer: 10,
}

/**
 * Built-in Role Schema
 *
 * The three built-in roles with predefined hierarchy levels.
 */
export const BuiltInRoleSchema = Schema.Literals(['admin', 'member', 'viewer']).pipe(
  Schema.annotate({
    title: 'Built-in Role',
    description: 'Built-in role with predefined hierarchy. Levels: admin=80, member=40, viewer=10',
    examples: ['admin', 'member', 'viewer'],
  })
)

/** @public */
export type BuiltInRole = Schema.Schema.Type<typeof BuiltInRoleSchema>

/**
 * Role Name Schema
 *
 * Validates role naming convention: lowercase, alphanumeric, hyphens allowed.
 * Must start with a letter.
 *
 * @example
 * ```typescript
 * 'editor'          // valid
 * 'content-manager' // valid
 * 'Editor'          // invalid (uppercase)
 * '123role'         // invalid (starts with number)
 * ```
 */
export const RoleNameSchema = Schema.String.pipe(
  Schema.annotate({
    title: 'Role Name',
    description: 'Role name: lowercase, alphanumeric, hyphens. Must start with a letter.',
    examples: ['editor', 'content-manager', 'moderator'],
  }),
  Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
)

/** @public */
export type RoleName = Schema.Schema.Type<typeof RoleNameSchema>

/**
 * `$currentUser.assignments.<table>[0]` interpolation token pattern.
 *
 * Used in `defaultLanding` URLs to substitute the first record ID from a
 * user's `user_access` rows for a given scope table. The `<table>` segment
 * matches the slug pattern enforced by `auth.scopeTables`.
 */
const ASSIGNMENT_TOKEN_PATTERN = /\$currentUser\.assignments\.[a-z][a-z0-9_-]*\[0\]/g

const validateLandingUrlTokens = (
  fieldName: 'defaultLanding' | 'pickerLanding',
  value: string,
  options: Readonly<{ allowToken: boolean; requireToken: boolean }>
): string | undefined => {
  const matches = value.match(ASSIGNMENT_TOKEN_PATTERN) ?? []
  if (!options.allowToken && matches.length > 0) {
    return `${fieldName} must not contain a $currentUser.assignments.<table>[0] token (the multi-record case has no single ID to substitute)`
  }
  if (matches.length > 1) {
    return `${fieldName} may contain at most one $currentUser.assignments.<table>[0] token, found ${matches.length}`
  }
  if (options.requireToken && matches.length === 0) {
    return `${fieldName} must contain a $currentUser.assignments.<table>[0] token`
  }
  return undefined
}

/**
 * Default Landing URL Schema
 *
 * Per-role landing URL evaluated when a session navigates to
 * `auth.landingPath`. Resolved at session-establish time by walking
 * `auth.roles[]` in declaration order and selecting the first role whose
 * `defaultLanding` matches the user's session shape.
 *
 * Supports a single `$currentUser.assignments.<table>[0]` interpolation
 * token. Token presence vs absence drives engine resolution:
 *
 * - **No token** (e.g., `/admin`): unconditional redirect for users with
 *   this role.
 * - **One token** (e.g., `/portal/clients/$currentUser.assignments.clients[0]`):
 *   single-record landing. Engine substitutes the first assignment ID for
 *   `<table>` when the user has exactly one assignment in that scope.
 *   Multi-record case is handled by the role's optional `pickerLanding`.
 *
 * Two or more tokens are rejected (the resolver cannot infer which scope
 * table to count).
 *
 * @example
 * ```yaml
 * defaultLanding: /admin
 * defaultLanding: /portal/clients/$currentUser.assignments.clients[0]
 * ```
 */
export const DefaultLandingSchema = Schema.String.annotate({
  description:
    'Where someone with this role is sent after signing in. It starts with `/`, and may carry one `$currentUser.assignments.<table>[0]` token to land them on their own record.',
}).pipe(
  Schema.check(Schema.isPattern(/^\//)),
  Schema.check(
    Schema.makeFilter((value) =>
      validateLandingUrlTokens('defaultLanding', value, { allowToken: true, requireToken: false })
    )
  ),
  Schema.annotate({
    title: 'Default Landing URL',
    description:
      'Per-role landing URL evaluated when a session navigates to auth.landingPath. Must start with /. Supports at most one $currentUser.assignments.<table>[0] token. Token presence selects single-record landing; absence is unconditional.',
    examples: ['/admin', '/portal/clients/$currentUser.assignments.clients[0]', '/dashboard'],
  })
)

/**
 * Picker Landing URL Schema
 *
 * Multi-record fallback for a role whose `defaultLanding` contains a
 * `$currentUser.assignments.<table>[0]` token. Engine redirects here when
 * the user has more than one assignment in the templated scope. Designer
 * controls the URL — there is no engine convention for the picker path.
 *
 * Validation:
 * - Must start with `/`
 * - Must NOT contain any `$currentUser.assignments.<table>[0]` token (the
 *   multi-record case has no single ID to substitute)
 * - Cross-validated against `defaultLanding` at the role level: only
 *   meaningful when `defaultLanding` has a template
 *
 * @example
 * ```yaml
 * pickerLanding: /portal/select/clients
 * pickerLanding: /portal/companies-picker
 * ```
 */
export const PickerLandingSchema = Schema.String.annotate({
  description:
    'Where someone with this role is sent instead when the landing token matches more than one record, so they can pick. It starts with `/` and carries no token.',
}).pipe(
  Schema.check(Schema.isPattern(/^\//)),
  Schema.check(
    Schema.makeFilter((value) =>
      validateLandingUrlTokens('pickerLanding', value, { allowToken: false, requireToken: false })
    )
  ),
  Schema.annotate({
    title: 'Picker Landing URL',
    description:
      'Multi-record fallback URL for the role. Used when defaultLanding has a $currentUser.assignments.<table>[0] token and the user has more than one assignment in that scope. Must start with /. Must not contain any assignment tokens.',
    examples: ['/portal/select/clients', '/portal/companies-picker'],
  })
)

/**
 * Custom Role Definition Schema
 *
 * Defines a custom role with optional description, hierarchy level, and
 * post-login landing rules.
 *
 * @example
 * ```typescript
 * { name: 'editor', description: 'Can edit content', level: 30 }
 * { name: 'moderator' }
 * { name: 'engineer', defaultLanding: '/admin' }
 * { name: 'customer-admin',
 *   defaultLanding: '/portal/clients/$currentUser.assignments.clients[0]',
 *   pickerLanding: '/portal/select/clients' }
 * ```
 */
/**
 * Dashboard-tier Schema (F6).
 *
 * The closed enum a role may map onto to become admin-dashboard-capable.
 * Apps declare which of their custom roles can reach the Native Admin
 * Dashboard by mapping the role onto one of these two tiers — they cannot
 * invent tiers, so the operator-plane attack surface stays fixed and
 * auditable.
 *
 * - `admin-editor`: full read + write (can publish through the draft ledger).
 * - `admin-viewer`: read-only dashboard (read routes only; write routes 404).
 *
 * `admin-editor ⊇ admin-viewer`. See {@link resolveDashboardTier}.
 */
export const DashboardTierSchema = Schema.Literals(['admin-editor', 'admin-viewer']).pipe(
  Schema.annotate({
    title: 'Dashboard Tier',
    description:
      'Native Admin Dashboard access tier. admin-editor = full read + write (publish); admin-viewer = read-only. admin-editor ⊇ admin-viewer.',
    examples: ['admin-editor', 'admin-viewer'],
  })
)

/** @public */
export type DashboardTier = Schema.Schema.Type<typeof DashboardTierSchema>

export const RoleDefinitionSchema = Schema.Struct({
  name: RoleNameSchema,
  description: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Human-readable description of the role' }))
  ),
  level: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description:
          'Hierarchy level (higher = more permissions). Built-in: admin=80, member=40, viewer=10',
      })
    )
  ),
  defaultLanding: Schema.optional(DefaultLandingSchema),
  pickerLanding: Schema.optional(PickerLandingSchema),
  dashboardTier: Schema.optional(DashboardTierSchema),
  /**
   * Invite grant: `true` lets a NON-admin-equivalent role invite users through
   * `POST /api/auth/admin/invite-user`, which is otherwise reachable only by the
   * app's admin-equivalent role ({@link isAdminEquivalent}).
   *
   * Optional, and **absent means `false`** — every existing app is unaffected,
   * because the grant only ever widens the guard and never narrows it. It is a
   * boolean rather than an object because the two things a scoped invite needs
   * are already expressed elsewhere in the config, and duplicating either here
   * would create a second source of truth that could disagree with the first:
   *
   * WHAT IT GRANTS
   * - Reaching the invite endpoint at all, without being admin-equivalent.
   *
   * WHAT IT DELIBERATELY DOES **NOT** GRANT
   * - **It does not lift the `level` ceiling.** The invited role's `level` must
   *   still be at or below the granted role's own, so a `canInvite` role can
   *   never mint a peer of a role above it. Privilege escalation stays closed by
   *   the hierarchy that already exists — this property adds no rung to it.
   * - **It does not cross tenants.** The tenant is a `auth.scopeTables` row
   *   materialised in `system.user_access`; the invitee inherits the inviter's
   *   assignments and nothing else. The grant confers no ability to place a user
   *   in a scope the inviter cannot already reach. (Notably NOT the Better Auth
   *   organization plugin: Sovrium is single-org by construction, so an org
   *   filter would range over exactly one value and scope nothing.)
   * - **It does not change the denial shape.** A caller without the grant, or one
   *   exceeding its ceiling, still receives **404** and never 403 — the S1
   *   anti-enumeration rule is unchanged.
   *
   * SECURITY: this is a config-declared widening of an operator-plane guard. It
   * is meaningful only in combination with the `level` ceiling above; a guard
   * that reads this flag WITHOUT also comparing levels would turn any granted
   * role into a full admin. The two checks are one rule, not two.
   */
  canInvite: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        title: 'Can Invite',
        description:
          'Allows this role to invite users via POST /api/auth/admin/invite-user without being admin-equivalent. Absent means false. Does not lift the level ceiling (the invited role must be at or below this role) and does not cross tenants (the invitee inherits the inviter scope assignments). Denials remain 404.',
        examples: [true, false],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    title: 'Role Definition',
    description:
      'Custom role definition with name, optional description, hierarchy level, and post-login landing rules.',
    examples: [
      { name: 'editor', description: 'Can edit content', level: 30 },
      { name: 'moderator', level: 20 },
      { name: 'contributor' },
      { name: 'engineer', defaultLanding: '/admin' },
      {
        name: 'customer-admin',
        defaultLanding: '/portal/clients/$currentUser.assignments.clients[0]',
        pickerLanding: '/portal/select/clients',
      },
    ],
  }),
  Schema.check(
    Schema.makeFilter((role) => {
      if (role.pickerLanding && !role.defaultLanding) {
        return `Role '${role.name}' has pickerLanding but no defaultLanding. pickerLanding is the multi-record fallback for a templated defaultLanding.`
      }
      if (role.pickerLanding && role.defaultLanding) {
        // Use match() instead of test() — test() on a /g regex has stateful
        // lastIndex which would mutate the shared pattern (rejected by ESLint
        // functional/immutable-data). match() returns null or an array.
        const hasToken = role.defaultLanding.match(ASSIGNMENT_TOKEN_PATTERN) !== null
        if (!hasToken) {
          return `Role '${role.name}' has pickerLanding but defaultLanding has no $currentUser.assignments.<table>[0] token. pickerLanding is only meaningful when defaultLanding is templated.`
        }
      }
      return undefined
    })
  )
)

export type RoleDefinition = Schema.Schema.Type<typeof RoleDefinitionSchema>

/**
 * Roles Config Schema
 *
 * Array of custom role definitions. Empty array is valid (only built-in roles).
 *
 * Validates:
 * - Role names are unique
 * - Custom role names don't conflict with built-in role names
 *
 * @example
 * ```typescript
 * []  // valid: only built-in roles
 * [{ name: 'editor', level: 30 }, { name: 'moderator', level: 20 }]
 * ```
 */
export const RolesConfigSchema = Schema.Array(RoleDefinitionSchema)
  .annotate({
    description:
      'Roles of your own, on top of the built-in admin, member and viewer. Each carries a level that decides what it inherits. A built-in role may also be listed, with nothing but a `defaultLanding` (and `pickerLanding`), to choose where it lands after signing in.',
  })
  .pipe(
    Schema.check(
      Schema.makeFilter((roles) => {
        // Check for duplicate names
        const names = roles.map((r) => r.name)
        const uniqueNames = new Set(names)
        if (uniqueNames.size !== names.length) {
          const duplicates = names.filter((name, i) => names.indexOf(name) !== i)
          return `Duplicate role names: ${duplicates.join(', ')}`
        }

        // A built-in role may be named only to give it a landing: its level,
        // tier and invite right are the engine's, never redefined here.
        const conflicts = roles
          .filter((role) => (BUILT_IN_ROLES as readonly string[]).includes(role.name))
          .filter(
            (role) =>
              role.defaultLanding === undefined ||
              role.level !== undefined ||
              role.dashboardTier !== undefined ||
              role.canInvite !== undefined
          )
          .map((role) => role.name)
        if (conflicts.length > 0) {
          return `Custom role names cannot conflict with built-in roles: ${conflicts.join(', ')}. A built-in role may be listed only to give it a defaultLanding (and pickerLanding).`
        }

        return undefined
      })
    ),
    Schema.annotate({
      title: 'Roles Configuration',
      description: 'Array of custom role definitions. Built-in roles are always available.',
      examples: [
        [],
        [
          { name: 'editor', description: 'Can edit content', level: 30 },
          { name: 'moderator', level: 20 },
        ],
      ],
    })
  )

/** @public */
export type RolesConfig = Schema.Schema.Type<typeof RolesConfigSchema>

/**
 * Default Role Schema
 *
 * Accepts built-in roles and custom role names.
 * Defaults to 'member' when not specified.
 *
 * @example
 * ```typescript
 * 'viewer'   // built-in role
 * 'editor'   // custom role (must be defined in auth.roles)
 * ```
 */
export const DefaultRoleSchema = Schema.String.pipe(
  Schema.annotate({
    defaultNote: 'member',
    title: 'Default Role',
    description:
      'Role assigned to new users by default. Must be a built-in role (`admin`, `member`, `viewer`) or a name declared in `auth.roles`; any other name, including the admin-tier names, fails validation at startup. Defaults to member.',
    examples: ['member', 'viewer', 'editor'],
  })
)

/** @public */
export type DefaultRole = Schema.Schema.Type<typeof DefaultRoleSchema>

// ============================================================================
// Admin-equivalent role resolution (WI-5)
// ============================================================================

/**
 * Minimal structural shape of an app needed to resolve the admin-equivalent
 * role. Declared structurally (rather than importing `App`) to keep this
 * roles leaf module free of a circular dependency on the app aggregate.
 */
export interface AdminRoleResolvable {
  readonly auth?: {
    readonly roles?: readonly {
      readonly name: string
      readonly level?: number
      readonly dashboardTier?: DashboardTier
      readonly canInvite?: boolean
    }[]
  }
}

/**
 * Hierarchy level used when a custom role omits `level`. Custom roles default
 * to the built-in `member` level (40) — the same baseline Better Auth assigns
 * to unprivileged custom roles. Built-in roles use {@link BUILT_IN_ROLE_LEVELS}.
 *
 * NOTE the deliberate asymmetry with the agent-approval resolver in
 * `src/presentation/api/routes/agents/agent-roles.ts`, which shares this TABLE
 * but falls back to 0. That one ranks an arbitrary session role against a
 * required approver role, so it must fail closed. This one ranks DECLARED roles
 * against each other, so a 0 fallback would sort a level-less custom role below
 * `viewer` and change which role an app treats as admin-equivalent. Do not
 * unify the fallbacks.
 */
const resolveRoleLevel = (role: { readonly name: string; readonly level?: number }): number => {
  if (typeof role.level === 'number') return role.level
  return BUILT_IN_ROLE_LEVELS[role.name] ?? BUILT_IN_ROLE_LEVELS['member']!
}

/**
 * The roles an app declares that take part in its hierarchy — `auth.roles[]`
 * minus the entries naming a built-in role.
 *
 * A built-in name is listed only to give that role a landing: the
 * entry carries no `level`, tier or invite right, and it redefines nothing. It
 * must therefore never count as "the app declares custom roles" — otherwise an
 * app whose only entry is `{ name: 'member', defaultLanding: '/mine' }` would
 * resolve `member` as its top role, making every member admin-equivalent (the
 * row-level bypass) and admin-tier (the operator console).
 */
const hierarchyRoles = (
  app: AdminRoleResolvable
): NonNullable<NonNullable<AdminRoleResolvable['auth']>['roles']> =>
  (app.auth?.roles ?? []).filter(
    (role) => !(BUILT_IN_ROLES as readonly string[]).includes(role.name)
  )

/**
 * Resolve the single "admin-equivalent" role for an app — the configured
 * custom role with the highest `level`.
 *
 * "Admin-equivalent" means **unrestricted**: the one role that bypasses
 * row-level access controls and satisfies bare `defaultLanding` redirects
 * (mirrors Better Auth's `admin` superuser semantics). Apps with custom roles
 * (e.g. cloud `operator` level 80, partner `engineer` level 80) declare a
 * top-level role documented as unrestricted; this resolver makes the engine
 * honor that intent consistently instead of hardcoding the literal `'admin'`.
 *
 * Resolution rules (deliberately conservative — only ONE role is admin-equivalent):
 * - No custom roles configured → `'admin'` (built-in default; behavior unchanged).
 * - Custom roles configured → the role with the strictly highest `level`,
 *   provided that level reaches the built-in `admin`'s own (80).
 *   - On a tie for the highest level, declaration order wins (the first
 *     declared role at the top level). This keeps resolution deterministic.
 *   - A top custom role BELOW 80 is not admin-equivalent: `'admin'` is
 *     returned instead, and the custom role keeps every restriction its grants
 *     declare. Being the only custom role an app declares must never turn a
 *     mid-level role into a superuser.
 *
 * The built-in `admin` role (level 80) remains admin-equivalent for any app
 * that does not declare custom roles, so default behavior is unchanged.
 */
export const resolveAdminRole = (app: AdminRoleResolvable): string => {
  const roles = hierarchyRoles(app)
  if (roles.length === 0) return 'admin'
  const top = roles.reduce((best, role) =>
    resolveRoleLevel(role) > resolveRoleLevel(best) ? role : best
  )
  // A custom role stands in for the built-in admin only when it reaches the
  // admin's own level: a lone `editor` at 40 is a restricted role, not a
  // superuser, so the app's unrestricted role stays the built-in `admin`.
  return resolveRoleLevel(top) >= BUILT_IN_ROLE_LEVELS['admin']! ? top.name : 'admin'
}

/**
 * `true` when `roleName` is admin-equivalent (unrestricted) for the app.
 *
 * Two roles qualify — the app's highest role, and the built-in admin:
 * - the app's resolved top role ({@link resolveAdminRole}), and
 * - the built-in `'admin'` role, ALWAYS — even in an app whose custom role
 *   outranks it (a `director` at level 90 above `admin` at 80). The built-in
 *   admin is the account every app is bootstrapped with; a custom role placed
 *   above it adds a second admin-equivalent role, it never demotes the first.
 *
 * This is the one definition: every door that asks "is this caller an
 * admin?" — permanent deletes, webhook management, the row-level bypass,
 * field-read bypass — reads it here, with no per-route exception.
 *
 * SECURITY: this is the canonical "should this role bypass row-level access?"
 * predicate. Every other role — including mid-level custom roles — returns
 * `false` and keeps its row-level restrictions.
 */
export const isAdminEquivalent = (roleName: string, app: AdminRoleResolvable): boolean =>
  isAdminRole(roleName) || roleName === resolveAdminRole(app)

// ============================================================================
// Dashboard-tier resolution (F6 — Native Admin Dashboard authorization)
// ============================================================================

/**
 * Resolve the Native Admin Dashboard tier a `roleName` maps to, or `undefined`
 * when the role has no dashboard access at all.
 *
 * This is the route-REACHABILITY predicate the single `/api/admin/*` admin
 * guard (`makeAdminGuard`) consults: any non-`undefined` result grants full
 * admin access. Config is code-only, so the historical editor/viewer split is
 * collapsed — the two tier values are retained only as provisionable operator
 * role names; both confer the same access. The predicate is deliberately
 * ORTHOGONAL to {@link isAdminEquivalent} (row-level data bypass): a role can
 * reach the dashboard without bypassing row-level data security, and vice versa.
 *
 * Resolution rules (in precedence order):
 * 1. Built-in `admin` → `admin-editor` — a backward-compat carve-out so a
 *    literal-`admin` user never loses access (mirrors `isAdminEquivalent`'s
 *    admin clause).
 * 2. A role literally NAMED `admin-editor` / `admin-viewer` → that tier — the
 *    per-user operator role, provisioned at runtime via the admin create-user
 *    API (no schema field needed; the role name IS the tier).
 * 3. A role declared in `app.auth.roles` with an explicit `dashboardTier`
 *    → that tier.
 * 4. The RESOLVED TOP custom role ({@link resolveAdminRole}) → `admin-editor`
 *    IMPLICITLY — the zero-config win: the strictly-highest-`level` custom role
 *    becomes admin-capable with no config edit, provided its level reaches the
 *    built-in `admin`'s 80 (below that the resolved role is `admin` itself, so
 *    this rung admits no custom role at all).
 * 5. The legacy `operator` role → `admin-viewer`, but ONLY for an app that does
 *    not declare the name. See {@link LEGACY_OPERATOR_ROLE} for why this rung
 *    sits below the config and not above it.
 * 6. Otherwise → `undefined` (no access → 404, S1 anti-enumeration).
 *
 * SECURITY: every role NOT covered by rules 1–5 returns `undefined` and is
 * 404ed on every admin route. The result set is closed, so the operator-plane
 * attack surface stays fixed and auditable.
 */
/**
 * The historical admin-tier role name, kept as an ALIAS for installs that
 * predate the per-user `admin-editor`/`admin-viewer` tiers.
 *
 * It is an alias, not a reserved word: `RolesConfigSchema` accepts `operator`
 * in `app.auth.roles[]` like any other name. Read ABOVE the config — as it was
 * — the alias silently overrode whatever the app said the role meant, so an app
 * declaring `operator` as its LOWEST-privilege role handed that role the
 * operator plane by choosing an unlucky word.
 * Declaring the name is the app stating its own meaning, and that statement
 * wins; an app that never claimed the name keeps the alias untouched.
 */
const LEGACY_OPERATOR_ROLE = 'operator'

/**
 * App-independent tier mapping: the built-in `admin` carve-out and the per-user
 * `admin-editor`/`admin-viewer` operator tiers (the role name IS the tier).
 * Returns `undefined` when `roleName` is neither — leaving every
 * config-dependent rule (explicit mapping, implicit top-role, and the legacy
 * alias, which is config-dependent precisely because a config may claim the
 * name) to {@link resolveDashboardTier}. Extracted to keep the resolver's
 * cyclomatic complexity under the lint cap.
 */
const resolveBuiltInTier = (roleName: string): DashboardTier | undefined => {
  if (isAdminRole(roleName)) return 'admin-editor'
  if (roleName === 'admin-editor' || roleName === 'admin-viewer') return roleName
  return undefined
}

export const resolveDashboardTier = (
  roleName: string,
  app: AdminRoleResolvable
): DashboardTier | undefined => {
  // Rules 1–2: app-independent built-in / per-user tiers.
  const builtIn = resolveBuiltInTier(roleName)
  if (builtIn !== undefined) return builtIn
  const declaredRoles = hierarchyRoles(app)
  const declared = declaredRoles.find((r) => r.name === roleName)
  // Rule 3: explicit per-role dashboardTier mapping in the config.
  if (declared?.dashboardTier) return declared.dashboardTier
  // Rule 4: the resolved top custom role → admin-editor implicitly.
  if (declaredRoles.length > 0 && roleName === resolveAdminRole(app)) {
    return 'admin-editor'
  }
  // Rule 5: the legacy alias, LAST — a declared role of the same name has
  // already had rules 3 and 4 applied to it on its own terms, so reaching here
  // with `declared` set means the app gave that role no dashboard claim at all.
  if (roleName === LEGACY_OPERATOR_ROLE && declared === undefined) return 'admin-viewer'
  // Rule 6: no tier.
  return undefined
}

/**
 * `true` when `roleName` can reach the admin/operator surface for the app — the
 * single canonical "is this an admin-tier role?" GUARD predicate.
 *
 * This is the boolean projection of {@link resolveDashboardTier}: a role is
 * admin-tier exactly when it resolves to ANY dashboard tier (config is code-only,
 * so the historical editor/viewer split confers the same access — see
 * `makeAdminGuard`). Every admin/operator route guard MUST consult this predicate
 * rather than a literal `role === 'admin'` check: the literal falsely 404s a
 * custom TOP role (e.g. partner's `engineer`, level 80, which resolves to
 * `admin-editor` via rule 5) while still admitting it would silently break a
 * legitimate operator. Built-in `admin` still passes (rule 1); a plain `member`
 * still fails.
 *
 * SECURITY: this is the one shared admit/deny predicate for the operator plane.
 * Callers that deny return the S1 anti-enumeration 404 (never 403), so the admin
 * route surface stays undiscoverable.
 */
export const isAdminTier = (roleName: string, app: AdminRoleResolvable): boolean =>
  resolveDashboardTier(roleName, app) !== undefined

/**
 * `true` when `roleName` may make the console's OPERATIONAL writes — re-fire a
 * run, pause or resume an automation, re-point a public link, connect or
 * disconnect an OAuth account, publish the design system to a link holder.
 *
 * The ONE definition of the `admin-editor` tier as a power: the admin-route
 * guard of those writes (`requireAdminEditor`) and the `edit-operations` caller
 * capability a console page gates their controls on both read it, so the
 * control a page draws and the request the server accepts can never disagree.
 * The read-only `admin-viewer` tier — and the legacy `operator` alias that
 * resolves to it — reaches the console ({@link isAdminTier}) and holds no such
 * power. Orthogonal to {@link isAdminEquivalent}, which governs ACCOUNT writes.
 */
export const canEditOperations = (roleName: string, app: AdminRoleResolvable): boolean =>
  resolveDashboardTier(roleName, app) === 'admin-editor'

// ============================================================================
// Invite authorization
// ============================================================================

/**
 * `true` when a caller holding `callerRoleName` may issue an invitation for
 * `invitedRoleName` — the single admit/deny predicate behind
 * `POST /api/auth/admin/invite-user`.
 *
 * ONE rule with four clauses, not four rules. The `canInvite` grant is only ever
 * meaningful in combination with the ceiling below it: a guard that read the flag
 * without also bounding the invited role would turn any granted role into a full
 * admin, which is the entire risk this predicate exists to close.
 *
 * 1. An admin-equivalent caller is admitted unconditionally — today's behaviour,
 *    unchanged, and the reason every existing app is unaffected. The grant only
 *    ever WIDENS this guard; it can never narrow it.
 * 2. Otherwise the caller's role must be DECLARED in `app.auth.roles[]` with
 *    `canInvite: true`. Absent means false, so an app that never heard of the
 *    property behaves exactly as before.
 * 3. The invited role must not be admin-tier ({@link isAdminTier}). This clause
 *    is not redundant with the level ceiling and removing it re-opens the hole:
 *    the runtime-only operator names (`admin-editor`, `admin-viewer`, `operator`)
 *    are absent from `app.auth.roles[]` and from {@link BUILT_IN_ROLE_LEVELS}, so
 *    {@link resolveRoleLevel} scores them at the `member` fallback of 40 — which
 *    a level-40 granted role would clear, minting an admin-dashboard-capable
 *    account. The operator plane is closed to non-admin inviters outright.
 * 4. The invited role's level must be at or below the caller's own. AT is
 *    deliberate: minting a peer is not an escalation, minting a superior is.
 *
 * What this predicate does NOT decide: whether the invited role is a name the app
 * knows at all ({@link isAssignableRole}, checked downstream and answering 400),
 * and which tenant the invitee lands in (the inviter's `system.user_access`
 * assignments, inherited by the invitation flow). It grants reachability only.
 *
 * `invitedRoleName` is optional because the invited role arrives in the request
 * BODY: a caller who sends no role cannot be size-checked against the ceiling, so
 * a non-admin-equivalent caller is denied. An admin-equivalent caller still falls
 * through clause 1 and receives the existing 400 `role is required` from
 * validation, so no caller that worked before behaves differently.
 *
 * SECURITY: denial is reported by the caller as **404**, never 403 (S1
 * anti-enumeration) — identical to the shape a wholly unauthorized caller gets,
 * so the endpoint stays undiscoverable to anyone probing for it.
 */
export const canInviteRole = (
  callerRoleName: string,
  invitedRoleName: string | undefined,
  app: AdminRoleResolvable
): boolean => {
  // Clause 1 — the unchanged admin-equivalent path.
  if (isAdminEquivalent(callerRoleName, app)) return true
  if (invitedRoleName === undefined) return false

  // Clause 2 — the opt-in grant, which must be DECLARED on the caller's role.
  const declaredRoles = app.auth?.roles ?? []
  const caller = declaredRoles.find((role) => role.name === callerRoleName)
  if (caller?.canInvite !== true) return false

  // Clause 3 — the operator plane is never reachable through a scoped invite.
  if (isAdminTier(invitedRoleName, app)) return false

  // Clause 4 — the hierarchy ceiling. An undeclared invited role is scored
  // through the same resolver so built-ins rank by their real level rather than
  // by a second, divergent table.
  const invited = declaredRoles.find((role) => role.name === invitedRoleName) ?? {
    name: invitedRoleName,
  }
  return resolveRoleLevel(invited) <= resolveRoleLevel(caller)
}

// ============================================================================
// Assignable-role vocabulary
// ============================================================================

/**
 * The privileged role names that confer admin-dashboard access WITHOUT being
 * declared in `app.auth.roles[]`.
 *
 * These are provisioned per-user at runtime (the role name IS the tier — see
 * {@link resolveDashboardTier} rule 2, and rule 5 for the legacy
 * {@link LEGACY_OPERATOR_ROLE} alias), so they never appear in a config file
 * and are therefore absent from {@link BUILT_IN_ROLES}. They must still be
 * ASSIGNABLE: the admin API is the only way to grant them.
 *
 * SECURITY: this list is the operator-plane provisioning vocabulary. Adding a
 * name here makes it assignable through `/api/auth/admin/*`; it does NOT by
 * itself grant a tier — {@link resolveDashboardTier} owns that mapping. The two
 * must stay in lockstep, which the co-located unit test asserts against an app
 * declaring no roles, the only shape in which `operator` still means the alias.
 */
export const ADMIN_TIER_ROLE_NAMES = ['admin-editor', 'admin-viewer', 'operator'] as const

/**
 * Every role name that may be ASSIGNED to a user for this app:
 * {@link BUILT_IN_ROLES} ∪ {@link ADMIN_TIER_ROLE_NAMES} ∪ the names declared
 * in `app.auth.roles[]`.
 *
 * This is deliberately WIDER than the config-declarable vocabulary (which
 * `RolesConfigSchema` and `validateGroupNames` police) because the admin-tier
 * names exist only at runtime. It is the single source of truth for "is this a
 * role this app knows about?" — consulted by the Better Auth write-boundary
 * hook and by the `auth/assignRole` + `auth/createUser` automation actions, so
 * the HTTP API and the automation engine can never disagree.
 */
export const assignableRoleNames = (app: AdminRoleResolvable): ReadonlySet<string> =>
  new Set<string>([
    ...BUILT_IN_ROLES,
    ...ADMIN_TIER_ROLE_NAMES,
    ...(app.auth?.roles ?? []).map((role) => role.name),
  ])

/**
 * `true` when `roleName` may be assigned to a user for this app.
 *
 * SECURITY: enforcing this at every write boundary is what turns the role
 * column into a closed vocabulary. Without it, Better Auth stores any string
 * verbatim, so a typo (`'admim'`) silently produces a user who matches no
 * permission rule, and an invented name (`'superadmin'`) reads as privileged to
 * a human auditor while conferring nothing.
 */
export const isAssignableRole = (roleName: string, app: AdminRoleResolvable): boolean =>
  assignableRoleNames(app).has(roleName)

/**
 * Every role name that is admin-tier for this app ({@link isAdminTier}), as a
 * list — the vocabulary a query can filter the `role` column by.
 *
 * The enumeration is the assignable vocabulary ({@link assignableRoleNames})
 * narrowed by the tier predicate, so the two can never disagree: a role no
 * write door accepts cannot be stored, and a stored role is listed here exactly
 * when the operator plane admits it. Used to address the operator's emails —
 * automation alerts and the weekly summary — to everyone who can act on them.
 *
 * Deliberately WIDER than the admin-equivalent pair the last-admin guard counts
 * (`admin-role-guards.ts`): an `admin-viewer` or an `operator` cannot reach
 * `/api/auth/admin/*`, but can read the console an alert links to.
 */
export const adminTierRoleNames = (app: AdminRoleResolvable): readonly string[] =>
  [...assignableRoleNames(app)].filter((roleName) => isAdminTier(roleName, app))
