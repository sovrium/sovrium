/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Better Auth Drizzle table definitions.
// All auth tables are created in the dedicated "auth" PostgreSQL schema so
// they cannot collide with user-defined application tables in `public`.
// Relations live in `schema-relations.ts` (split for ESLint max-lines).

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Better Auth schema - isolated from main app schema
export const authSchema = pgSchema('auth')

// Better Auth Tables (using native table names in dedicated auth schema)
// Schema isolation prevents conflicts when users create their own tables
export const users = authSchema.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  // Admin plugin fields
  role: text('role'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  // Two-factor plugin fields
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  // GDPR account-erasure scheduling (Art. 17). When set, the account is
  // scheduled for a hard delete at this timestamp; the purge scheduler
  // physically removes the account once `scheduledErasureAt <= NOW()`.
  // NULL means no erasure is pending. Column is intentionally camelCase-
  // quoted to match the Better Auth naming convention used by callers.
  scheduledErasureAt: timestamp('scheduledErasureAt', { withTimezone: true }),
})

export const sessions = authSchema.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Admin plugin fields
    impersonatedBy: text('impersonated_by'),
    // Organization plugin fields
    activeOrganizationId: text('active_organization_id'),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
)

export const accounts = authSchema.table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    // Account identity is scoped by issuer: `local:credential` for password
    // accounts, `local:oauth:<providerId>` for social ones. Upstream declares it
    // required with no default, but it is kept NULLABLE here on purpose — SQLite
    // cannot ADD COLUMN … NOT NULL without a default, and a PG-only NOT NULL
    // would diverge the two dialects. Every writer must set it; the value is
    // produced by `credentialIssuer()` / `oauthIssuer()` in `account-issuer.ts`.
    issuer: text('issuer'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('account_userId_idx').on(table.userId),
    // Name matches the one Better Auth's own migrator generates, so an operator
    // who ever runs `auth migrate` finds it present and skips it.
    uniqueIndex('account_issuer_accountId_uidx').on(table.issuer, table.accountId),
  ]
)

export const verifications = authSchema.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
)

// Two-factor plugin table
export const twoFactors = authSchema.table(
  'two_factor',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    verified: boolean('verified').default(true),
    // Better Auth 1.6.x TOTP verification-rate-limiting fields: the failed
    // attempt counter and the lockout expiry the plugin reads/writes on
    // /two-factor/verify-totp. Absent columns make the Drizzle adapter throw
    // "field does not exist" and 500 the enable/verify endpoints.
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
  },
  (table) => [
    index('twoFactor_secret_idx').on(table.secret),
    index('twoFactor_userId_idx').on(table.userId),
  ]
)

// Organization plugin tables
// Every Sovrium app IS one organization (1:1, non-configurable)
export const organizations = authSchema.table('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const members = authSchema.table(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('member_organizationId_idx').on(table.organizationId),
    index('member_userId_idx').on(table.userId),
  ]
)

export const invitations = authSchema.table(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('pending'),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('invitation_organizationId_idx').on(table.organizationId),
    index('invitation_email_idx').on(table.email),
  ]
)

// Teams (optional — enabled via auth.teams.enabled in app schema)
export const teams = authSchema.table(
  'team',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    // Denormalised member tally. Required upstream but carries a default, so it
    // can be added NOT NULL on both dialects without a table rebuild.
    memberCount: integer('member_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('team_organizationId_idx').on(table.organizationId)]
)

export const teamMembers = authSchema.table(
  'team_member',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Idempotency key for team membership. Nullable, and NULLs never collide in
    // a unique constraint, so pre-existing rows are unaffected.
    membershipKey: text('membership_key').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('teamMember_teamId_idx').on(table.teamId),
    index('teamMember_userId_idx').on(table.userId),
  ]
)

// JWT plugin table (peer requirement of @better-auth/oauth-provider)
// See: https://better-auth.com/docs/plugins/jwt#schema
export const jwks = authSchema.table('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  // Signing algorithm and curve, recorded so a key can be rotated to a
  // different algorithm without guessing how the stored key was generated.
  alg: text('alg'),
  crv: text('crv'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})

// OAuth Provider plugin tables
// See: https://better-auth.com/docs/plugins/oauth-provider#schema
export const oauthClients = authSchema.table(
  'oauth_client',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'),
    disabled: boolean('disabled'),
    skipConsent: boolean('skip_consent'),
    enableEndSession: boolean('enable_end_session'),
    subjectType: text('subject_type'),
    scopes: text('scopes').array(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    name: text('name'),
    uri: text('uri'),
    icon: text('icon'),
    contacts: text('contacts').array(),
    tos: text('tos'),
    policy: text('policy'),
    softwareId: text('software_id'),
    softwareVersion: text('software_version'),
    softwareStatement: text('software_statement'),
    redirectUris: text('redirect_uris').array().notNull(),
    postLogoutRedirectUris: text('post_logout_redirect_uris').array(),
    tokenEndpointAuthMethod: text('token_endpoint_auth_method'),
    grantTypes: text('grant_types').array(),
    responseTypes: text('response_types').array(),
    public: boolean('public'),
    type: text('type'),
    requirePKCE: boolean('require_pkce'),
    // OpenID Connect / OAuth 2.1 client metadata.
    clientDiscoveryId: text('client_discovery_id'),
    clientCredentialsScopes: text('client_credentials_scopes').array(),
    backchannelLogoutUri: text('backchannel_logout_uri'),
    backchannelLogoutSessionRequired: boolean('backchannel_logout_session_required'),
    applicationType: text('application_type'),
    jwks: text('jwks'),
    jwksUri: text('jwks_uri'),
    dpopBoundAccessTokens: boolean('dpop_bound_access_tokens'),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('oauthClient_clientId_idx').on(table.clientId),
    index('oauthClient_userId_idx').on(table.userId),
  ]
)

