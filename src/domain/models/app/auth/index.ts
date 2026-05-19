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

export * from './email-templates'
export * from './groups'
export * from './strategies/oauth'
export * from './roles'
export * from '@/domain/types/session-info'
export * from './strategies'
export * from './two-factor'

type StrategyType = 'emailAndPassword' | 'magicLink' | 'oauth'

export const hasStrategy = (auth: Auth | undefined, strategyType: StrategyType): boolean => {
  if (!auth?.strategies) return false
  return auth.strategies.some((s) => s.type === strategyType)
}

export const getStrategy = <T extends StrategyType>(
  auth: Auth | undefined,
  strategyType: T
): Extract<AuthStrategy, { readonly type: T }> | undefined => {
  if (!auth?.strategies) return undefined
  return auth.strategies.find((s) => s.type === strategyType) as
    | Extract<AuthStrategy, { readonly type: T }>
    | undefined
}

export const getEnabledStrategies = (auth: Auth | undefined): readonly StrategyType[] => {
  if (!auth?.strategies) return []
  return auth.strategies.map((s) => s.type)
}

export const isMethodEnabled = (auth: Auth | undefined, method: StrategyType): boolean =>
  hasStrategy(auth, method)

export const getEnabledMethods = (auth: Auth | undefined): readonly StrategyType[] =>
  getEnabledStrategies(auth)

export const hasAnyMethodEnabled = (auth: Auth | undefined): boolean =>
  (auth?.strategies?.length ?? 0) > 0

export const AllowSignUpSchema = Schema.Boolean.pipe(
  Schema.annotations({
    title: 'Allow Sign-Up',
    description:
      'Controls user self-registration. true allows anyone to sign up. false restricts user creation to admins.',
    examples: [true, false],
  })
)

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

  allowSignUp: Schema.optional(AllowSignUpSchema),


  strategies: AuthStrategiesSchema,


  roles: Schema.optional(RolesConfigSchema),

  defaultRole: Schema.optional(DefaultRoleSchema),


  twoFactor: Schema.optional(TwoFactorConfigSchema),

  emailTemplates: Schema.optional(AuthEmailTemplatesSchema),

  invitationTokenExpiry: Schema.optional(InvitationTokenExpirySchema),


  groups: Schema.optional(
    Schema.Array(GroupSchema).pipe(
      Schema.annotations({
        title: 'Groups',
        description:
          'User groups for permission grouping. Referenced in permissions with group: prefix. Teams are configured through groups.',
      })
    )
  ),


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

export type Auth = Schema.Schema.Type<typeof AuthSchema>

export type AuthEncoded = Schema.Schema.Encoded<typeof AuthSchema>

export const hasAuthenticationMethod = (auth: Auth, strategyType: StrategyType): boolean =>
  hasStrategy(auth, strategyType)

export const isSignUpDisabled = (auth: Auth | undefined): boolean => auth?.allowSignUp === false

export const isSignUpAllowed = (auth: Auth | undefined): boolean => auth?.allowSignUp !== false

type PluginName = 'twoFactor'

export const hasPlugin = (auth: Auth, pluginName: PluginName): boolean => {
  const plugin = auth[pluginName]
  if (typeof plugin === 'boolean') return plugin
  return plugin !== undefined
}
