/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import type {
  accounts,
  invitations,
  jwks,
  members,
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  organizations,
  sessions,
  teamMembers,
  teams,
  twoFactors,
  users,
  verifications,
} from './schema-sqlite/auth-tables'

export * from './schema-sqlite/auth-tables'
export * from './schema-sqlite/auth-relations'

export * from './schema-sqlite/activity-log'
export * from './schema-sqlite/app-versioning'
export * from './schema-sqlite/ai'
export * from './schema-sqlite/analytics-events'
export * from './schema-sqlite/automation'
export * from './schema-sqlite/automation-digest'
export * from './schema-sqlite/automation-state'
export * from './schema-sqlite/connection'
export * from './schema-sqlite/favorites'
export * from './schema-sqlite/form-submissions'
export * from './schema-sqlite/migration-audit'
export * from './schema-sqlite/record-comments'
export * from './schema-sqlite/search'
export * from './schema-sqlite/storage'
export * from './schema-sqlite/user-access'
export * from './schema-sqlite/webhook'

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type Account = typeof accounts.$inferSelect
export type Verification = typeof verifications.$inferSelect
export type TwoFactor = typeof twoFactors.$inferSelect
export type NewTwoFactor = typeof twoFactors.$inferInsert
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type Member = typeof members.$inferSelect
export type NewMember = typeof members.$inferInsert
export type Invitation = typeof invitations.$inferSelect
export type Team = typeof teams.$inferSelect
export type TeamMember = typeof teamMembers.$inferSelect
export type Jwks = typeof jwks.$inferSelect
export type NewJwks = typeof jwks.$inferInsert
export type OAuthClient = typeof oauthClients.$inferSelect
export type NewOAuthClient = typeof oauthClients.$inferInsert
export type OAuthAccessToken = typeof oauthAccessTokens.$inferSelect
export type NewOAuthAccessToken = typeof oauthAccessTokens.$inferInsert
export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect
export type NewOAuthRefreshToken = typeof oauthRefreshTokens.$inferInsert
export type OAuthConsent = typeof oauthConsents.$inferSelect
export type NewOAuthConsent = typeof oauthConsents.$inferInsert