export const oauthRefreshTokens = authSchema.table(
  'oauth_refresh_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    clientId: text('client_id').notNull(),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    referenceId: text('reference_id'),
    scopes: text('scopes').array().notNull(),
    revoked: timestamp('revoked', { withTimezone: true }),
    authTime: timestamp('auth_time', { withTimezone: true }),
    // Resource-indicator + rotation-replay bookkeeping (OAuth 2.1).
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources').array(),
    requestedUserInfoClaims: text('requested_user_info_claims').array(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    rotationReplayResponse: text('rotation_replay_response'),
    rotationReplayExpiresAt: timestamp('rotation_replay_expires_at', { withTimezone: true }),
    confirmation: jsonb('confirmation'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('oauthRefreshToken_clientId_idx').on(table.clientId),
    index('oauthRefreshToken_sessionId_idx').on(table.sessionId),
    index('oauthRefreshToken_userId_idx').on(table.userId),
    index('oauthRefreshToken_token_idx').on(table.token),
  ]
)

export const oauthAccessTokens = authSchema.table(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    clientId: text('client_id').notNull(),
    sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    refreshId: text('refresh_id').references(() => oauthRefreshTokens.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    referenceId: text('reference_id'),
    scopes: text('scopes').array().notNull(),
    // Resource-indicator support + per-token revocation (OAuth 2.1).
    authorizationCodeId: text('authorization_code_id'),
    resources: text('resources').array(),
    requestedUserInfoClaims: text('requested_user_info_claims').array(),
    revoked: timestamp('revoked', { withTimezone: true }),
    confirmation: jsonb('confirmation'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('oauthAccessToken_clientId_idx').on(table.clientId),
    index('oauthAccessToken_sessionId_idx').on(table.sessionId),
    index('oauthAccessToken_refreshId_idx').on(table.refreshId),
    index('oauthAccessToken_userId_idx').on(table.userId),
    index('oauthAccessToken_token_idx').on(table.token),
  ]
)

export const oauthConsents = authSchema.table(
  'oauth_consent',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    referenceId: text('reference_id'),
    scopes: text('scopes').array().notNull(),
    // What the user consented to, beyond plain scopes.
    resources: text('resources').array(),
    requestedUserInfoClaims: text('requested_user_info_claims').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('oauthConsent_userId_idx').on(table.userId),
    index('oauthConsent_clientId_idx').on(table.clientId),
  ]
)

// API-key plugin table (`@better-auth/api-key`, model name `apikey`).
//
// Mounted only when `auth.apiKeys` is enabled, but the TABLE always exists:
// migrations are not conditional on an app's config, and a table with no rows
// costs nothing. The 22 columns mirror the plugin's own `apiKeySchema()`
// field-for-field — a column the adapter expects and cannot find makes the
// endpoint 500 rather than degrade, so this is a faithful mirror, not a subset.
//
// `referenceId` is the OWNER. The plugin's `references` option is left at its
// default (`'user'`), so it is always an `auth.user.id` — hence the cascade,
// which is what makes an erased account take its keys with it (S5). It is NOT
// declared as polymorphic here because Sovrium never configures the
// organization-owned mode; if that ever changes, the FK is the thing to revisit.
//
// The two millisecond-valued columns are `bigint` rather than `integer`: a
// refill interval beyond ~24.8 days overflows int32 silently. Both are
// server-only properties the client path refuses, so the overflow is currently
// unreachable — `bigint` keeps it unreachable if that ever stops being true.
export const apiKeys = authSchema.table(
  'api_key',
  {
    id: text('id').primaryKey(),
    configId: text('config_id').notNull().default('default'),
    name: text('name'),
    start: text('start'),
    prefix: text('prefix'),
    // The HASHED key (unpadded base64url SHA-256 by default). Never the issued
    // credential — a database reader must not be able to authenticate.
    key: text('key').notNull(),
    referenceId: text('reference_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refillInterval: bigint('refill_interval', { mode: 'number' }),
    refillAmount: integer('refill_amount'),
    lastRefillAt: timestamp('last_refill_at', { withTimezone: true }),
    enabled: boolean('enabled').default(true),
    rateLimitEnabled: boolean('rate_limit_enabled').default(true),
    rateLimitTimeWindow: bigint('rate_limit_time_window', { mode: 'number' }),
    rateLimitMax: integer('rate_limit_max'),
    requestCount: integer('request_count').default(0),
    remaining: integer('remaining'),
    lastRequest: timestamp('last_request', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    permissions: text('permissions'),
    metadata: text('metadata'),
  },
  (table) => [
    index('apiKey_referenceId_idx').on(table.referenceId),
    index('apiKey_configId_idx').on(table.configId),
  ]
)
