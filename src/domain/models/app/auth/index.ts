/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AuthEmailTemplatesSchema } from './email-templates'
import { GroupSchema } from './groups'
import { DefaultRoleSchema, BUILT_IN_ROLES, RolesConfigSchema } from './roles'
import { AuthStrategiesSchema, type AuthStrategy } from './strategies'
import { TwoFactorConfigSchema } from './two-factor'

// Re-export all auth-related schemas and types for convenient imports
export * from './email-templates'
export * from './groups'
export * from './strategies/oauth'
export * from './roles'
export * from '@/domain/types/session-info'
export * from './strategies'
export * from './two-factor'

/**
 * Strategy type names
 */
type StrategyType = 'emailAndPassword' | 'magicLink' | 'oauth'

/**
 * Check if a specific strategy type is present in the strategies array
 */
export const hasStrategy = (auth: Auth | undefined, strategyType: StrategyType): boolean => {
  if (!auth?.strategies) return false
  return auth.strategies.some((s) => s.type === strategyType)
}

/**
 * Get a specific strategy configuration by type
 */
export const getStrategy = <T extends StrategyType>(
  auth: Auth | undefined,
  strategyType: T
): Extract<AuthStrategy, { readonly type: T }> | undefined => {
  if (!auth?.strategies) return undefined
  return auth.strategies.find((s) => s.type === strategyType) as
    | Extract<AuthStrategy, { readonly type: T }>
    | undefined
}

/**
 * Get all strategy type names that are enabled
 */
export const getEnabledStrategies = (auth: Auth | undefined): readonly StrategyType[] => {
  if (!auth?.strategies) return []
  return auth.strategies.map((s) => s.type)
}

// Legacy aliases for backward compatibility during migration
export const isMethodEnabled = (auth: Auth | undefined, method: StrategyType): boolean =>
  hasStrategy(auth, method)

export const getEnabledMethods = (auth: Auth | undefined): readonly StrategyType[] =>
  getEnabledStrategies(auth)

export const hasAnyMethodEnabled = (auth: Auth | undefined): boolean =>
  (auth?.strategies?.length ?? 0) > 0

/**
 * Authentication Configuration Schema
 *
 * Comprehensive authentication configuration supporting all Better Auth features.
 * If this config exists, authentication is enabled.
 * If omitted from the app config, no auth endpoints are available.
 *
 * Admin features (user management, role assignment, impersonation) are always
 * enabled when auth is configured — no separate toggle needed.
 *
 * Infrastructure configuration (secrets, URLs, credentials) is handled via
 * environment variables, not in this schema. See .env.example for details.
 *
 * Structure:
 * - allowSignUp: Boolean controlling self-registration (optional, defaults to true)
 * - strategies: Array of authentication strategy objects (required, at least one)
 * - roles: Custom role definitions with hierarchy (optional)
 * - defaultRole: Role assigned to new users (optional, defaults to 'member')
 * - twoFactor: TOTP-based two-factor authentication (optional)
 * - emailTemplates: Custom email templates (optional)
 *
 * @example
 * ```typescript
 * // Minimal
 * { strategies: [{ type: 'emailAndPassword' }] }
 *
 * // Disable self-registration (admin-only user creation)
 * {
 *   allowSignUp: false,
 *   strategies: [{ type: 'emailAndPassword' }],
 * }
 *
 * // With custom roles and defaultRole
 * {
 *   strategies: [{ type: 'emailAndPassword', minPasswordLength: 12 }],
 *   defaultRole: 'viewer',
 *   roles: [{ name: 'editor', description: 'Can edit content', level: 30 }]
 * }
 *
 * // Multiple strategies
 * {
 *   strategies: [
 *     { type: 'emailAndPassword' },
 *     { type: 'oauth', providers: ['google', 'github'] }
 *   ]
 * }
 * ```
 */
/**
 * Allow Sign-Up Schema
 *
 * Controls whether users can self-register or only admins can create accounts.
 *
 * - `true` (default): Anyone can sign up via enabled authentication strategies
 * - `false`: Self-registration is disabled; only admins can create users
 *   via `POST /api/auth/admin/create-user`
 *
 * Maps directly to Better Auth's `disableSignUp` option (inverted: allowSignUp=false → disableSignUp=true).
 */
export const AllowSignUpSchema = Schema.Boolean.pipe(
  Schema.annotations({
    title: 'Allow Sign-Up',
    description:
      'Controls user self-registration. true allows anyone to sign up. false restricts user creation to admins.',
    examples: [true, false],
  })
)

