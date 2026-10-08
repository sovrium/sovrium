/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { validateAccountDeletionTemplateLink } from './account-deletion-template-validation'
import { AuthApiKeysConfigSchema } from './api-keys'
import { AuthDeviceAuthorizationConfigSchema } from './device-authorization'
import { AuthEmailTemplatesSchema } from './email-templates'
import { GroupSchema } from './groups'
import { PasskeysConfigSchema } from './passkeys'
import {
  DefaultRoleSchema,
  ADMIN_TIER_ROLE_NAMES,
  BUILT_IN_ROLES,
  RolesConfigSchema,
} from './roles'
import { ScimConfigSchema } from './scim'
import { AuthSsoConfigSchema } from './sso'
import { validateEnterpriseAuth } from './sso/sso-validation'
import { AuthStrategiesSchema, type AuthStrategy } from './strategies'
import { TwoFactorConfigSchema } from './two-factor'

// Re-export all auth-related schemas and types for convenient imports

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
    Extract<AuthStrategy, { readonly type: T }> | undefined
}

/**
 * Get all strategy type names that are enabled
 */
export const getEnabledStrategies = (auth: Auth | undefined): readonly StrategyType[] => {
  if (!auth?.strategies) return []
  return auth.strategies.map((s) => s.type)
}

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
 * - strategies: Array of authentication strategy objects (at least one, unless auth.sso declares a provider)
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
  Schema.annotate({
    title: 'Allow Sign-Up',
    description:
      'Controls user self-registration. true allows anyone to sign up. false restricts user creation to admins.',
    examples: [true, false],
  })
)

/**
 * Immediate Account Deletion Schema
 *
 * Whether a signed-in user may delete their own account at once through the
 * auth API. The request mails a single-use confirmation link to the account's
 * address; following it, signed in as that account, runs the same hard erasure
 * as the scheduled purge. The door needs outgoing email and refuses the last
 * admin who can sign in.
 *
 * - `true` (default): the door is open whenever email is configured
 * - `false`: the door answers as if it did not exist
 *
 * The scheduled deletion (`POST /api/account/delete`, erased after a 7-day
 * grace period) is available whatever this is set to.
 */