/**
 * Invitation Token Expiry Schema
 *
 * Lifetime of single-use tokens issued by `POST /api/auth/admin/invite-user`.
 * Default is 72h (3 days). Accepted forms:
 *
 * - Duration string: `<positive integer><unit>` where `unit ∈ {s, m, h, d}`
 *   Examples: `'30s'`, `'15m'`, `'72h'`, `'7d'`
 * - Number of milliseconds (positive integer)
 *
 * Tokens are stored in the existing Better Auth `auth.verification` table
 * with the identifier prefix `invitation:` and the configured expiry written
 * to `expires_at`. After expiry the row is rejected on accept; tokens are
 * also single-use (consumed on first successful accept).
 */
export const InvitationTokenExpirySchema = Schema.Union(
  Schema.String.pipe(
    Schema.pattern(/^[1-9]\d*[smhd]$/),
    Schema.annotations({
      description: 'Duration string e.g. "30s", "15m", "72h", "7d"',
    })
  ),
  Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({
      description: 'Lifetime in milliseconds (positive integer)',
    })
  )
).pipe(
  Schema.annotations({
    title: 'Invitation Token Expiry',
    description: 'Lifetime of single-use admin invitation tokens. Defaults to 72h when omitted.',
    examples: ['72h', '24h', '7d', 259_200_000],
  })
)

// ============================================================================
// Auth cross-validation helpers (extracted for complexity reduction)
// ============================================================================

interface AuthConfigForValidation {
  readonly strategies: readonly AuthStrategy[]
  readonly twoFactor?: unknown
  readonly defaultRole?: string
  readonly roles?: readonly {
    readonly name: string
    readonly defaultLanding?: string
    readonly pickerLanding?: string
  }[]
  readonly groups?: readonly { readonly name: string }[]
  readonly scopeTables?: readonly string[]
  readonly landingPath?: string
  readonly noAccessPath?: string
}

const validateTwoFactorRequiresEmailPassword = (
  config: AuthConfigForValidation
): string | undefined => {
  if (!config.twoFactor) return undefined
  const hasEmailPassword = config.strategies.some((s) => s.type === 'emailAndPassword')
  return hasEmailPassword
    ? undefined
    : 'Two-factor authentication requires emailAndPassword strategy'
}

const validateDefaultRoleExists = (config: AuthConfigForValidation): string | undefined => {
  if (!config.defaultRole || !config.roles) return undefined
  const builtInRoles = ['admin', 'member', 'viewer']
  const customRoleNames = config.roles.map((r) => r.name)
  const allValidRoles = [...builtInRoles, ...customRoleNames]
  return allValidRoles.includes(config.defaultRole)
    ? undefined
    : `Default role '${config.defaultRole}' is not a built-in role or defined in auth.roles`
}

const validateScopeTables = (config: AuthConfigForValidation): string | undefined => {
  if (!config.scopeTables) return undefined
  if (config.scopeTables.length === 0) {
    return 'scopeTables must contain at least one table-slug if defined'
  }
  // Validate each entry is a non-empty kebab/snake/camelCase identifier-like string
  const slugPattern = /^[a-z][a-z0-9_-]*$/i
  const invalid = config.scopeTables.find(
    (slug) => typeof slug !== 'string' || slug.length === 0 || !slugPattern.test(slug)
  )
  if (invalid !== undefined) {
    if (typeof invalid !== 'string' || invalid.length === 0) {
      return 'scopeTables entries must be non-empty strings'
    }
    return `Invalid scopeTables entry '${invalid}'. Must start with a letter and contain only letters, digits, '_', or '-'.`
  }
  // No duplicates
  const unique = new Set(config.scopeTables)
  if (unique.size !== config.scopeTables.length) {
    const dupes = config.scopeTables.filter((s, i) => config.scopeTables!.indexOf(s) !== i)
    return `Duplicate scopeTables entries: ${[...new Set(dupes)].join(', ')}`
  }
  return undefined
}

const validateLandingPathRequiredWhenRolesHaveLanding = (
  config: AuthConfigForValidation
): string | undefined => {
  if (!config.roles) return undefined
  const rolesWithLanding = config.roles.filter(
    (role) => role.defaultLanding !== undefined || role.pickerLanding !== undefined
  )
  if (rolesWithLanding.length === 0) return undefined
  if (config.landingPath === undefined) {
    return `auth.landingPath must be set when any auth.roles[].defaultLanding or auth.roles[].pickerLanding is configured. Roles with landing rules: ${rolesWithLanding.map((r) => r.name).join(', ')}`
  }
  return undefined
}

const validateGroupNames = (config: AuthConfigForValidation): string | undefined => {
  if (!config.groups || config.groups.length === 0) return undefined

  const groupNames = config.groups.map((g) => g.name)
  const uniqueNames = new Set(groupNames)
  if (uniqueNames.size !== groupNames.length) {
    const duplicates = groupNames.filter((n, i) => groupNames.indexOf(n) !== i)
    return `Duplicate group names: ${[...new Set(duplicates)].join(', ')}`
  }

  const allRoleNames = new Set<string>([
    ...BUILT_IN_ROLES,
    ...(config.roles?.map((r) => r.name) ?? []),
  ])
  const conflicting = config.groups.find((group) => allRoleNames.has(group.name))
  return conflicting
    ? `Group name '${conflicting.name}' conflicts with a role name. Group and role names must be distinct.`
    : undefined
}

export const AuthSchema = Schema.Struct({
  // ============================================================================
  // Registration Control (optional, defaults to true)
  // ============================================================================

  /**
   * Allow self-registration (optional, defaults to true)
   *
   * Controls whether users can self-register:
   * - true: Anyone can sign up via enabled strategies (default, backward compatible)
   * - false: Self-registration disabled, only admins create users
   */
  allowSignUp: Schema.optional(AllowSignUpSchema),

  // ============================================================================
  // Authentication Strategies (required)
  // ============================================================================

  /**
   * Array of authentication strategies.
   * At least one strategy must be defined. No duplicate types allowed.
   */
  strategies: AuthStrategiesSchema,

  // ============================================================================
  // Role Configuration (optional)
  // ============================================================================

  /**
   * Custom role definitions (optional)
   *
   * Define additional roles beyond the built-in ones (admin, member, viewer).
   * Empty array means only built-in roles are available.
   */
  roles: Schema.optional(RolesConfigSchema),

  /**
   * Default role for new users (optional)
   *
   * Role assigned to users on registration. Defaults to 'member'.
   * Must reference a built-in role or a custom role name.
   */
  defaultRole: Schema.optional(DefaultRoleSchema),

  // ============================================================================
  // Feature Extensions (optional)
  // ============================================================================

  /**
   * Two-factor authentication plugin configuration (optional)
   *
   * Enable TOTP-based two-factor authentication. Users can set up 2FA
   * using authenticator apps. Requires emailAndPassword strategy.
   */
  twoFactor: Schema.optional(TwoFactorConfigSchema),

  /**
   * Email templates for authentication flows (optional)
   *
   * Customize the subject and content of emails sent during authentication.
   * Templates support variable substitution using $variable syntax.
   */
  emailTemplates: Schema.optional(AuthEmailTemplatesSchema),

  /**
   * Invitation token lifetime (optional, defaults to 72h)
   *
   * Controls how long single-use tokens issued by
   * `POST /api/auth/admin/invite-user` remain valid. Accepts a duration
   * string (`'72h'`, `'7d'`) or a positive integer of milliseconds.
   *
   * Shorter expiries are recommended for high-security customer portals;
   * the default is tuned for B2B onboarding where customers may not check
   * their email immediately.
   */
  invitationTokenExpiry: Schema.optional(InvitationTokenExpirySchema),

  // ============================================================================
  // Groups (optional)
  // ============================================================================

  /**
   * User groups for RBAC grouping (optional)
   *
   * Groups complement roles by providing many-to-many user-to-group membership.
   * A user can belong to multiple groups, and permissions can reference groups
   * using the `group:` prefix (e.g., `['admin', 'group:marketing']`).
   *
   * Teams are managed through groups — define groups to organize users into
   * teams (e.g., engineering, marketing) for field-level permissions.
   */
  groups: Schema.optional(
    Schema.Array(GroupSchema).pipe(
      Schema.annotations({
        title: 'Groups',
        description:
          'User groups for permission grouping. Referenced in permissions with group: prefix. Teams are configured through groups.',
      })
    )
  ),

  // ============================================================================
  // Scope Tables (optional)
  // ============================================================================

  /**
   * Scope tables for multi-tenant `user_access` junction (optional)
   *
   * Declares which application tables can be referenced in `user_access` rows
   * (the multi-tenant access junction). Each entry is a table slug from
   * `app.tables[].name`. When set, both `user_access.table_slug` values and
   * `$currentUser.assignments.<tableSlug>` references in `dataSource.filter`
   * are validated against this allowlist at startup / insert time.
   *
   * Empty array is rejected — omit the field entirely if multi-tenant scoping
   * is not used. Entries must be valid table-slug identifiers (start with a
   * letter, contain only letters, digits, '_', or '-'). No duplicates.
   *
   * @example
   * ```yaml
   * auth:
   *   scopeTables:
   *     - clients
   *     - projects
   * ```
   */
  scopeTables: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.minLength(1),
        Schema.annotations({
          description: 'Table slug from app.tables[].name (e.g., "clients", "projects")',
        })
      )
    ).pipe(
      Schema.annotations({
        title: 'Scope Tables',
        description:
          'Tables that user_access rows can reference for multi-tenant scoping. Validated against app.tables[].name at startup.',
        examples: [['clients'], ['clients', 'projects'], ['orgs', 'workspaces', 'teams']],
      })
    )
  ),

  // ============================================================================
  // Post-Login Landing (optional)
  // ============================================================================

  /**
   * Engine-resolver mount path for post-login landing (optional)
   *
   * When set, navigations to this URL are intercepted by the engine and
   * resolved to the appropriate per-role `defaultLanding` based on the
   * authenticated session. The path is fully user-controlled (no engine
   * convention): designers pick `/portal`, `/dashboard`, `/home`, or any
   * other URL.
   *
   * If unset, no post-login resolver runs — pages are accessed directly
   * via their declared `path`. This field is required when any role has a
   * `defaultLanding` or `pickerLanding` configured.
   *
   * Co-located page declaration: `landingPath` MUST be backed by a page
   * with the same `path`. That page acts as the access guard for the
   * unauthenticated case (its `access: { require: 'authenticated',
   * redirectTo: '/login' }` block bounces anonymous visitors before the
   * landing resolver runs). For authenticated visitors the resolver
   * redirects away before the (empty) page renders.
   *
   * Earlier drafts of this design forbade collision; the implementation
   * reverses that and requires the colliding page to act as the guard
   * (see post-login-landing.md user story for the rationale).
   */
  landingPath: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^\//),
      Schema.annotations({
        title: 'Landing Path',
        description:
          'Engine-resolver mount path. Sessions navigating here are redirected to the matching role.defaultLanding. Must start with /. Must be backed by a co-located page declaration that acts as the unauthenticated-access guard.',
        examples: ['/portal', '/dashboard', '/home'],
      })
    )
  ),

  /**
   * Fallback path when no role.defaultLanding matches (optional)
   *
   * Engine redirects here when an authenticated user lands on
   * `auth.landingPath` but no role's `defaultLanding` matches their
   * session shape (e.g., user has zero assignments in any scope and is
   * not a global admin). Defaults to `/403` if omitted.
   *
   * Common values: `/403` (forbidden page), `/portal/onboarding`
   * (helpful empty-state page), or a marketing landing.
   */
  noAccessPath: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^\//),
      Schema.annotations({
        title: 'No Access Path',
        description:
          'Fallback path when no role.defaultLanding matches the session. Defaults to /403.',
        examples: ['/403', '/portal/onboarding', '/no-access'],
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'Auth',
    title: 'Authentication Configuration',
    description:
      'Authentication configuration with strategies, roles, and plugins. Admin features are always enabled when auth is configured.',
    examples: [
      { strategies: [{ type: 'emailAndPassword' as const }] },
      {
        allowSignUp: false,
        strategies: [{ type: 'emailAndPassword' as const }],
      },
      {
        strategies: [{ type: 'emailAndPassword' as const, minPasswordLength: 12 }],
        defaultRole: 'viewer',
        roles: [{ name: 'editor', description: 'Can edit content', level: 30 }],
      },
      {
        strategies: [
          { type: 'emailAndPassword' as const },
          { type: 'oauth' as const, providers: ['google', 'github'] },
        ],
      },
    ],
  }),
  Schema.filter((config) => {
    return (
      validateTwoFactorRequiresEmailPassword(config) ??
      validateDefaultRoleExists(config) ??
      validateGroupNames(config) ??
      validateScopeTables(config) ??
      validateLandingPathRequiredWhenRolesHaveLanding(config)
    )
  })
)

/**
 * TypeScript type inferred from AuthSchema
 */
export type Auth = Schema.Schema.Type<typeof AuthSchema>

/**
 * Encoded type of AuthSchema (what goes in before validation)
 * @public
 */
export type AuthEncoded = Schema.Schema.Encoded<typeof AuthSchema>

/**
 * Helper to check if auth is configured with a specific strategy
 * @public
 */
export const hasAuthenticationMethod = (auth: Auth, strategyType: StrategyType): boolean =>
  hasStrategy(auth, strategyType)

/**
 * Check if self-registration is disabled (allowSignUp: false)
 * @public
 */
export const isSignUpDisabled = (auth: Auth | undefined): boolean => auth?.allowSignUp === false

/**
 * Check if self-registration is allowed (defaults to true)
 * @public
 */
export const isSignUpAllowed = (auth: Auth | undefined): boolean => auth?.allowSignUp !== false

/**
 * Plugin names that can be checked
 */
type PluginName = 'twoFactor'

/**
 * Helper to check if auth has a specific plugin enabled
 * @public
 */
export const hasPlugin = (auth: Auth, pluginName: PluginName): boolean => {
  const plugin = auth[pluginName]
  if (typeof plugin === 'boolean') return plugin
  return plugin !== undefined
}