export const ImmediateAccountDeletionSchema = Schema.Boolean.pipe(
  Schema.annotate({
    title: 'Immediate account deletion',
    description:
      'Lets a signed-in user delete their own account at once: they ask, a confirmation link is mailed to them, and following it erases the account and everything in it. Needs outgoing email. false closes this door; the scheduled deletion, erased after a 7-day grace period, stays available either way.',
    defaultNote: 'true',
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
export const InvitationTokenExpirySchema = Schema.Union([
  Schema.String.pipe(
    Schema.annotate({
      description: 'Duration string e.g. "30s", "15m", "72h", "7d"',
    }),
    Schema.check(Schema.isPattern(/^[1-9]\d*[smhd]$/))
  ),
  Schema.Finite.pipe(
    Schema.annotate({
      description: 'Lifetime in milliseconds (positive integer)',
    }),
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
  ),
]).pipe(
  Schema.annotate({
    defaultNote: '72h',
    title: 'Invitation Token Expiry',
    description: 'Lifetime of single-use admin invitation tokens. Defaults to 72h when omitted.',
    examples: ['72h', '24h', '7d', 259_200_000],
  })
)

// ============================================================================
// Auth cross-validation helpers (extracted for complexity reduction)
// ============================================================================

interface AuthConfigForValidation {
  readonly strategies?: readonly AuthStrategy[]
  readonly twoFactor?: unknown
  readonly apiKeys?: boolean
  readonly deviceAuthorization?: boolean
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
  readonly sso?: Parameters<typeof validateEnterpriseAuth>[0]['sso']
  readonly scim?: Parameters<typeof validateEnterpriseAuth>[0]['scim']
}

const validateTwoFactorRequiresEmailPassword = (
  config: AuthConfigForValidation
): string | undefined => {
  if (!config.twoFactor) return undefined
  const hasEmailPassword = (config.strategies ?? []).some((s) => s.type === 'emailAndPassword')
  return hasEmailPassword
    ? undefined
    : 'Two-factor authentication requires emailAndPassword strategy'
}

/**
 * An approved device code is redeemed for an API key and for nothing else, so
 * the device flow needs the API-key plugin it mints through. Without it the
 * device endpoints would hand out codes that can never be redeemed.
 */
const validateDeviceAuthorizationRequiresApiKeys = (
  config: AuthConfigForValidation
): string | undefined =>
  config.deviceAuthorization === true && config.apiKeys !== true
    ? 'auth.deviceAuthorization requires auth.apiKeys: true — an approved device code is redeemed for an API key'
    : undefined

/**
 * An auth block needs a way in: at least one strategy, or — for an SSO-only
 * app — at least one identity provider under `auth.sso`.
 */
const validateHasSignInMethod = (config: AuthConfigForValidation): string | undefined =>
  (config.strategies ?? []).length > 0 || (config.sso ?? []).length > 0
    ? undefined
    : 'auth needs at least one strategy, or at least one identity provider in auth.sso'

/**
 * `defaultRole` is the role handed to EVERY new sign-up, so its vocabulary is
 * deliberately NARROWER than `isAssignableRole`'s: the admin-tier names
 * (`operator`, `admin-editor`, `admin-viewer`) are assignable per-user but must
 * never be a default, or every registrant would arrive admin-dashboard-capable.
 */
const validateDefaultRoleExists = (config: AuthConfigForValidation): string | undefined => {
  if (!config.defaultRole) return undefined
  const builtInRoles = ['admin', 'member', 'viewer']
  // Checked whether or not `auth.roles` is present: with no roles declared the
  // only valid defaults are the built-ins.
  const customRoleNames = (config.roles ?? []).map((r) => r.name)
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

  // Table permissions address roles and groups through the SAME string space
  // (`group:<name>` vs a bare role name), so a group that shares a role's name
  // makes a permission rule ambiguous. `ADMIN_TIER_ROLE_NAMES` belongs in this
  // set even though those names are never declared in config: they are
  // assignable at runtime and confer admin-dashboard access, so a group called
  // `operator` would collide with a genuinely privileged role.
  const allRoleNames = new Set<string>([
    ...BUILT_IN_ROLES,
    ...ADMIN_TIER_ROLE_NAMES,
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

  /**
   * Immediate, email-confirmed self-deletion (optional, defaults to true).
   * See {@link ImmediateAccountDeletionSchema}.
   */
  immediateAccountDeletion: Schema.optional(ImmediateAccountDeletionSchema),

  // ============================================================================
  // Authentication Strategies (required)
  // ============================================================================

  /**
   * Array of authentication strategies. No duplicate types allowed. May be
   * empty or omitted when `auth.sso` declares at least one identity provider.
   */
  strategies: Schema.optional(AuthStrategiesSchema),

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
   * Self-service API keys (optional)
   *
   * Let a signed-in user mint, list and revoke their OWN long-lived API keys
   * and authenticate `/api/*` requests with the `x-api-key` header. A key
   * inherits the role of the user who created it; there is no
   * admin-manages-others path and no client-supplied permission grant.
   * Omitted (the default) means the `/api/auth/api-key/*` endpoints answer 404.
   */
  apiKeys: Schema.optional(AuthApiKeysConfigSchema),

  /**
   * Device authorization for the `sovrium` CLI (optional)
   *
   * Lets the CLI sign in with a short code a signed-in user approves in the
   * browser, then redeem the approved code ONCE for an API key of that user
   * (`POST /api/auth/device/api-key`). Requires `apiKeys: true`. Omitted (the
   * default) means the `/api/auth/device*` endpoints answer 404.
   */
  deviceAuthorization: Schema.optional(AuthDeviceAuthorizationConfigSchema),

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
  // Enterprise sign-in (optional)
  // ============================================================================

  /**
   * Single sign-on identity providers (optional). OIDC or SAML, declared in
   * config only — there is no runtime registration endpoint.
   */
  sso: Schema.optional(AuthSsoConfigSchema),

  /**
   * Passkey (WebAuthn) sign-in (optional). `true`, or an object adding the
   * authenticator display name and the admin-plane passkey requirement.
   */
  passkeys: Schema.optional(PasskeysConfigSchema),

  /**
   * SCIM 2.0 provisioning (optional). Presence mounts `/api/scim/v2/*`,
   * authenticated by the bearer token the `$env.` reference names.
   */
  scim: Schema.optional(ScimConfigSchema),

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
      Schema.annotate({
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
        Schema.annotate({
          description: 'Table slug from app.tables[].name (e.g., "clients", "projects")',
        }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
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
      Schema.annotate({
        title: 'Landing Path',
        description:
          'Engine-resolver mount path. Sessions navigating here are redirected to the matching role.defaultLanding. Must start with /. Must be backed by a co-located page declaration that acts as the unauthenticated-access guard.',
        examples: ['/portal', '/dashboard', '/home'],
      }),
      Schema.check(Schema.isPattern(/^\//))
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
      Schema.annotate({
        defaultNote: '/403',
        title: 'No Access Path',
        description:
          'Fallback path when no role.defaultLanding matches the session. Defaults to /403.',
        examples: ['/403', '/portal/onboarding', '/no-access'],
      }),
      Schema.check(Schema.isPattern(/^\//))
    )
  ),
}).pipe(
  Schema.annotate({
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
  Schema.check(
    Schema.makeFilter((config) => {
      return (
        validateHasSignInMethod(config) ??
        validateTwoFactorRequiresEmailPassword(config) ??
        validateDeviceAuthorizationRequiresApiKeys(config) ??
        validateDefaultRoleExists(config) ??
        validateGroupNames(config) ??
        validateScopeTables(config) ??
        validateLandingPathRequiredWhenRolesHaveLanding(config) ??
        validateEnterpriseAuth(config) ??
        validateAccountDeletionTemplateLink(config)
      )
    })
  )
)

/**
 * TypeScript type inferred from AuthSchema
 */
export type Auth = Schema.Schema.Type<typeof AuthSchema>

/**
 * Encoded type of AuthSchema (what goes in before validation)
 * @public
 */
export type AuthEncoded = Schema.Codec.Encoded<typeof AuthSchema>
